/**
 * Job Founder Hunter - Background WorkAtAStartup Module
 */

async function startWasApplyFlow({ jobs, settings }) {
  if (JFH_State.isWasApplying) return { error: 'Already applying to jobs' };
  if (!jobs || jobs.length === 0) return { error: 'No jobs provided' };

  JFH_State.wasApplyQueue = jobs;
  JFH_State.wasApplyIndex = 0;
  JFH_State.isWasApplying = true;

  console.log(`[JFH] Starting WAS auto-apply for ${jobs.length} jobs`);
  broadcastWasState();
  processNextWasJob(settings);

  return { success: true, count: jobs.length };
}

async function queueWasJobs(data) {
  // Placeholder for WAS job queue logic
  return { success: true };
}

async function processNextWasJob(settings) {
  if (!JFH_State.isWasApplying) return;

  if (JFH_State.wasApplyIndex >= JFH_State.wasApplyQueue.length) {
    JFH_State.isWasApplying = false;
    if (JFH_State.wasApplyTabId) {
      chrome.tabs.remove(JFH_State.wasApplyTabId).catch(() => {});
      JFH_State.wasApplyTabId = null;
    }
    broadcastWasState({ message: 'All jobs applied!' });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      title: 'Auto-Apply Complete!',
      message: `Applied to ${JFH_State.wasApplyQueue.length} jobs on WorkAtAStartup.`
    });
    return;
  }

  const job = JFH_State.wasApplyQueue[JFH_State.wasApplyIndex];
  console.log(`[JFH] Applying to job ${JFH_State.wasApplyIndex + 1}/${JFH_State.wasApplyQueue.length}: ${job.jobTitle} at ${job.companyName}`);
  broadcastWasState({ currentJob: `${job.jobTitle} @ ${job.companyName}` });

  // Close previous tab
  if (JFH_State.wasApplyTabId) {
    chrome.tabs.remove(JFH_State.wasApplyTabId).catch(() => {});
    JFH_State.wasApplyTabId = null;
  }

  // Safety timeout: 30 seconds per job
  let safetyTimer = setTimeout(() => {
    console.warn('[JFH] Safety timeout for WAS job:', job.jobTitle);
    if (JFH_State.wasApplyTabId) {
      chrome.tabs.remove(JFH_State.wasApplyTabId).catch(() => {});
      JFH_State.wasApplyTabId = null;
    }
    JFH_State.wasApplyIndex++;
    broadcastWasState();
    setTimeout(() => processNextWasJob(settings), 1000);
  }, 30000);

  // Open the job page
  chrome.tabs.create({ url: job.jobUrl, active: false }, (tab) => {
    JFH_State.wasApplyTabId = tab.id;

    // Poll until content script is ready, then send FILL_JOB_APPLICATION
    sendMessageWithRetry(tab.id, {
      type: 'FILL_JOB_APPLICATION',
      data: {
        jobTitle: job.jobTitle,
        companyName: job.companyName,
        settings
      }
    }, 20, 1000)
    .then(async (result) => {
      clearTimeout(safetyTimer);
      console.log(`[JFH] Apply result for ${job.jobTitle}:`, result);

      if (result?.success) {
        // Save to DB
        await handleWasJobApplied({
          jobTitle: job.jobTitle,
          companyName: job.companyName,
          jobUrl: job.jobUrl,
          companyProfileUrl: result.companyProfileUrl,
          appliedAt: Date.now()
        });

        broadcastWasState({ lastApplied: `${job.jobTitle} @ ${job.companyName}` });

        // --- NEW LOGIC: Go to company page and extract founders immediately ---
        if (result.companyProfileUrl) {
          console.log('[JFH] Navigating to company page for founder extraction:', result.companyProfileUrl);
          broadcastWasState({ message: `Extracting founders for ${job.companyName}...` });

          await new Promise(r => setTimeout(r, 2000)); // wait a bit after submit

          // Navigate existing tab
          await new Promise(resolve => {
            chrome.tabs.update(JFH_State.wasApplyTabId, { url: result.companyProfileUrl }, resolve);
          });

          // Poll until the new page is ready and extract founders
          try {
            const scrapeResult = await sendMessageWithRetry(JFH_State.wasApplyTabId, {
              type: 'SCRAPE_COMPANY_DETAIL',
              data: {}
            }, 15, 1500);

            if (scrapeResult?.success && scrapeResult.founders) {
               console.log(`[JFH] Found ${scrapeResult.founders.length} founders for ${job.companyName}`);
               for (const founder of scrapeResult.founders) {
                 await JFH_DB.addFounder(founder);
               }
            }
          } catch (e) {
            console.warn('[JFH] Failed to extract inline founders:', e);
          }
        }
      }

      // Close tab and move to next job after a short human-like delay
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 2000));
      if (JFH_State.wasApplyTabId) {
        chrome.tabs.remove(JFH_State.wasApplyTabId).catch(() => {});
        JFH_State.wasApplyTabId = null;
      }

      JFH_State.wasApplyIndex++;
      broadcastWasState();
      // Human-like delay between applications (5-10 seconds)
      setTimeout(() => processNextWasJob(settings), 5000 + Math.random() * 5000);
    })
    .catch(err => {
      clearTimeout(safetyTimer);
      console.warn('[JFH] Could not apply to job:', job.jobTitle, err.message);
      if (JFH_State.wasApplyTabId) {
        chrome.tabs.remove(JFH_State.wasApplyTabId).catch(() => {});
        JFH_State.wasApplyTabId = null;
      }
      JFH_State.wasApplyIndex++;
      broadcastWasState();
      setTimeout(() => processNextWasJob(settings), 3000);
    });
  });
}

async function handleWasJobApplied(data) {
  const { jobTitle, companyName, jobUrl, appliedAt } = data;

  const record = {
    id: `was_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    jobTitle: jobTitle || '',
    companyName: companyName || '',
    jobUrl: jobUrl || '',
    source: 'workatastartup',
    appliedAt: appliedAt || Date.now(),
    founderScraped: false
  };

  await JFH_DB._put('applied_jobs', record);
  console.log('[JFH] Saved applied job:', record.jobTitle);

  // Broadcast updated stats
  chrome.runtime.sendMessage({ type: 'STATS_UPDATED' }).catch(() => {});

  return { success: true };
}

const JFH_WAS = {
  startWasApplyFlow,
  queueWasJobs,
  processNextWasJob,
  handleWasJobApplied
};

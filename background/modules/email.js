/**
 * Job Founder Hunter - Background Email Flow Module
 */

// ========== Phase 1: Find Emails Only (no sending) ==========

function startFindingEmails() {
  if (JFH_State.isRunning) return { error: 'Already running' };

  return JFH_DB.getAllFounders().then((allFounders) => {
    // Only founders that still need an email discovered
    JFH_State.targetBatch = allFounders.filter(
      (f) => f.linkedinUrl && !f.contacted && !f.emailSearchAttempted && !f.email
    );

    if (JFH_State.targetBatch.length === 0) {
      return { success: false, message: 'No pending founders need email finding.' };
    }

    JFH_State.isRunning = true;
    JFH_State.isPaused = false;
    JFH_State.currentTask = 'finding';
    JFH_State.currentIndex = 0;
    JFH_State.completedCount = 0;
    JFH_State.failedCount = 0;
    JFH_State.findOnlyMode = true;

    broadcastState();

    processNextEmail();

    return { success: true, count: JFH_State.targetBatch.length };
  });
}

// ========== Phase 3: Send All (via Backend queue) ==========

function startSendingViaBackend() {
  if (JFH_State.isRunning) return { error: 'Already running' };

  return JFH_DB.getAllSettings().then((settings) => {
    // Auto-set action mode to backend when user explicitly uses backend send
    if (settings.emailActionMode !== 'backend') {
      JFH_DB.saveSetting('emailActionMode', 'backend').catch(() => {});
    }

    return JFH_DB.getAllFounders().then((allFounders) => {
      // Send to ALL founders that have an email, regardless of contacted/sent status
      let batch = allFounders.filter((f) => f.email);

      if (batch.length === 0) {
        return { success: false, message: 'No founders with emails to send.' };
      }

      JFH_State.isRunning = true;
      JFH_State.isPaused = false;
      JFH_State.currentTask = 'sending_backend';
      JFH_State.currentIndex = 0;
      JFH_State.completedCount = 0;
      JFH_State.failedCount = 0;
      JFH_State.findOnlyMode = false;
      JFH_State.targetBatch = batch;

      broadcastState();

      processNextEmail();

      return { success: true, count: batch.length };
    });
  });
}

// ========== Batch Emailing Flow (The Orchestrator) ==========

function startBatchEmailing() {
  if (JFH_State.isRunning) return { error: 'Already running' };

  return JFH_DB.getAllFounders().then((allFounders) => {
    // Fetch uncontacted founders who HAVE a LinkedIn URL but NO email yet
    // OR founders who HAVE an email but HAVEN'T been contacted
    JFH_State.targetBatch = allFounders.filter(f => f.linkedinUrl && !f.contacted && !f.emailSearchAttempted);

    if (JFH_State.targetBatch.length === 0) {
      return { success: false, message: 'No pending founders found with LinkedIn URLs.' };
    }

    JFH_State.isRunning = true;
    JFH_State.isPaused = false;
    JFH_State.currentTask = 'emailing';
    JFH_State.currentIndex = 0;
    JFH_State.completedCount = 0;
    JFH_State.failedCount = 0;

    broadcastState();

    // Start loop
    processNextEmail();

    return { success: true, count: JFH_State.targetBatch.length };
  });
}

async function processNextEmail() {
  if (!JFH_State.isRunning || JFH_State.isPaused) return;

  if (JFH_State.currentIndex >= JFH_State.targetBatch.length) {
    // Finished batch
    const doneTask = JFH_State.currentTask;
    JFH_State.isRunning = false;
    JFH_State.currentTask = null;

    const completionMsg =
      doneTask === 'finding'
        ? 'Email finding completed! Review in the Data tab, then Send All via Backend.'
        : doneTask === 'sending_backend'
        ? 'All emails queued to backend for sending!'
        : 'Batch completed!';

    broadcastState({ message: completionMsg });

    chrome.notifications.create({
      type: 'basic',
      title: 'Job Founder Hunter',
      message: completionMsg
    });
    return;
  }

  const founder = JFH_State.targetBatch[JFH_State.currentIndex];
  broadcastState({ currentFounder: founder.name });

  try {
    // Step 1: Do we need to find the email?
    if (!founder.email) {
      await findEmailOnLinkedIn(founder);
      // findEmailOnLinkedIn handles tab creation and waits for EMAIL_DETECTED message
      // Execution continues in handleEmailDetected
    } else {
      // We already have email, go straight to compose
      await openGmailCompose(founder);
    }
  } catch (err) {
    console.error('[JFH] Error processing founder:', founder, err);
    JFH_State.currentIndex++;
    setTimeout(processNextEmail, 2000); // Wait and move to next
  }
}

// --- Step 1: LinkedIn Email Finding ---
function findEmailOnLinkedIn(founder) {
  return new Promise((resolve) => {
    // Open LinkedIn profile
    chrome.tabs.create({ url: founder.linkedinUrl, active: false }, (tab) => {
      founder.currentTabId = tab.id;

      // Safety timeout - if email detection gets completely stuck
      JFH_State.linkedInSafetyTimer = setTimeout(() => {
        console.warn(`[JFH] Safety timeout on LinkedIn for ${founder.name}`);
        if (founder.currentTabId) {
          chrome.tabs.remove(founder.currentTabId).catch(e => {
            if (e.message && !e.message.includes('No tab with id')) {
              console.log('[JFH] Tab removal warning:', e.message);
            }
          });
        }

        // Treat as email not found
        handleEmailDetected({
          founderId: founder.id,
          email: null,
          found: false,
          source: 'timeout'
        }).catch(err => console.warn('[JFH] Safety timeout handler error:', err));
      }, 40000); // 40 seconds max per LinkedIn profile

      // Use polling instead of waiting for page completion
      sendMessageWithRetry(tab.id, {
        type: 'DETECT_EMAIL',
        data: { founder }
      }, 20, 1000)
      .then(() => {
        // Successfully pinged content script.
        // We let safetyTimer keep running. handleEmailDetected will clear it.
      })
      .catch(err => {
        console.warn('[JFH] LinkedIn script not ready', err.message);
        if (JFH_State.linkedInSafetyTimer) { clearTimeout(JFH_State.linkedInSafetyTimer); JFH_State.linkedInSafetyTimer = null; }
        if (founder.currentTabId) {
          chrome.tabs.remove(founder.currentTabId).catch(e => {
            if (e.message && !e.message.includes('No tab with id')) {
              console.log('[JFH] Tab removal warning:', e.message);
            }
          });
        }

        // Skip and move to next
        return handleEmailDetected({
          founderId: founder.id,
          email: null,
          found: false,
          source: 'error'
        });
      });

      resolve(); // Let the flow wait for handleEmailDetected
    });
  });
}

async function handleEmailDetected(data) {
  const { founderId, email, found, source, extractedInfo } = data;

  // ALWAYS cancel safety timer first — prevents race condition
  if (JFH_State.linkedInSafetyTimer) {
    clearTimeout(JFH_State.linkedInSafetyTimer);
    JFH_State.linkedInSafetyTimer = null;
  }

  let founder = null;

  if (founderId && JFH_State.targetBatch.length > 0) {
    // Attempt to find in active batch
    let founderIdx = JFH_State.targetBatch.findIndex(f => f.id === founderId);
    if (founderIdx !== -1) {
      founder = JFH_State.targetBatch[founderIdx];
      JFH_State.currentIndex = founderIdx; // Re-sync currentIndex
    }
  }

  // If this was a manual LinkedIn visit or the founder wasn't in the active batch
  if (!founder && found && email) {
    console.log('[JFH] Manual email detection triggered. Creating/updating founder dynamically.');

    // Check if we already have this founder in DB by ID (even if not in active batch)
    if (founderId) {
      founder = await JFH_DB.getFounder(founderId);
    }

    // If still no founder, create a temporary one from extracted info
    if (!founder) {
      founder = {
        id: `manual_${Date.now()}`,
        name: extractedInfo?.name || 'Founder',
        title: extractedInfo?.title || 'Founder',
        companyName: 'Your Company',
        email: email,
        linkedinUrl: 'https://linkedin.com',
        source: 'manual',
        contacted: false
      };
      await JFH_DB.addFounder(founder);
    }
  }

  if (!founder) {
    console.warn('[JFH] Founder not found and no extracted info available. Cannot proceed.');
    return Promise.resolve({ success: false, message: 'Founder not found' });
  }

  console.log(`[JFH] handleEmailDetected for ${founder.name}: found=${found}, email=${email}, source=${source}`);

  // Close the exact LinkedIn tab we opened
  if (founder && founder.currentTabId) {
    chrome.tabs.remove(founder.currentTabId).catch(e => {
      if (e.message && !e.message.includes('No tab with id')) {
        console.log('[JFH] Tab removal warning:', e.message);
      }
    });
  }

  if (found && email) {
    // Update DB
    await JFH_DB.updateFounderEmail(founderId, email);
    founder.email = email;

    if (JFH_State.findOnlyMode) {
      // Phase 1: only collect emails, do not send
      console.log(`[JFH] Email found for ${founder.name}: ${email}`);
      broadcastState({ currentFounder: `Found email for ${founder.name}` });
      JFH_State.currentIndex++;
      JFH_State.completedCount++;
      setTimeout(processNextEmail, JFH_CONFIG.DELAYS.BETWEEN_LINKEDIN);
    } else {
      // Broadcast state to refresh popup stats immediately
      broadcastState({ currentFounder: `Drafting email for ${founder.name}` });
      // Proceed to compose
      await openGmailCompose(founder);
    }
  } else {
    // Mark as attempted so we don't try again next time
    const dbFounder = await JFH_DB.getFounder(founderId);
    if (dbFounder) {
      dbFounder.emailSearchAttempted = true;
      dbFounder.status = 'email_not_found';
      await JFH_DB.updateFounder(dbFounder);
    }

    // Skip to next
    console.log(`[JFH] No email found for ${founder.name}, skipping.`);
    JFH_State.currentIndex++;
    JFH_State.failedCount++;
    broadcastState({ currentFounder: `Skipped ${founder.name}` });
    setTimeout(processNextEmail, JFH_CONFIG.DELAYS.BETWEEN_LINKEDIN);
  }

  return Promise.resolve({ success: true });
}

// Called when an email is successfully queued via the backend
function handleBackendSent(founder, email, emailContent, settings) {
  JFH_DB.markFounderContacted(founder.id);
  JFH_DB.logEmailSent({
    founderId: founder.id,
    founderName: founder.name,
    companyName: founder.companyName,
    email,
    subject: emailContent?.subject || '',
    templateUsed: settings?.selectedTemplate || 'professional',
    trackingId: founder.trackingId || '',
  });
  JFH_State.currentIndex++;
  JFH_State.completedCount++;
  broadcastState({ currentFounder: `Sent to ${founder.name}` });
  setTimeout(processNextEmail, JFH_CONFIG.DELAYS.BETWEEN_EMAILS);
}

const JFH_Email = {
  startFindingEmails,
  startSendingViaBackend,
  startBatchEmailing,
  processNextEmail,
  findEmailOnLinkedIn,
  handleEmailDetected,
  handleBackendSent
};

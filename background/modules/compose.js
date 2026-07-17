/**
 * Job Founder Hunter - Background Compose Module
 */

function openGmailCompose(founder) {
  // Get settings for template rendering
  const settings = JFH_DB.getAllSettingsSync ? null : null; // will be fetched async below
  // Since getAllSettings is async, we need to restructure this
  // Actually, let me check if there's a sync version or we need to make this async properly

  // For service worker, we'll use the async pattern
  return JFH_DB.getAllSettings().then((settings) => {
    const templateId = settings.selectedTemplate || 'professional';

    const templateData = {
      founder_name: founder.name.split(' ')[0], // First name
      company_name: typeof cleanCompanyName === 'function'
        ? cleanCompanyName(founder.companyName)
        : founder.companyName,
      founder_title: founder.title || founder.role,
      your_name: settings.userName || '[Your Name]',
      your_skills: settings.userSkills || '[Your Skills]',
      resume_link: settings.resumeLink || '[Link]',
      position: settings.targetPosition || '[Position]',
      your_email: settings.userEmail || '',
      github_link: settings.githubLink || '[GitHub]',
      linkedin_link: settings.linkedinLink || '[LinkedIn]',
      portfolio_link: settings.portfolioLink || '[Portfolio]'
    };

    const emailContent = JFH_Templates.render(templateId, templateData);
    if (!emailContent) {
      console.error('[JFH] Template render failed');
      JFH_State.currentIndex++;
      processNextEmail();
      return;
    }

    // === Mode: Backend (Nodemailer + Queue) ===
    if (settings.emailActionMode === 'backend') {
      const auth = {
        backendUrl: settings.backendUrl || JFH_CONFIG.BACKEND.DEFAULT_URL,
        apiKey: settings.backendApiKey || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
      };
      broadcastState({ currentFounder: `Queuing email for ${founder.name} (backend)...` });
      return JFH_Helpers.sendEmailViaBackend({
        to: founder.email,
        subject: emailContent.subject,
        body: emailContent.body,
        replyTo: settings.userEmail,
        founderId: founder.id,
        trackLinks: JFH_State.normalLinksMode ? false : true,
      }, auth).then((res) => {
        if (res.success) {
          console.log(`[JFH] Queued email for ${founder.name} -> ${founder.email}`);
          const trackId = res.jobs && res.jobs[0] ? res.jobs[0].trackId : null;
          if (trackId) {
            founder.trackingId = trackId;
            JFH_DB.updateFounder(founder).catch(e => console.warn('[JFH] could not save trackingId', e));
          }
          handleBackendSent(founder, founder.email, emailContent, settings);
        } else {
          console.error(`[JFH] Backend send failed for ${founder.name}:`, res.message);
          JFH_State.failedCount++;
          broadcastState({ currentFounder: `Backend failed for ${founder.name}` });
          // Fallback: open Gmail compose so the user can send manually
          openGmailTab(founder, emailContent, settings);
        }
        return res;
      });
    }

    // === Mode: Gmail (draft / send) ===
    openGmailTab(founder, emailContent, settings);
  });
}

function openGmailTab(founder, emailContent, settings) {
  // Open Gmail tab with pre-filled parameters (100% reliable, no DOM typing needed)
  const encodedTo = encodeURIComponent(founder.email);
  const encodedSubject = encodeURIComponent(emailContent.subject);
  const encodedBody = encodeURIComponent(emailContent.body);

  const gmailComposeUrl = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;

  return new Promise((resolve) => {
    chrome.tabs.create({ url: gmailComposeUrl, active: true }, async (tab) => {
      founder.gmailTabId = tab.id; // Store Gmail tab ID for closing later

      // The email is already drafted by Gmail itself via the URL parameters!
      // We just wait a bit and tell the content script to monitor for the Send button.
      await new Promise(r => setTimeout(r, 3000));

      // Send a message just to attach the tracker (not to type)
      sendMessageWithRetry(tab.id, {
        type: 'COMPOSE_EMAIL',
        data: {
          to: founder.email,
          founderId: founder.id,
          actionMode: settings.emailActionMode || 'draft',
          isPreFilled: true // Tell content script not to type
        }
      }, 20, 1000)
      .then(() => console.log('[JFH] Successfully attached tracker to Gmail'))
      .catch(err => console.warn('[JFH] Could not attach Gmail tracker (maybe already sent):', err));
      resolve();
    });
  });
}

// --- Step 3: Bulk Sending Drafts Flow ---
function startSendingDraftsFlow() {
  if (JFH_State.isRunning) return { error: 'Already running' };

  JFH_State.isRunning = true;
  JFH_State.isPaused = false;
  JFH_State.currentTask = 'sending_drafts';
  JFH_State.completedCount = 0;
  JFH_State.failedCount = 0;
  broadcastState({ message: 'Opening Gmail Drafts...' });

  chrome.tabs.create({ url: 'https://mail.google.com/mail/u/0/#drafts', active: true }, async (tab) => {
    await new Promise(r => setTimeout(r, 4000)); // Wait for drafts page to load

    // Trigger bulk send process in the content script
    chrome.tabs.sendMessage(tab.id, {
      type: 'PROCESS_BULK_DRAFTS'
    });
  });

  return { success: true };
}

async function handleEmailSentConfirm(data) {
  const { founderId, email, success } = data;
  const founder = await JFH_DB.getFounder(founderId);
  const currentBatchFounder = JFH_State.targetBatch[JFH_State.currentIndex];

  if (success) {
    // Update DB
    JFH_DB.markFounderContacted(founderId);

    // Log sent email
    const settings = await JFH_DB.getAllSettings();

    JFH_DB.logEmailSent({
      founderId,
      founderName: founder?.name,
      companyName: founder?.companyName,
      email,
      templateUsed: settings.selectedTemplate || 'professional'
    });

    // Broadcast state to refresh popup stats immediately
    broadcastState({ currentFounder: `Sent to ${founder.name}` });
  }

  // Close the exact Gmail tab we opened after short delay
  setTimeout(() => {
    if (currentBatchFounder && currentBatchFounder.gmailTabId) {
      chrome.tabs.remove(currentBatchFounder.gmailTabId).catch(e => console.log('Gmail tab already closed:', e));
    }

    // Move to next founder
    JFH_State.currentIndex++;
    setTimeout(processNextEmail, JFH_CONFIG.DELAYS.BETWEEN_EMAILS);
  }, 2000);

  return { success: true };
}

const JFH_Compose = {
  openGmailCompose,
  openGmailTab,
  startSendingDraftsFlow,
  handleEmailSentConfirm
};

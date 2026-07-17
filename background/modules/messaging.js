/**
 * Job Founder Hunter - Background Messaging Module
 */

function sendMessageWithRetry(tabId, message, maxRetries = 15, delayMs = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const trySend = () => {
      attempts++;
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          if (attempts >= maxRetries) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            setTimeout(trySend, delayMs);
          }
        } else {
          resolve(response);
        }
      });
    };
    setTimeout(trySend, 1000); // Initial delay
  });
}

/**
 * Register the main message router.
 * Must be called after all other modules are loaded so handlers are defined.
 */
function setupMessageRouter() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[JFH] Message received in SW:', message.type);

    switch (message.type) {
      // ---- From Popup ----
      case JFH_CONFIG.MESSAGES.START_SCRAPING:
        JFH_Scraper.startScrapingFlow(message.data).then(sendResponse);
        return true;

      case 'START_BATCH_EMAIL':
        JFH_Email.startBatchEmailing().then(sendResponse);
        return true;

      case 'FIND_ALL_EMAILS':
        JFH_Email.startFindingEmails().then(sendResponse);
        return true;

      case 'FIND_ALL_EMAILS_MAILMETEOR':
        JFH_Email.startFindingEmailsMailmeteor().then(sendResponse);
        return true;

      case 'SEND_ALL_BACKEND':
        JFH_Email.startSendingViaBackend().then(sendResponse);
        return true;

      case 'SCRAPE_ALL_FOUNDERS':
        JFH_Scraper.startFounderScraping().then(sendResponse);
        return true;

      case 'COMPANY_FOUNDERS_FOUND':
        JFH_Scraper.handleCompanyFounders(message.data).then(sendResponse);
        return true;

      case 'START_SENDING_DRAFTS':
        JFH_Compose.startSendingDraftsFlow().then(sendResponse);
        return true;

      case 'START_WAS_APPLY':
        JFH_WAS.startWasApplyFlow(message.data).then(sendResponse);
        return true;

      case 'QUEUE_WAS_JOBS':
        JFH_WAS.queueWasJobs(message.data).then(sendResponse);
        return true;

      case 'WAS_JOB_APPLIED':
        JFH_WAS.handleWasJobApplied(message.data).then(sendResponse);
        return true;

      case JFH_CONFIG.MESSAGES.PAUSE_PROCESS:
        JFH_State.isPaused = true;
        broadcastState();
        sendResponse({ success: true });
        break;

      case JFH_CONFIG.MESSAGES.RESUME_PROCESS:
        JFH_State.isPaused = false;
        broadcastState();
        JFH_Email.processNextEmail();
        sendResponse({ success: true });
        break;

      case JFH_CONFIG.MESSAGES.STOP_PROCESS:
        JFH_State.isRunning = false;
        JFH_State.isPaused = false;
        JFH_State.currentTask = null;
        broadcastState();
        sendResponse({ success: true });
        break;

      case JFH_CONFIG.MESSAGES.GET_STATS:
        JFH_DB.getStats().then(stats => {
          sendResponse({
            stats,
            state: {
              isRunning: JFH_State.isRunning,
              isPaused: JFH_State.isPaused,
              currentTask: JFH_State.currentTask,
              progress: JFH_State.targetBatch.length > 0 ? (JFH_State.currentIndex / JFH_State.targetBatch.length * 100) : 0
            }
          });
        });
        return true;

      case JFH_CONFIG.MESSAGES.GET_FOUNDERS:
        JFH_DB.getAllFounders().then(sendResponse);
        return true;

      case JFH_CONFIG.MESSAGES.GET_COMPANIES:
        JFH_DB.getAllCompanies().then(sendResponse);
        return true;

      case JFH_CONFIG.MESSAGES.SAVE_SETTINGS:
        saveSettings(message.data).then(sendResponse);
        return true;

      case JFH_CONFIG.MESSAGES.GET_SETTINGS:
        JFH_DB.getAllSettings().then(sendResponse);
        return true;

      // ---- From Content Scripts ----
      case JFH_CONFIG.MESSAGES.COMPANIES_SCRAPED:
        JFH_Scraper.handleScrapedData(message.data).then(() => {
          sendResponse({ success: true });
        });
        return true;

      case JFH_CONFIG.MESSAGES.EMAIL_DETECTED:
        JFH_Email.handleEmailDetected(message.data).then(sendResponse);
        return true;

      case JFH_CONFIG.MESSAGES.EMAIL_SENT_CONFIRM:
        JFH_Compose.handleEmailSentConfirm(message.data).then(sendResponse);
        return true;

      case JFH_CONFIG.MESSAGES.SCRAPE_ERROR:
        console.error('[JFH] Scrape error reported:', message.data);
        broadcastState({ error: message.data.error });
        sendResponse({ received: true });
        break;
    }
  });
}

const JFH_Messaging = { sendMessageWithRetry, setupMessageRouter };

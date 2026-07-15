/**
 * Job Founder Hunter - Background Service Worker
 * Orchestrates the entire scraping and emailing workflow
 */

importScripts('../utils/constants.js', '../utils/helpers.js', '../templates/email-templates.js');
// Dynamic import for IndexedDB wrapper since background scripts don't support traditional script injection easily
importScripts('../database/db.js'); 

console.log('[JFH] Service Worker loaded');

// State
let isRunning = false;
let isPaused = false;
let currentTask = null; // 'scraping' | 'emailing' | 'finding' | 'sending_backend'
let targetBatch = [];
let currentIndex = 0;
let findOnlyMode = false; // when true, finding emails does not send
let linkedInSafetyTimer = null; // Track safety timer to cancel on real email detection

// ========== Message Handling ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[JFH] Message received in SW:', message.type);

  switch (message.type) {
    // ---- From Popup ----
    case JFH_CONFIG.MESSAGES.START_SCRAPING:
      startScrapingFlow(message.data).then(sendResponse);
      return true;

    case 'START_BATCH_EMAIL':
      startBatchEmailing().then(sendResponse);
      return true;

    case 'FIND_ALL_EMAILS':
      startFindingEmails().then(sendResponse);
      return true;

    case 'SEND_ALL_BACKEND':
      startSendingViaBackend().then(sendResponse);
      return true;

    case 'SCRAPE_ALL_FOUNDERS':
      startFounderScraping().then(sendResponse);
      return true;

    case 'COMPANY_FOUNDERS_FOUND':
      handleCompanyFounders(message.data).then(sendResponse);
      return true;

    case 'START_SENDING_DRAFTS':
      startSendingDraftsFlow().then(sendResponse);
      return true;

    case 'START_WAS_APPLY':
      startWasApplyFlow(message.data).then(sendResponse);
      return true;

    case 'QUEUE_WAS_JOBS':
      queueWasJobs(message.data).then(sendResponse);
      return true;

    case 'WAS_JOB_APPLIED':
      handleWasJobApplied(message.data).then(sendResponse);
      return true;

    case JFH_CONFIG.MESSAGES.PAUSE_PROCESS:
      isPaused = true;
      broadcastState();
      sendResponse({ success: true });
      break;

    case JFH_CONFIG.MESSAGES.RESUME_PROCESS:
      isPaused = false;
      broadcastState();
      processNextEmail();
      sendResponse({ success: true });
      break;

    case JFH_CONFIG.MESSAGES.STOP_PROCESS:
      isRunning = false;
      isPaused = false;
      currentTask = null;
      broadcastState();
      sendResponse({ success: true });
      break;

    case JFH_CONFIG.MESSAGES.GET_STATS:
      JFH_DB.getStats().then(stats => {
        sendResponse({ stats, state: { isRunning, isPaused, currentTask, progress: targetBatch.length > 0 ? (currentIndex / targetBatch.length * 100) : 0 } });
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
      handleScrapedData(message.data).then(() => {
        sendResponse({ success: true });
      });
      return true;

    case JFH_CONFIG.MESSAGES.EMAIL_DETECTED:
      handleEmailDetected(message.data).then(sendResponse);
      return true;

    case JFH_CONFIG.MESSAGES.EMAIL_SENT_CONFIRM:
      handleEmailSentConfirm(message.data).then(sendResponse);
      return true;

    case JFH_CONFIG.MESSAGES.SCRAPE_ERROR:
      console.error('[JFH] Scrape error reported:', message.data);
      broadcastState({ error: message.data.error });
      sendResponse({ received: true });
      break;
  }
});

// ========== Helper to broadcast state to popup ==========
function broadcastState(extra = {}) {
  chrome.runtime.sendMessage({
    type: 'STATE_UPDATE',
    data: {
      isRunning,
      isPaused,
      currentTask,
      progress: targetBatch.length > 0 ? Math.round((currentIndex / targetBatch.length) * 100) : 0,
      currentIndex,
      totalCount: targetBatch.length,
      ...extra
    }
  }).catch(() => {}); // Ignore error if popup is closed
}

// ========== Setting Management ==========
async function saveSettings(settings) {
  for (const [key, value] of Object.entries(settings)) {
    await JFH_DB.saveSetting(key, value);
  }
  return { success: true };
}

// ========== Polling Helper ==========
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

// ========== Founder Scraping Flow ==========
let founderScrapeQueue = [];
let founderScrapeIndex = 0;
let founderScrapeTabId = null;
let isFounderScraping = false;

async function startFounderScraping() {
  if (isFounderScraping) return { error: 'Already scraping founders' };

  const companies = await JFH_DB.getAllCompanies();
  if (companies.length === 0) return { success: false, message: 'No companies found. Scrape leads first!' };

  // Filter companies that haven't had their detail page scraped
  founderScrapeQueue = companies.filter(c => (c.source === 'yc' || c.source === 'workatastartup') && (c.sourceUrl || c.profileUrl) && !c.foundersScraped);
  founderScrapeIndex = 0;
  isFounderScraping = true;

  console.log(`[JFH] Starting founder scrape for ${founderScrapeQueue.length} companies`);
  broadcastFounderScrapeState();
  processNextCompany();

  return { success: true, count: founderScrapeQueue.length };
}

function broadcastFounderScrapeState(extra = {}) {
  const progress = founderScrapeQueue.length > 0
    ? Math.round((founderScrapeIndex / founderScrapeQueue.length) * 100)
    : 0;

  chrome.runtime.sendMessage({
    type: 'FOUNDER_SCRAPE_UPDATE',
    data: {
      isRunning: isFounderScraping,
      progress,
      current: founderScrapeIndex,
      total: founderScrapeQueue.length,
      ...extra
    }
  }).catch(() => {});
}

async function processNextCompany() {
  if (!isFounderScraping) return;

  if (founderScrapeIndex >= founderScrapeQueue.length) {
    isFounderScraping = false;
    broadcastFounderScrapeState({ message: 'All companies scanned!' });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      title: 'Founder Scan Complete!',
      message: `Scanned ${founderScrapeQueue.length} companies for founders.`
    });
    return;
  }

  const company = founderScrapeQueue[founderScrapeIndex];
  console.log(`[JFH] Scanning company ${founderScrapeIndex + 1}/${founderScrapeQueue.length}: ${company.name}`);
  broadcastFounderScrapeState({ currentCompany: company.name });

  // Close previous tab if still open
  if (founderScrapeTabId) {
    chrome.tabs.remove(founderScrapeTabId).catch(() => {});
    founderScrapeTabId = null;
  }

  // Safety timeout - if no response in 20s, skip to next
  let safetyTimer = setTimeout(() => {
    console.warn('[JFH] Safety timeout for:', company.name);
    if (founderScrapeTabId) {
      chrome.tabs.remove(founderScrapeTabId).catch(() => {});
      founderScrapeTabId = null;
    }
    founderScrapeIndex++;
    broadcastFounderScrapeState();
    setTimeout(processNextCompany, 1000);
  }, 22000);

  // Open company page
  const targetUrl = company.sourceUrl || company.profileUrl;
  chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
    founderScrapeTabId = tab.id;

    // Use polling to send message as soon as content script is ready
    sendMessageWithRetry(tab.id, {
      type: 'SCRAPE_COMPANY_DETAIL',
      data: { companyId: company.id, companyName: company.name }
    }, 15, 1000)
    .then(response => {
      clearTimeout(safetyTimer);
      console.log(`[JFH] Scrape response from ${company.name}:`, response);
      // handleCompanyFounders will call processNextCompany after saving
    })
    .catch(err => {
      clearTimeout(safetyTimer);
      console.warn('[JFH] Content script not ready on:', company.name, err.message);
      // Close tab and skip
      if (founderScrapeTabId) {
        chrome.tabs.remove(founderScrapeTabId).catch(() => {});
        founderScrapeTabId = null;
      }
      founderScrapeIndex++;
      broadcastFounderScrapeState();
      setTimeout(processNextCompany, 1000);
    });
  });
}


async function handleCompanyFounders(data) {
  const { companyId, founders } = data;

  // Prevent race conditions: ignore if we already moved on
  const expectedCompany = founderScrapeQueue[founderScrapeIndex];
  if (!expectedCompany || expectedCompany.id !== companyId) {
    console.warn('[JFH] Ignoring stale company response for:', companyId);
    return { success: false, message: 'Stale response' };
  }

  for (const founder of founders) {
    founder.companyId = companyId;
    await JFH_DB.addFounder(founder);
  }

  console.log(`[JFH] Saved ${founders.length} founders for company ${companyId}`);

  // Mark company as having founders scraped
  const company = await JFH_DB.getCompany(companyId);
  if (company) {
    company.foundersScraped = true;
    await JFH_DB._put('companies', company);
  }

  // Close tab and move to next company
  if (founderScrapeTabId) {
    chrome.tabs.remove(founderScrapeTabId).catch(() => {});
    founderScrapeTabId = null;
  }

  founderScrapeIndex++;
  broadcastFounderScrapeState();
  setTimeout(processNextCompany, 2000);

  return { success: true };
}

// ========== Scraping Flow ==========

async function startScrapingFlow(data) {
  const { source, url } = data; // source: 'yc' | 'wellfound'
  
  chrome.tabs.create({ url, active: true }, (tab) => {
    // Content script will auto-load and inject UI.
    // User clicks the button on the page to trigger scraping, 
    // which then sends COMPANIES_SCRAPED back here.
  });
  
  return { success: true, message: 'Tab opened. Please start scraping from the page.' };
}

async function handleScrapedData(data) {
  const { companies = [], founders = [], source = 'unknown' } = data;
  
  console.log(`[JFH] Saving ${companies.length} companies and ${founders.length} founders`);
  
  // Save companies
  for (const company of companies) {
    await JFH_DB.addCompany(company);
    
    // Auto-generate placeholder founders for platforms that don't have dedicated detail page scrapers
    const platformsNeedingPlaceholders = ['producthunt', 'crunchbase', 'techstars', '500global', 'antler', 'remoteok', 'otta'];
    if (platformsNeedingPlaceholders.includes(company.source) && founders.length === 0) {
      const searchKeywords = encodeURIComponent(`founder CEO ${company.name}`);
      founders.push({
        id: `fnd_${Date.now()}_${company.id}`,
        companyId: company.id,
        companyName: company.name,
        name: 'Founder (Auto-Search)',
        title: 'Founder / CEO',
        linkedinUrl: `https://www.linkedin.com/search/results/people/?keywords=${searchKeywords}`,
        source: company.source,
        contacted: false
      });
    }
  }
  
  // Save founders
  for (const founder of founders) {
    const companyRecords = await JFH_DB.getCompaniesBySource(source);
    // Try to map founder to correct company DB ID
    const matchingCompany = companyRecords.find(c => c.name === founder.companyName);
    
    if (matchingCompany) {
      founder.companyId = matchingCompany.id;
    }
    await JFH_DB.addFounder(founder);
  }
  
  // Trigger notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: '../assets/icon128.png',
    title: 'Scraping Complete',
    message: `Saved ${companies.length} companies and ${founders.length} founders.`
  });
  
  broadcastState();
}

// ========== Phase 1: Find Emails Only (no sending) ==========

async function startFindingEmails() {
  if (isRunning) return { error: 'Already running' };

  const allFounders = await JFH_DB.getAllFounders();

  // Only founders that still need an email discovered
  targetBatch = allFounders.filter(
    (f) => f.linkedinUrl && !f.contacted && !f.emailSearchAttempted && !f.email
  );

  if (targetBatch.length === 0) {
    return { success: false, message: 'No pending founders need email finding.' };
  }

  isRunning = true;
  isPaused = false;
  currentTask = 'finding';
  currentIndex = 0;
  findOnlyMode = true;

  broadcastState();

  processNextEmail();

  return { success: true, count: targetBatch.length };
}

// ========== Phase 3: Send All (via Backend queue) ==========

async function startSendingViaBackend() {
  if (isRunning) return { error: 'Already running' };

  const settings = await JFH_DB.getAllSettings();
  if (settings.emailActionMode !== 'backend') {
    return { success: false, message: 'Please set Email Action to "Send via Backend" first (My Profile).' };
  }

  const allFounders = await JFH_DB.getAllFounders();

  // Founders that have an email and were never contacted
  let batch = allFounders.filter((f) => f.email && !f.contacted);

  // Dedupe: skip emails we've already sent before
  const sentLog = await JFH_DB.getAllEmailsSent();
  const sentEmails = new Set(sentLog.map((e) => (e.email || '').toLowerCase()));
  batch = batch.filter((f) => !sentEmails.has((f.email || '').toLowerCase()));

  if (batch.length === 0) {
    return { success: false, message: 'No unsent emails to send.' };
  }

  isRunning = true;
  isPaused = false;
  currentTask = 'sending_backend';
  currentIndex = 0;
  findOnlyMode = false;
  targetBatch = batch;

  broadcastState();

  // All of these already have emails, so processNextEmail goes straight to backend send
  processNextEmail();

  return { success: true, count: batch.length };
}

// ========== Batch Emailing Flow (The Orchestrator) ==========

async function startBatchEmailing() {
  if (isRunning) return { error: 'Already running' };
  
  // Fetch uncontacted founders who HAVE a LinkedIn URL but NO email yet
  // OR founders who HAVE an email but HAVEN'T been contacted
  const allFounders = await JFH_DB.getAllFounders();
  
  // Filter logic: Needs LinkedIn URL, not contacted yet, and we haven't already failed to find their email
  targetBatch = allFounders.filter(f => f.linkedinUrl && !f.contacted && !f.emailSearchAttempted);
  
  if (targetBatch.length === 0) {
    return { success: false, message: 'No pending founders found with LinkedIn URLs.' };
  }
  
  isRunning = true;
  isPaused = false;
  currentTask = 'emailing';
  currentIndex = 0;
  
  broadcastState();
  
  // Start loop
  processNextEmail();
  
  return { success: true, count: targetBatch.length };
}

async function processNextEmail() {
  if (!isRunning || isPaused) return;
  
  if (currentIndex >= targetBatch.length) {
    // Finished batch
    const doneTask = currentTask;
    isRunning = false;
    currentTask = null;

    const completionMsg =
      doneTask === 'finding'
        ? 'Email finding completed! Review in the Data tab, then Send All via Backend.'
        : doneTask === 'sending_backend'
        ? 'All emails queued to backend for sending!'
        : 'Batch completed!';

    broadcastState({ message: completionMsg });

    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icon128.png',
      title: 'Job Founder Hunter',
      message: completionMsg
    });
    return;
  }
  
  const founder = targetBatch[currentIndex];
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
    currentIndex++;
    setTimeout(processNextEmail, 2000); // Wait and move to next
  }
}

// --- Step 1: LinkedIn Email Finding ---
async function findEmailOnLinkedIn(founder) {
  return new Promise((resolve) => {
    // Open LinkedIn profile
    chrome.tabs.create({ url: founder.linkedinUrl, active: false }, (tab) => {
      founder.currentTabId = tab.id;

      // Safety timeout - if email detection gets completely stuck
      linkedInSafetyTimer = setTimeout(() => {
        console.warn(`[JFH] Safety timeout on LinkedIn for ${founder.name}`);
        if (founder.currentTabId) {
          chrome.tabs.remove(founder.currentTabId).catch(() => {});
        }
        
        // Treat as email not found
        handleEmailDetected({
          founderId: founder.id,
          email: null,
          found: false,
          source: 'timeout'
        });
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
        if (linkedInSafetyTimer) { clearTimeout(linkedInSafetyTimer); linkedInSafetyTimer = null; }
        if (founder.currentTabId) {
          chrome.tabs.remove(founder.currentTabId).catch(() => {});
        }
        
        // Skip and move to next
        handleEmailDetected({
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
  if (linkedInSafetyTimer) {
    clearTimeout(linkedInSafetyTimer);
    linkedInSafetyTimer = null;
  }

  let founder = null;

  if (founderId && targetBatch.length > 0) {
    // Attempt to find in active batch
    let founderIdx = targetBatch.findIndex(f => f.id === founderId);
    if (founderIdx !== -1) {
      founder = targetBatch[founderIdx];
      currentIndex = founderIdx; // Re-sync currentIndex
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
    return { success: false, message: 'Founder not found' };
  }

  console.log(`[JFH] handleEmailDetected for ${founder.name}: found=${found}, email=${email}, source=${source}`);

  // Close the exact LinkedIn tab we opened
  if (founder && founder.currentTabId) {
    chrome.tabs.remove(founder.currentTabId).catch(e => console.log('Tab already closed:', e));
  }

  if (found && email) {
    // Update DB
    await JFH_DB.updateFounderEmail(founderId, email);
    founder.email = email;

    if (findOnlyMode) {
      // Phase 1: only collect emails, do not send
      console.log(`[JFH] Email found for ${founder.name}: ${email}`);
      broadcastState({ currentFounder: `Found email for ${founder.name}` });
      currentIndex++;
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
    currentIndex++;
    setTimeout(processNextEmail, JFH_CONFIG.DELAYS.BETWEEN_LINKEDIN);
  }
  
  return { success: true };
}

// --- Step 2: Gmail Compose ---
async function openGmailCompose(founder) {
  // Get settings for template rendering
  const settings = await JFH_DB.getAllSettings();
  const templateId = settings.selectedTemplate || 'professional';
  
  const templateData = {
    founder_name: founder.name.split(' ')[0], // First name
    company_name: founder.companyName,
    founder_title: founder.title || founder.role,
    your_name: settings.userName || '[Your Name]',
    your_skills: settings.userSkills || '[Your Skills]',
    resume_link: settings.resumeLink || '[Link]',
    position: settings.targetPosition || '[Position]',
    your_email: settings.userEmail || ''
  };
  
  const emailContent = JFH_Templates.render(templateId, templateData);
  if (!emailContent) {
    console.error('[JFH] Template render failed');
    currentIndex++;
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
    const res = await JFH_Helpers.sendEmailViaBackend({
      to: founder.email,
      subject: emailContent.subject,
      body: emailContent.body,
      replyTo: settings.userEmail,
      founderId: founder.id,
    }, auth);

    if (res.success) {
      console.log(`[JFH] Queued email for ${founder.name} -> ${founder.email}`);
      const trackId = res.jobs && res.jobs[0] ? res.jobs[0].trackId : null;
      if (trackId) {
        founder.trackingId = trackId;
        try { await JFH_DB.updateFounder(founder); } catch (e) { console.warn('[JFH] could not save trackingId', e); }
      }
      await handleBackendSent(founder, founder.email, emailContent, settings);
    } else {
      console.error(`[JFH] Backend send failed for ${founder.name}:`, res.message);
      // Fallback: open Gmail compose so the user can send manually
      broadcastState({ currentFounder: `Backend failed for ${founder.name}, opening Gmail...` });
      openGmailTab(founder, emailContent, settings);
    }
    return;
  }

  // === Mode: Gmail (draft / send) ===
  openGmailTab(founder, emailContent, settings);
}

function openGmailTab(founder, emailContent, settings) {
  // Open Gmail tab with pre-filled parameters (100% reliable, no DOM typing needed)
  const encodedTo = encodeURIComponent(founder.email);
  const encodedSubject = encodeURIComponent(emailContent.subject);
  const encodedBody = encodeURIComponent(emailContent.body);
  
  const gmailComposeUrl = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;

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
  });
}

// Called when an email is successfully queued via the backend
async function handleBackendSent(founder, email, emailContent, settings) {
  await JFH_DB.markFounderContacted(founder.id);
  await JFH_DB.logEmailSent({
    founderId: founder.id,
    founderName: founder.name,
    companyName: founder.companyName,
    email,
    subject: emailContent?.subject || '',
    templateUsed: settings?.selectedTemplate || 'professional',
    trackingId: founder.trackingId || '',
  });
  currentIndex++;
  setTimeout(processNextEmail, JFH_CONFIG.DELAYS.BETWEEN_EMAILS);
}

// --- Step 3: Bulk Sending Drafts Flow ---
async function startSendingDraftsFlow() {
  if (isRunning) return { error: 'Already running' };
  
  isRunning = true;
  isPaused = false;
  currentTask = 'sending_drafts';
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
  const currentBatchFounder = targetBatch[currentIndex];
  
  if (success) {
    // Update DB
    await JFH_DB.markFounderContacted(founderId);
    
    // Log sent email
    const settings = await JFH_DB.getAllSettings();
    
    await JFH_DB.logEmailSent({
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
    currentIndex++;
    setTimeout(processNextEmail, JFH_CONFIG.DELAYS.BETWEEN_EMAILS);
  }, 2000);
  
  return { success: true };
}

// Listen for completion of bulk draft sending
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BULK_DRAFTS_COMPLETED') {
    isRunning = false;
    currentTask = null;
    broadcastState({ message: 'All drafts sent!' });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../assets/icon128.png',
      title: 'Drafts Sent',
      message: `Successfully sent ${message.data.count} drafts.`
    });
    
    if (sender.tab) {
      chrome.tabs.remove(sender.tab.id).catch(e => console.log(e));
    }
  }
});

// ========== WorkAtAStartup Auto-Apply Flow ==========
let wasApplyQueue = [];
let wasApplyIndex = 0;
let wasApplyTabId = null;
let isWasApplying = false;

async function startWasApplyFlow({ jobs, settings }) {
  if (isWasApplying) return { error: 'Already applying to jobs' };
  if (!jobs || jobs.length === 0) return { error: 'No jobs provided' };

  wasApplyQueue = jobs;
  wasApplyIndex = 0;
  isWasApplying = true;

  console.log(`[JFH] Starting WAS auto-apply for ${jobs.length} jobs`);
  broadcastWasState();
  processNextWasJob(settings);

  return { success: true, count: jobs.length };
}

function broadcastWasState(extra = {}) {
  const progress = wasApplyQueue.length > 0
    ? Math.round((wasApplyIndex / wasApplyQueue.length) * 100)
    : 0;

  chrome.runtime.sendMessage({
    type: 'WAS_APPLY_UPDATE',
    data: {
      isRunning: isWasApplying,
      progress,
      current: wasApplyIndex,
      total: wasApplyQueue.length,
      ...extra
    }
  }).catch(() => {});
}

async function processNextWasJob(settings) {
  if (!isWasApplying) return;

  if (wasApplyIndex >= wasApplyQueue.length) {
    isWasApplying = false;
    if (wasApplyTabId) {
      chrome.tabs.remove(wasApplyTabId).catch(() => {});
      wasApplyTabId = null;
    }
    broadcastWasState({ message: 'All jobs applied!' });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/assets/icon128.png',
      title: 'Auto-Apply Complete!',
      message: `Applied to ${wasApplyQueue.length} jobs on WorkAtAStartup.`
    });
    return;
  }

  const job = wasApplyQueue[wasApplyIndex];
  console.log(`[JFH] Applying to job ${wasApplyIndex + 1}/${wasApplyQueue.length}: ${job.jobTitle} at ${job.companyName}`);
  broadcastWasState({ currentJob: `${job.jobTitle} @ ${job.companyName}` });

  // Close previous tab
  if (wasApplyTabId) {
    chrome.tabs.remove(wasApplyTabId).catch(() => {});
    wasApplyTabId = null;
  }

  // Safety timeout: 30 seconds per job
  let safetyTimer = setTimeout(() => {
    console.warn('[JFH] Safety timeout for WAS job:', job.jobTitle);
    if (wasApplyTabId) {
      chrome.tabs.remove(wasApplyTabId).catch(() => {});
      wasApplyTabId = null;
    }
    wasApplyIndex++;
    broadcastWasState();
    setTimeout(() => processNextWasJob(settings), 1000);
  }, 30000);

  // Open the job page
  chrome.tabs.create({ url: job.jobUrl, active: false }, (tab) => {
    wasApplyTabId = tab.id;

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
            chrome.tabs.update(wasApplyTabId, { url: result.companyProfileUrl }, resolve);
          });
          
          // Poll until the new page is ready and extract founders
          try {
            const scrapeResult = await sendMessageWithRetry(wasApplyTabId, {
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
      if (wasApplyTabId) {
        chrome.tabs.remove(wasApplyTabId).catch(() => {});
        wasApplyTabId = null;
      }

      wasApplyIndex++;
      broadcastWasState();
      // Human-like delay between applications (5-10 seconds)
      setTimeout(() => processNextWasJob(settings), 5000 + Math.random() * 5000);
    })
    .catch(err => {
      clearTimeout(safetyTimer);
      console.warn('[JFH] Could not apply to job:', job.jobTitle, err.message);
      if (wasApplyTabId) {
        chrome.tabs.remove(wasApplyTabId).catch(() => {});
        wasApplyTabId = null;
      }
      wasApplyIndex++;
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


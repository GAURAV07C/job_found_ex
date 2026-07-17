/**
 * Job Founder Hunter - Home Module
 */

function initHome({ updateStats, updateUIState, runSwTask, refreshBackendSendButton }) {
  // Update stats on load
  updateStats();

  // Scrape Buttons
  const platformUrls = {
    'btn-scrape-was-companies': 'https://www.workatastartup.com/companies?demographic=any&hasEquity=any&hasSalary=any&industry=any&interviewProcess=any&jobType=any&layout=list-compact&sortBy=created_desc&tab=any&usVisaNotRequired=any',
    'btn-scrape-was-jobs': 'https://www.workatastartup.com/jobs/r/software-engineer',
    'btn-scrape-yc': 'https://www.ycombinator.com/companies',
    'btn-scrape-wf': 'https://www.wellfound.com/jobs',
    'btn-scrape-ph': 'https://www.producthunt.com/leaderboard/daily',
    'btn-scrape-cb': 'https://www.crunchbase.com/discover/organization.companies',
    'btn-scrape-ts': 'https://www.techstars.com/portfolio',
    'btn-scrape-500': 'https://500.co/portfolio',
    'btn-scrape-antler': 'https://www.antler.co/portfolio',
    'btn-scrape-remoteok': 'https://remoteok.com/',
    'btn-scrape-otta': 'https://otta.com/jobs'
  };

  Object.entries(platformUrls).forEach(([id, url]) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        chrome.tabs.create({ url });
        window.close();
      });
    }
  });

  // Batch Process Buttons
  const startBtn = document.getElementById('btn-start-batch');
  const pauseBtn = document.getElementById('btn-pause-batch');
  const stopBtn = document.getElementById('btn-stop-batch');

  startBtn.addEventListener('click', async () => {
    const settings = await JFH_DB.getAllSettings();
    if (!settings.userName || !settings.userEmail || !settings.resumeLink) {
      alert("Please configure and verify your Profile first!");
      document.querySelector('.tab-btn[data-tab="profile"]')?.click();
      return;
    }

    chrome.runtime.sendMessage({ type: 'START_BATCH_EMAIL' }, (response) => {
      if (response && response.success) {
        updateUIState(true, false, 0, response.count, 'Starting...');
      } else {
        alert(response?.message || 'Failed to start batch');
      }
    });
  });

  pauseBtn.addEventListener('click', () => {
    const isPausing = pauseBtn.textContent === 'Pause';
    chrome.runtime.sendMessage({
      type: isPausing ? JFH_CONFIG.MESSAGES.PAUSE_PROCESS : JFH_CONFIG.MESSAGES.RESUME_PROCESS
    });
    pauseBtn.textContent = isPausing ? 'Resume' : 'Pause';
    pauseBtn.className = isPausing ? 'btn primary' : 'btn warning';
  });

  stopBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: JFH_CONFIG.MESSAGES.STOP_PROCESS });
    updateUIState(false, false);
  });

  const sendDraftsBtn = document.getElementById('btn-send-drafts');
  sendDraftsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to open and SEND all pending drafts? Make sure you have reviewed them!')) {
      chrome.runtime.sendMessage({ type: 'START_SENDING_DRAFTS' }, (response) => {
        if (response && response.success) {
          alert('Batch sending drafts started!');
        }
      });
    }
  });

  // Find Founders Button
  const findFoundersBtn = document.getElementById('btn-find-founders');
  const foundersProgressCont = document.getElementById('founders-progress-container');

  findFoundersBtn.addEventListener('click', async () => {
    const stats = await JFH_DB.getStats();
    if (stats.totalCompanies === 0) {
      alert('No companies found! Please scrape YC or Wellfound first.');
      return;
    }
    findFoundersBtn.disabled = true;
    findFoundersBtn.textContent = '⏳ Scanning...';
    foundersProgressCont.style.display = 'block';

    chrome.runtime.sendMessage({ type: 'SCRAPE_ALL_FOUNDERS' }, (response) => {
      if (response && !response.success) {
        alert(response.message || 'Failed to start founder scan');
        findFoundersBtn.disabled = false;
        findFoundersBtn.textContent = '🔍 Find All Founders';
        foundersProgressCont.style.display = 'none';
      }
    });
  });

  // New 3-phase backend flow
  const findEmailsBtn = document.getElementById('btn-find-emails');
  const findEmailsMmBtn = document.getElementById('btn-find-emails-mm');
  const sendBackendBtn = document.getElementById('btn-send-backend');

  if (findEmailsBtn) {
    findEmailsBtn.addEventListener('click', () => runSwTask('FIND_ALL_EMAILS', 'Finding emails...'));
  }
  if (findEmailsMmBtn) {
    findEmailsMmBtn.addEventListener('click', () => runSwTask('FIND_ALL_EMAILS_MAILMETEOR', 'Finding emails (Mailmeteor)...'));
  }
  if (sendBackendBtn) {
    sendBackendBtn.addEventListener('click', async () => {
      const founders = await JFH_DB.getAllFounders();
      const sentLog = await JFH_DB.getAllEmailsSent();
      const sentEmails = new Set(sentLog.map((e) => (e.email || '').toLowerCase()));
      const eligible = founders.filter((f) => f.email && !f.contacted && !sentEmails.has((f.email || '').toLowerCase()));

      if (eligible.length === 0) {
        alert('No new founders to email. All have already been contacted or emailed.');
        return;
      }

      runSwTask('SEND_ALL_BACKEND', `Queuing ${eligible.length} emails to backend...`);
    });
  }

  // Refresh count when tab becomes active
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab === 'home' || btn.dataset.tab === 'data') {
        setTimeout(refreshBackendSendButton, 300);
      }
    });
  });

  async function refreshBackendSendButton() {
    const sendBtn = document.getElementById('btn-send-backend');
    const dataSendBtn = document.getElementById('btn-data-send-backend');
    if (!sendBtn && !dataSendBtn) return;

    try {
      const founders = await JFH_DB.getAllFounders();
      const sentLog = await JFH_DB.getAllEmailsSent();
      const sentEmails = new Set(sentLog.map((e) => (e.email || '').toLowerCase()));

      const withEmail = founders.filter((f) => f.email);
      const contacted = withEmail.filter((f) => f.contacted).length;
      const alreadySent = withEmail.filter((f) => sentEmails.has((f.email || '').toLowerCase())).length;
      const eligible = withEmail.filter((f) => !f.contacted && !sentEmails.has((f.email || '').toLowerCase())).length;

      const total = withEmail.length;
      const label = `🚀 Step 2: Send All via Backend (${total} with email, ${eligible} new, ${contacted} contacted, ${alreadySent} already sent)`;
      if (sendBtn) { sendBtn.textContent = label; sendBtn.disabled = total === 0; }
      if (dataSendBtn) { dataSendBtn.textContent = `🚀 Send All (Backend) (${total})`; dataSendBtn.disabled = total === 0; }
    } catch (e) {
      console.warn('[UI] could not refresh backend send count:', e);
    }
  }

  // Expose for external refresh
  window.__JFH_REFRESH_BACKEND_COUNT = refreshBackendSendButton;
}

window.JFH_Home = { initHome };

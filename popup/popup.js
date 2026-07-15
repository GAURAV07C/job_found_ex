/**
 * Job Founder Hunter - Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize Database
  await JFH_DB.init();
  
  // --- Tab Navigation ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = `tab-${btn.dataset.tab}`;
      document.getElementById(tabId).classList.add('active');
      
      if (btn.dataset.tab === 'data') loadDataView();
      if (btn.dataset.tab === 'home') updateStats();
      if (btn.dataset.tab === 'dashboard') loadDashboard();
    });
  });

  // --- Home Tab Logic ---
  
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
  const controlsDiv = document.getElementById('batch-controls');
  const progressCont = document.getElementById('batch-progress-container');

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
  
  startBtn.addEventListener('click', async () => {
    // Check if settings exist
    const settings = await JFH_DB.getAllSettings();
    if (!settings.userName || !settings.userEmail || !settings.resumeLink) {
      alert("Please configure and verify your Profile first!");
      document.querySelector('.tab-btn[data-tab="profile"]').click();
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

  // --- New 3-phase backend flow ---
  function runSwTask(type, successText) {
    const statusText = document.getElementById('batch-status-text');
    const statusContainer = document.getElementById('batch-progress-container');
    chrome.runtime.sendMessage({ type }, (response) => {
      if (response && !response.success && response.message) {
        if (statusContainer) statusContainer.style.display = 'block';
        if (statusText) statusText.textContent = '❌ ' + response.message;
      } else if (response && response.success) {
        updateUIState(true, false, 0, response.count, successText);
        document.querySelector('.tab-btn[data-tab="home"]').click();
      }
    });
  }

  const findEmailsBtn = document.getElementById('btn-find-emails');
  const sendBackendBtn = document.getElementById('btn-send-backend');
  const dataFindEmailsBtn = document.getElementById('btn-data-find-emails');
  const dataSendBackendBtn = document.getElementById('btn-data-send-backend');
  const refreshTrackingBtn = document.getElementById('btn-refresh-tracking');

  if (findEmailsBtn) findEmailsBtn.addEventListener('click', () => runSwTask('FIND_ALL_EMAILS', 'Finding emails...'));
  if (sendBackendBtn) sendBackendBtn.addEventListener('click', () => runSwTask('SEND_ALL_BACKEND', 'Queuing emails to backend...'));
  if (dataFindEmailsBtn) dataFindEmailsBtn.addEventListener('click', () => runSwTask('FIND_ALL_EMAILS', 'Finding emails...'));
  if (dataSendBackendBtn) dataSendBackendBtn.addEventListener('click', () => runSwTask('SEND_ALL_BACKEND', 'Queuing emails to backend...'));
  if (refreshTrackingBtn) refreshTrackingBtn.addEventListener('click', () => {
    loadDataView();
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

  // Listen for state updates from Service Worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'STATE_UPDATE') {
      const { isRunning, isPaused, progress, currentIndex, totalCount, currentFounder, message } = msg.data;
      
      let statusText = '';
      if (message) statusText = message;
      else if (isPaused) statusText = 'Paused';
      else if (currentFounder) statusText = `Processing: ${currentFounder}`;
      else if (isRunning) statusText = 'Running...';
      
      updateUIState(isRunning, isPaused, progress, totalCount, statusText);
      updateStats();
    }

    if (msg.type === 'FOUNDER_SCRAPE_UPDATE') {
      const { isRunning, progress, current, total, currentCompany, message } = msg.data;
      foundersProgressCont.style.display = isRunning ? 'block' : 'none';

      if (isRunning) {
        document.getElementById('founders-progress-fill').style.width = `${progress}%`;
        document.getElementById('founders-progress-text').textContent = `${progress}%`;
        document.getElementById('founders-status-text').textContent =
          currentCompany ? `(${current}/${total}) ${currentCompany}` : (message || 'Scanning...');
        findFoundersBtn.textContent = '⏳ Scanning...';
        findFoundersBtn.disabled = true;
      } else {
        findFoundersBtn.disabled = false;
        findFoundersBtn.textContent = '🔍 Find All Founders';
        document.getElementById('founders-status-text').textContent = message || 'Done!';
        document.getElementById('founders-progress-text').textContent = '100%';
        document.getElementById('founders-progress-fill').style.width = '100%';
        updateStats();
      }
    }
  });

  // Request initial state
  chrome.runtime.sendMessage({ type: JFH_CONFIG.MESSAGES.GET_STATS }, (response) => {
    if (response && response.state) {
      updateUIState(
        response.state.isRunning,
        response.state.isPaused,
        response.state.progress,
        0, // total count not available in basic stats response
        response.state.isRunning ? (response.state.isPaused ? 'Paused' : 'Running...') : ''
      );
    }
  });

  function updateUIState(isRunning, isPaused, progress = 0, total = 0, statusText = '') {
    startBtn.style.display = isRunning ? 'none' : 'block';
    controlsDiv.style.display = isRunning ? 'grid' : 'none';
    progressCont.style.display = isRunning ? 'block' : 'none';
    
    if (isRunning) {
      document.getElementById('batch-progress-fill').style.width = `${progress}%`;
      document.getElementById('batch-progress-text').textContent = `${Math.round(progress)}%`;
      if (statusText) document.getElementById('batch-status-text').textContent = statusText;
    }
    
    if (isPaused) {
      pauseBtn.textContent = 'Resume';
      pauseBtn.className = 'btn primary';
    } else {
      pauseBtn.textContent = 'Pause';
      pauseBtn.className = 'btn warning';
    }
  }

  async function updateStats() {
    const stats = await JFH_DB.getStats();
    document.getElementById('stat-companies').textContent = stats.totalCompanies;
    document.getElementById('stat-founders').textContent = stats.totalFounders;
    document.getElementById('stat-with-email').textContent = stats.foundersWithEmail;
    document.getElementById('stat-contacted').textContent = stats.foundersContacted;
    
    // Also update UI state if we have a lot of founders to process
    if (stats.totalCompanies > 0) {
      document.getElementById('btn-find-founders').disabled = false;
    }
  }

  // --- Profile Tab Logic ---
  const templateSelect = document.getElementById('set-template');
  
  function renderTemplateOptions() {
    templateSelect.innerHTML = '';
    JFH_Templates.getTemplateSummaries().forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      templateSelect.appendChild(opt);
    });
  }

  // Load existing profile & templates
  const settings = await JFH_DB.getAllSettings();
  
  // Load custom templates if they exist
  if (settings.customTemplates) {
    try {
      JFH_Templates.loadCustomTemplates(JSON.parse(settings.customTemplates));
    } catch (e) { console.error(e); }
  }
  renderTemplateOptions();

  if (settings.userName) document.getElementById('set-name').value = settings.userName;
  if (settings.userEmail) document.getElementById('set-email').value = settings.userEmail;
  if (settings.targetPosition) document.getElementById('set-position').value = settings.targetPosition;
  if (settings.userSkills) document.getElementById('set-skills').value = settings.userSkills;
  if (settings.resumeLink) document.getElementById('set-resume').value = settings.resumeLink;
  if (settings.portfolioLink) document.getElementById('set-portfolio').value = settings.portfolioLink;
  if (settings.githubLink) document.getElementById('set-github').value = settings.githubLink;
  if (settings.linkedinLink) document.getElementById('set-linkedin').value = settings.linkedinLink;
  if (settings.emailActionMode) document.getElementById('set-action-mode').value = settings.emailActionMode;
  if (settings.selectedTemplate) {
    // Check if it exists in dropdown
    if (Array.from(templateSelect.options).some(o => o.value === settings.selectedTemplate)) {
      templateSelect.value = settings.selectedTemplate;
    }
  }

  // Load new fields
  if (settings.experience) document.getElementById('set-experience').value = settings.experience;
  if (settings.availability) document.getElementById('set-availability').value = settings.availability;
  if (settings.workMode) document.getElementById('set-work-mode').value = settings.workMode;
  if (settings.salary) document.getElementById('set-salary').value = settings.salary;

  if (settings.wasTplFrontend) document.getElementById('was-tpl-frontend').value = settings.wasTplFrontend;
  if (settings.wasTplBackend) document.getElementById('was-tpl-backend').value = settings.wasTplBackend;
  if (settings.wasTplFullstack) document.getElementById('was-tpl-fullstack').value = settings.wasTplFullstack;
  if (settings.wasTplDefault) document.getElementById('was-tpl-default').value = settings.wasTplDefault;

  if (settings.qaWhyCompany) document.getElementById('qa-why-company').value = settings.qaWhyCompany;
  if (settings.qaAboutMe) document.getElementById('qa-about-me').value = settings.qaAboutMe;
  if (settings.qaLookingFor) document.getElementById('qa-looking-for').value = settings.qaLookingFor;
  if (settings.qaAchievement) document.getElementById('qa-achievement').value = settings.qaAchievement;
  const backendUrlInput = document.getElementById('set-backend-url');
  const backendKeyInput = document.getElementById('set-backend-key');
  backendUrlInput.value = settings.backendUrl || JFH_CONFIG.BACKEND.DEFAULT_URL;
  backendKeyInput.value = settings.backendApiKey || JFH_CONFIG.BACKEND.DEFAULT_API_KEY;

  // Custom Template Logic
  const toggleTpl = document.getElementById('toggle-custom-template');
  const tplBuilder = document.getElementById('custom-template-builder');
  toggleTpl.addEventListener('click', () => {
    tplBuilder.style.display = tplBuilder.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('btn-save-custom-tpl').addEventListener('click', async () => {
    const name = document.getElementById('custom-tpl-name').value;
    const subject = document.getElementById('custom-tpl-subject').value;
    const body = document.getElementById('custom-tpl-body').value;
    
    if (!name || !subject || !body) {
      alert("Please fill all template fields!");
      return;
    }

    const newTpl = {
      id: 'custom_' + Date.now(),
      name: '🛠️ ' + name,
      description: 'Custom User Template',
      subject,
      body
    };

    const allCustom = [...JFH_Templates.customTemplates, newTpl];
    JFH_Templates.loadCustomTemplates(allCustom);
    await JFH_DB.saveSetting('customTemplates', JSON.stringify(allCustom));
    
    renderTemplateOptions();
    templateSelect.value = newTpl.id;
    tplBuilder.style.display = 'none';
    
    // clear fields
    document.getElementById('custom-tpl-name').value = '';
    document.getElementById('custom-tpl-subject').value = '';
    document.getElementById('custom-tpl-body').value = '';
  });

  // Email Preview Logic
  const previewBtn = document.getElementById('btn-preview-email');
  const previewBox = document.getElementById('email-preview-box');

  previewBtn.addEventListener('click', () => {
    const templateId = document.getElementById('set-template').value;
    const dummyData = {
      founder_name: 'Alex',
      company_name: 'Acme Startup',
      founder_title: 'CEO',
      your_name: document.getElementById('set-name').value || '[Your Name]',
      your_skills: document.getElementById('set-skills').value || '[Skills]',
      resume_link: document.getElementById('set-resume').value || '[Resume]',
      portfolio_link: document.getElementById('set-portfolio').value || '[Portfolio]',
      github_link: document.getElementById('set-github').value || '[GitHub]',
      linkedin_link: document.getElementById('set-linkedin').value || '[LinkedIn]',
      position: document.getElementById('set-position').value || '[Position]',
      your_email: document.getElementById('set-email').value || '[Your Email]'
    };

    const rendered = JFH_Templates.render(templateId, dummyData);

    if (previewBox.style.display === 'block') {
      previewBox.style.display = 'none';
    } else {
      previewBox.innerHTML = `<strong>Subject:</strong> ${rendered.subject}<br><br>${rendered.body}`;
      previewBox.style.display = 'block';
    }
  });

  // Send Test Mail to Self
  const testMailBtn = document.getElementById('btn-test-mail');
  const testMailStatus = document.getElementById('test-mail-status');

  const buildTestMail = () => {
    const userEmail = document.getElementById('set-email').value.trim();
    const templateId = document.getElementById('set-template').value;
    const dummyData = {
      founder_name: 'Alex',
      company_name: 'Acme Startup',
      founder_title: 'CEO',
      your_name: document.getElementById('set-name').value || '[Your Name]',
      your_skills: document.getElementById('set-skills').value || '[Skills]',
      resume_link: document.getElementById('set-resume').value || '[Resume]',
      portfolio_link: document.getElementById('set-portfolio').value || '[Portfolio]',
      github_link: document.getElementById('set-github').value || '[GitHub]',
      linkedin_link: document.getElementById('set-linkedin').value || '[LinkedIn]',
      position: document.getElementById('set-position').value || '[Position]',
      your_email: userEmail
    };
    const rendered = JFH_Templates.render(templateId, dummyData);
    return { userEmail, rendered };
  };

  testMailBtn.addEventListener('click', async () => {
    const { userEmail, rendered } = buildTestMail();

    if (!userEmail || !userEmail.includes('@')) {
      testMailStatus.textContent = '⚠️ Please enter a valid email address first (Personal Details > Email Address).';
      testMailStatus.style.display = 'block';
      return;
    }
    if (!rendered) {
      testMailStatus.textContent = '⚠️ Could not render template.';
      testMailStatus.style.display = 'block';
      return;
    }

    const subject = `[TEST] ${rendered.subject}`;
    const body = rendered.body;

    // Always send through the backend queue (with open + click tracking).
    const auth = {
      backendUrl: document.getElementById('set-backend-url').value || JFH_CONFIG.BACKEND.DEFAULT_URL,
      apiKey: document.getElementById('set-backend-key').value || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
    };
    console.log('[test mail] backendUrl:', auth.backendUrl);
    console.log('[test mail] apiKey set:', !!auth.apiKey);

    testMailStatus.textContent = '⏳ Sending test mail via backend...';
    testMailStatus.style.display = 'block';
    const res = await JFH_Helpers.sendEmailViaBackend(
      { to: userEmail, subject, body, replyTo: userEmail },
      auth
    );
    console.log('[test mail] backend response:', res);

    if (res.success) {
      testMailStatus.textContent = `✅ Test mail queued! (${res.queued} email(s)) Tracking active. It will arrive at ${userEmail}.`;
    } else {
      // Fallback: open Gmail compose so the user can send manually
      console.warn('[test mail] backend failed, falling back to Gmail:', res.message);
      const encodedTo = encodeURIComponent(userEmail);
      const encodedSubject = encodeURIComponent(subject);
      const encodedBody = encodeURIComponent(body);
      const gmailComposeUrl = `https://mail.google.com/mail/u/0/?view=cm&fs=1&to=${encodedTo}&su=${encodedSubject}&body=${encodedBody}`;
      chrome.tabs.create({ url: gmailComposeUrl, active: true });
      testMailStatus.textContent = '⚠️ Backend unavailable (' + (res.message || '') + '). Opened Gmail draft instead — no tracking.';
    }
    testMailStatus.style.display = 'block';
  });

  // Custom test email input
  const testMailCustomBtn = document.getElementById('btn-test-mail-custom');
  const testMailToInput = document.getElementById('test-mail-to');
  if (testMailCustomBtn && testMailToInput) {
    testMailCustomBtn.addEventListener('click', async () => {
      const to = testMailToInput.value.trim();
      if (!to || !to.includes('@')) {
        testMailStatus.textContent = '⚠️ Please enter a valid email address.';
        testMailStatus.style.display = 'block';
        return;
      }
      const templateId = document.getElementById('set-template').value;
      const dummyData = {
        founder_name: 'Alex',
        company_name: 'Acme Startup',
        founder_title: 'CEO',
        your_name: document.getElementById('set-name').value || '[Your Name]',
        your_skills: document.getElementById('set-skills').value || '[Skills]',
        resume_link: document.getElementById('set-resume').value || '[Resume]',
        portfolio_link: document.getElementById('set-portfolio').value || '[Portfolio]',
        github_link: document.getElementById('set-github').value || '[GitHub]',
        linkedin_link: document.getElementById('set-linkedin').value || '[LinkedIn]',
        position: document.getElementById('set-position').value || '[Position]',
        your_email: document.getElementById('set-email').value || '[Your Email]'
      };
      const rendered = JFH_Templates.render(templateId, dummyData);
      if (!rendered) {
        testMailStatus.textContent = '⚠️ Could not render template.';
        testMailStatus.style.display = 'block';
        return;
      }

      const subject = `[TEST] ${rendered.subject}`;
      const body = rendered.body;
      const auth = {
        backendUrl: document.getElementById('set-backend-url').value || JFH_CONFIG.BACKEND.DEFAULT_URL,
        apiKey: document.getElementById('set-backend-key').value || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
      };
      testMailStatus.textContent = '⏳ Sending test mail to ' + to + '...';
      testMailStatus.style.display = 'block';
      const res = await JFH_Helpers.sendEmailViaBackend(
        { to, subject, body, replyTo: document.getElementById('set-email').value },
        auth
      );
      if (res.success) {
        testMailStatus.textContent = `✅ Test mail queued to ${to}! (${res.queued} email(s)) Tracking active.`;
      } else {
        testMailStatus.textContent = '❌ ' + (res.message || 'Backend send failed.');
      }
      testMailStatus.style.display = 'block';
    });
  }

  // Test Backend Connection
  const testBackendBtn = document.getElementById('btn-test-backend');
  const backendStatus = document.getElementById('backend-test-status');
  testBackendBtn.addEventListener('click', async () => {
    const auth = {
      backendUrl: document.getElementById('set-backend-url').value || JFH_CONFIG.BACKEND.DEFAULT_URL,
      apiKey: document.getElementById('set-backend-key').value || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
    };
    backendStatus.textContent = '⏳ Connecting...';
    backendStatus.style.display = 'block';
    const ok = await JFH_Helpers.pingBackend(auth);
    backendStatus.textContent = ok
      ? '✅ Backend connected!'
      : '❌ Backend not reachable. Is the server running? (node server/src/server.js)';
    backendStatus.style.color = ok ? 'var(--primary)' : '#ff6b6b';
    backendStatus.style.display = 'block';
  });

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const newSettings = {
      userName: document.getElementById('set-name').value,
      userEmail: document.getElementById('set-email').value,
      targetPosition: document.getElementById('set-position').value,
      userSkills: document.getElementById('set-skills').value,
      resumeLink: document.getElementById('set-resume').value,
      portfolioLink: document.getElementById('set-portfolio').value,
      githubLink: document.getElementById('set-github').value,
      linkedinLink: document.getElementById('set-linkedin').value,
      emailActionMode: document.getElementById('set-action-mode').value,
      selectedTemplate: document.getElementById('set-template').value,
      // Backend mail server
      backendUrl: document.getElementById('set-backend-url').value || JFH_CONFIG.BACKEND.DEFAULT_URL,
      backendApiKey: document.getElementById('set-backend-key').value || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
      // New fields
      experience: document.getElementById('set-experience').value,
      availability: document.getElementById('set-availability').value,
      workMode: document.getElementById('set-work-mode').value,
      salary: document.getElementById('set-salary').value,
      // WaaS templates
      wasTplFrontend: document.getElementById('was-tpl-frontend').value,
      wasTplBackend: document.getElementById('was-tpl-backend').value,
      wasTplFullstack: document.getElementById('was-tpl-fullstack').value,
      wasTplDefault: document.getElementById('was-tpl-default').value,
      // Q&A
      qaWhyCompany: document.getElementById('qa-why-company').value,
      qaAboutMe: document.getElementById('qa-about-me').value,
      qaLookingFor: document.getElementById('qa-looking-for').value,
      qaAchievement: document.getElementById('qa-achievement').value,
      qaWhyLeaving: document.getElementById('qa-why-leaving').value,
    };
    
    for (const [key, value] of Object.entries(newSettings)) {
      await JFH_DB.saveSetting(key, value);
    }
    
    const msg = document.getElementById('profile-save-msg');
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2500);
  });

  // --- Data Tab Logic ---
  let currentDataView = 'founders';
  
  document.querySelectorAll('.data-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.data-tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentDataView = e.target.dataset.view;
      loadDataView();
    });
  });

  async function loadDataView() {
    const listEl = document.getElementById('data-list-view');
    listEl.innerHTML = '<div class="empty-state">Loading...</div>';
    
    if (currentDataView === 'founders') {
      const founders = await JFH_DB.getAllFounders();
      if (founders.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No founders scraped yet.</div>';
        return;
      }
      
      listEl.innerHTML = '';
      // Render a founder's email using the currently selected template
      async function renderFounderEmail(founder) {
        const s = await JFH_DB.getAllSettings();
        const templateId = s.selectedTemplate || 'professional';
        const data = {
          founder_name: (founder.name || '').split(' ')[0],
          company_name: founder.companyName || '',
          founder_title: founder.title || founder.role || '',
          your_name: s.userName || '',
          your_skills: s.userSkills || '',
          resume_link: s.resumeLink || '',
          portfolio_link: s.portfolioLink || '',
          github_link: s.githubLink || '',
          linkedin_link: s.linkedinLink || '',
          position: s.targetPosition || '',
          your_email: s.userEmail || ''
        };
        return JFH_Templates.render(templateId, data) || { subject: '', body: '' };
      }

      const backendAuth = {
        backendUrl: (await JFH_DB.getAllSettings()).backendUrl || JFH_CONFIG.BACKEND.DEFAULT_URL,
        apiKey: (await JFH_DB.getAllSettings()).backendApiKey || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
      };

      founders.forEach(f => {
        const item = document.createElement('div');
        item.className = 'data-item';

        let badge = `<span class="data-badge">Pending</span>`;
        if (f.contacted) badge = `<span class="data-badge success">Contacted</span>`;
        else if (f.email) badge = `<span class="data-badge warning">Email Found</span>`;

        const emailHtml = f.email ? `<div class="founder-email-text">${f.email}</div>` : '';

        item.innerHTML = `
          <div style="flex:1; padding-right:8px;">
            <div class="data-item-main">${f.name}</div>
            <div class="data-item-sub">${f.title || f.role} @ ${f.companyName}</div>
            ${emailHtml}
            <div style="margin-top:4px; display:flex; gap:6px; flex-wrap:wrap;">
              <button class="edit-btn" data-id="${f.id}">Edit</button>
              ${f.email ? `<button class="preview-btn" data-id="${f.id}">👁 Preview</button>` : ''}
            </div>
            <div class="email-preview" id="preview-${f.id}" style="display:none;"></div>
            ${f.trackingId ? `<div class="tracking-status" id="track-${f.id}">🔄 tracking…</div>` : ''}
          </div>
          <div style="text-align:right;">
            ${badge}
            <div style="margin-top:4px;">
              <a href="${f.linkedinUrl}" target="_blank" style="color:var(--text-muted); font-size:10px; text-decoration:none;">🔗 LinkedIn</a>
            </div>
          </div>
        `;
        listEl.appendChild(item);
      });

      // Bind edit + preview buttons
      document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const founder = await JFH_DB.getFounder(e.target.dataset.id);
          if (founder) openEditModal(founder);
        });
      });
      document.querySelectorAll('.preview-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          const founder = await JFH_DB.getFounder(id);
          const box = document.getElementById('preview-' + id);
          if (!box) return;
          if (box.style.display === 'block') { box.style.display = 'none'; return; }
          const rendered = await renderFounderEmail(founder);
          box.textContent = `Subject: ${rendered.subject}\n\n${rendered.body}`;
          box.style.display = 'block';
        });
      });

      // Fetch open/click tracking status for sent emails
      for (const f of founders) {
        if (!f.trackingId) continue;
        const el = document.getElementById('track-' + f.id);
        if (!el) continue;
        const res = await JFH_Helpers.getTrackingStatus(f.trackingId, backendAuth);
        if (res.success && res.status) {
          const s = res.status;
          const parts = [s.opened ? `📖 Opened (${s.openCount})` : `📭 Not opened`];
          if (s.clicked) parts.push(`🔗 Clicked (${s.clickCount})`);
          el.textContent = parts.join('  •  ');
        } else {
          el.textContent = '⚠️ tracking n/a';
        }
      }
    } 
    else if (currentDataView === 'companies') {
      const companies = await JFH_DB.getAllCompanies();
      if (companies.length === 0) {
        listEl.innerHTML = '<div class="empty-state">No companies scraped yet.</div>';
        return;
      }
      
      listEl.innerHTML = '';
      companies.forEach(c => {
        const item = document.createElement('div');
        item.className = 'data-item';
        item.innerHTML = `
          <div>
            <div class="data-item-main">${c.name}</div>
            <div class="data-item-sub">${c.source.toUpperCase()} ${c.batch ? `• ${c.batch}` : ''}</div>
          </div>
        `;
        listEl.appendChild(item);
      });
    }
  }

  // Export & Clear
  document.getElementById('btn-export-csv').addEventListener('click', async () => {
    const data = currentDataView === 'founders' ? 
      await JFH_DB.getAllFounders() : await JFH_DB.getAllCompanies();
      
    if (data.length === 0) {
      alert('No data to export');
      return;
    }
    
    const csv = JFH_Helpers.toCSV(data);
    JFH_Helpers.downloadFile(csv, `jfh_${currentDataView}_${Date.now()}.csv`);
  });

  document.getElementById('btn-clear-db').addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete ALL scraped companies, founders, and email history? This cannot be undone.')) {
      await JFH_DB.clearAll();
      updateStats();
      loadDataView();
      alert('Database cleared.');
    }
  });

  // ============ Dashboard ============
  async function getBackendAuth() {
    const s = await JFH_DB.getAllSettings();
    return {
      backendUrl: s.backendUrl || JFH_CONFIG.BACKEND.DEFAULT_URL,
      apiKey: s.backendApiKey || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
    };
  }

  async function loadDashboard() {
    const note = document.getElementById('dashboard-backend-note');
    const sentEl = document.getElementById('dashboard-sent');
    const auth = await getBackendAuth();

    if (!auth.backendUrl) {
      note.style.display = 'block';
      sentEl.innerHTML = '<div class="empty-state">Backend URL not set (My Profile).</div>';
      return;
    }
    note.style.display = 'none';
    sentEl.innerHTML = '<div class="empty-state">Loading sent emails…</div>';

    try {
      const res = await fetch(auth.backendUrl + JFH_CONFIG.BACKEND.SENT_ENDPOINT, {
        headers: { 'x-api-key': auth.apiKey },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        sentEl.innerHTML = '<div class="empty-state">⚠️ ' + (data.message || 'Backend error') + '</div>';
        return;
      }
      const sent = (data.sent || []).sort((a, b) => (b.trackId || '').localeCompare(a.trackId || ''));
      if (sent.length === 0) {
        sentEl.innerHTML = '<div class="empty-state">No emails sent yet.</div>';
        return;
      }
      sentEl.innerHTML = '';
      sent.forEach((s) => {
        const item = document.createElement('div');
        item.className = 'data-item';
        const status = s.status || 'queued';
        let statusBadge;
        if (status === 'sent') statusBadge = '✅ Sent';
        else if (status === 'failed') statusBadge = '❌ Failed';
        else statusBadge = '⏳ Queued';
        const opened = s.opened ? `📖 Opened (${s.openCount})` : '📭 Not opened';
        const clicked = s.clicked ? `  •  🔗 Clicked (${s.clickCount})` : '';
        const errLine = s.error ? `<div class="tracking-status" style="color:#ff6b6b;">${s.error}</div>` : '';
        const pixelLine = s.trackId
          ? `<div class="tracking-status"><a href="${auth.backendUrl.replace(/\/+$/, '')}/api/track/open?id=${s.trackId}" target="_blank" style="color:var(--primary);">🔍 Test pixel: ${s.trackId}</a></div>`
          : '';
        item.innerHTML = `
          <div style="flex:1;">
            <div class="data-item-main">${s.to || '(unknown)'}</div>
            <div class="data-item-sub">${s.subject || ''}</div>
            <div class="tracking-status">${statusBadge}${status === 'sent' ? '  •  ' + opened + clicked : ''}</div>
            ${errLine}
            ${pixelLine}
          </div>`;
        sentEl.appendChild(item);
      });
    } catch (e) {
      sentEl.innerHTML = '<div class="empty-state">⚠️ Backend unreachable: ' + e.message + '</div>';
    }

    await loadReplies();
  }

  document.getElementById('btn-refresh-dashboard').addEventListener('click', loadDashboard);

  // ============ Gmail OAuth (Replies) ============
  let gmailToken = null;
  const connectGmailBtn = document.getElementById('btn-connect-gmail');
  const gmailStatus = document.getElementById('gmail-auth-status');

  function getGmailToken() {
    return new Promise((resolve, reject) => {
      if (!chrome.identity || typeof chrome.identity.getAuthToken !== 'function') {
        return reject(new Error('chrome.identity not available. Make sure "identity" permission is in manifest and extension is reloaded.'));
      }
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError || !token) {
          return reject(new Error(chrome.runtime.lastError?.message || 'Gmail auth failed'));
        }
        resolve(token);
      });
    });
  }

  if (connectGmailBtn) {
    console.log('[Dashboard] Connect Gmail button found:', connectGmailBtn);
    connectGmailBtn.addEventListener('click', async () => {
      console.log('[Dashboard] Connect Gmail clicked');
      try {
        console.log('[Dashboard] chrome.identity available:', typeof chrome.identity !== 'undefined');
        gmailToken = await getGmailToken();
        console.log('[Dashboard] Token obtained:', !!gmailToken);
        gmailStatus.textContent = '✅ Gmail connected. Loading replies…';
        gmailStatus.style.display = 'block';
        await loadReplies();
      } catch (e) {
        console.error('[Dashboard] Connect Gmail error:', e);
        gmailStatus.textContent = '❌ ' + e.message;
        gmailStatus.style.display = 'block';
      }
    });
  } else {
    console.error('[Dashboard] Connect Gmail button NOT found');
  }

  async function loadReplies() {
    const el = document.getElementById('dashboard-replies');
    if (!gmailToken) return;
    el.innerHTML = '<div class="empty-state">Loading replies…</div>';
    try {
      const listRes = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/threads?labelIds=INBOX&maxResults=15',
        { headers: { Authorization: 'Bearer ' + gmailToken } }
      );
      const list = await listRes.json();
      const threads = list.threads || [];
      if (threads.length === 0) {
        el.innerHTML = '<div class="empty-state">No inbox threads.</div>';
        return;
      }
      el.innerHTML = '';
      for (const t of threads.slice(0, 15)) {
        const thRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { Authorization: 'Bearer ' + gmailToken } }
        );
        const th = await thRes.json();
        const msgs = th.messages || [];
        const last = msgs[msgs.length - 1] || {};
        const headers = last.payload?.headers || [];
        const from = headers.find((h) => h.name === 'From')?.value || '';
        const subject = headers.find((h) => h.name === 'Subject')?.value || '(no subject)';
        const item = document.createElement('div');
        item.className = 'data-item';
        item.innerHTML = `<div style="flex:1;"><div class="data-item-main">${from}</div><div class="data-item-sub">${subject}</div></div>`;
        el.appendChild(item);
      }
    } catch (e) {
      el.innerHTML = '<div class="empty-state">⚠️ ' + e.message + '</div>';
    }
  }

  // --- Modal Logic ---
  const modal = document.getElementById('edit-modal');
  const closeBtn = document.getElementById('close-modal-btn');
  const editForm = document.getElementById('edit-founder-form');

  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  function openEditModal(founder) {
    document.getElementById('edit-id').value = founder.id;
    document.getElementById('edit-name').value = founder.name || '';
    document.getElementById('edit-title').value = founder.title || '';
    document.getElementById('edit-company').value = founder.companyName || '';
    document.getElementById('edit-email').value = founder.email || '';
    document.getElementById('edit-linkedin').value = founder.linkedinUrl || '';
    document.getElementById('edit-contacted').checked = founder.contacted || false;
    
    modal.style.display = 'flex';
  }

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    
    // Fetch existing to preserve other fields
    const founder = await JFH_DB.getFounder(id);
    if (!founder) return;

    founder.name = document.getElementById('edit-name').value;
    founder.title = document.getElementById('edit-title').value;
    founder.companyName = document.getElementById('edit-company').value;
    
    const newEmail = document.getElementById('edit-email').value.trim();
    if (newEmail !== founder.email) {
      founder.email = newEmail;
      if (newEmail && !founder.contacted) founder.status = 'email_found';
    }
    
    founder.linkedinUrl = document.getElementById('edit-linkedin').value;
    
    const isContacted = document.getElementById('edit-contacted').checked;
    if (isContacted && !founder.contacted) {
      founder.contacted = true;
      founder.contactedAt = Date.now();
      founder.status = 'email_sent';
    } else if (!isContacted && founder.contacted) {
      founder.contacted = false;
      founder.status = founder.email ? 'email_found' : 'pending';
    }

    await JFH_DB.updateFounder(founder);
    modal.style.display = 'none';
    loadDataView(); // Refresh list
    updateStats();  // Refresh stats
  });

});

/**
 * Job Founder Hunter - Popup Entry Point
 * Loads modules and wires them together.
 */

document.addEventListener('DOMContentLoaded', async () => {
  await JFH_DB.init();

  const updateStats = async () => {
    const stats = await JFH_DB.getStats();
    document.getElementById('stat-companies').textContent = stats.totalCompanies;
    document.getElementById('stat-founders').textContent = stats.totalFounders;
    document.getElementById('stat-with-email').textContent = stats.foundersWithEmail;
    document.getElementById('stat-contacted').textContent = stats.foundersContacted;

    if (stats.totalCompanies > 0) {
      const btn = document.getElementById('btn-find-founders');
      if (btn) btn.disabled = false;
    }
  };

  const updateUIState = (isRunning, isPaused, progress = 0, total = 0, statusText = '') => {
    const progressCont = document.getElementById('batch-progress-container');
    const controlsDiv = document.getElementById('batch-controls');
    const startBtn = document.getElementById('btn-start-batch');
    const findBtn = document.getElementById('btn-find-emails');
    const sendBtn = document.getElementById('btn-send-backend');
    const dataSendBtn = document.getElementById('btn-data-send-backend');

    if (isRunning) {
      progressCont.style.display = 'block';
      controlsDiv.style.display = 'flex';
      if (startBtn) startBtn.style.display = 'none';
      if (findBtn) findBtn.disabled = true;
      if (sendBtn) sendBtn.disabled = true;
      if (dataSendBtn) dataSendBtn.disabled = true;
    } else {
      progressCont.style.display = 'none';
      controlsDiv.style.display = 'none';
      if (startBtn) startBtn.style.display = 'block';
      if (findBtn) findBtn.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      if (dataSendBtn) dataSendBtn.disabled = false;
    }

    document.getElementById('batch-progress-fill').style.width = `${progress}%`;
    const progressText = document.getElementById('batch-progress-text');
    const statusEl = document.getElementById('batch-status-text');

    if (total > 0 && isRunning) {
      const current = Math.min(Math.round((progress / 100) * total), total);
      progressText.textContent = `${current}/${total}`;
      if (statusText) statusEl.textContent = statusText;
    } else if (total > 0 && !isRunning && progress >= 100) {
      progressText.textContent = `${total}/${total}`;
      if (statusText) statusEl.textContent = statusText || 'Done!';
    } else {
      progressText.textContent = `${Math.round(progress)}%`;
      if (statusText) statusEl.textContent = statusText;
    }

    const pauseBtn = document.getElementById('btn-pause-batch');
    if (pauseBtn) {
      if (isPaused) {
        pauseBtn.textContent = 'Resume';
        pauseBtn.className = 'btn primary';
      } else {
        pauseBtn.textContent = 'Pause';
        pauseBtn.className = 'btn warning';
      }
    }
  };

  const runSwTask = (type, successText) => {
    const statusText = document.getElementById('batch-status-text');
    const statusContainer = document.getElementById('batch-progress-container');
    chrome.runtime.sendMessage({ type }, (response) => {
      if (response && !response.success && response.message) {
        if (statusContainer) statusContainer.style.display = 'block';
        if (statusText) statusText.textContent = '❌ ' + response.message;
      } else if (response && response.success) {
        updateUIState(true, false, 0, response.count, successText);
        document.querySelector('.tab-btn[data-tab="home"]')?.click();
      }
    });
  };

  const refreshBackendSendButton = async () => {
    const sendBtn = document.getElementById('btn-send-backend');
    const dataSendBtn = document.getElementById('btn-data-send-backend');
    if (!sendBtn && !dataSendBtn) return;

    try {
      const founders = await JFH_DB.getAllFounders();
      const sentLog = await JFH_DB.getAllEmailsSent();
      const sentEmails = new Set(sentLog.map((e) => (e.email || '').toLowerCase()));
      const pending = founders.filter(
        (f) => f.email && !f.contacted && !sentEmails.has((f.email || '').toLowerCase())
      ).length;

      const label = pending > 0 ? `🚀 Step 2: Send All via Backend (${pending})` : '🚀 Step 2: Send All via Backend (none pending)';
      if (sendBtn) { sendBtn.textContent = label; sendBtn.disabled = pending === 0; }
      if (dataSendBtn) { dataSendBtn.textContent = `🚀 Send All (Backend) (${pending})`; dataSendBtn.disabled = pending === 0; }
    } catch (e) {
      console.warn('[UI] could not refresh backend send count:', e);
    }
  };

  // Load Data View (used by Data module)
  const loadDataView = async (view = 'founders', filter = 'all') => {
    const listEl = document.getElementById('data-list-view');
    listEl.innerHTML = '<div class="empty-state">Loading...</div>';

    if (view === 'founders') {
      let founders = await JFH_DB.getAllFounders();
      if (!founders.length) {
        listEl.innerHTML = '<div class="empty-state">No founders scraped yet.</div>';
        return;
      }

      if (filter === 'pending') founders = founders.filter((f) => !f.email && !f.contacted);
      else if (filter === 'email-found') founders = founders.filter((f) => f.email && !f.contacted);
      else if (filter === 'opened') founders = founders.filter((f) => f.contacted || (f.trackingId && f.openCount > 0));

      if (!founders.length) {
        listEl.innerHTML = '<div class="empty-state">No founders match this filter.</div>';
        return;
      }

      JFH_Data.renderFoundersList(founders);
      await JFH_Data.refreshTracking(founders);
    } else if (view === 'companies') {
      const companies = await JFH_DB.getAllCompanies();
      if (!companies.length) {
        listEl.innerHTML = '<div class="empty-state">No companies scraped yet.</div>';
        return;
      }
      listEl.innerHTML = '';
      companies.forEach((c) => {
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
  };

  // Initialize modules
  JFH_Tabs.initTabs({
    onData: () => loadDataView('founders', 'all'),
    onHome: () => { updateStats(); refreshBackendSendButton(); },
    onDashboard: () => JFH_DashboardModule?.load?.() || JFH_Dashboard?.load?.(),
  });

  JFH_Home.initHome({ updateStats, updateUIState, runSwTask, refreshBackendSendButton });
  JFH_Data.initData({ loadDataView });
  JFH_ModalModule.initModal({ loadDataView, updateStats, refreshBackendSendButton });
  JFH_DashboardModule.initDashboard();
  JFH_Profile.initProfile({ updateStats, refreshBackendSendButton });

  // Initial state request
  chrome.runtime.sendMessage({ type: JFH_CONFIG.MESSAGES.GET_STATS }, (response) => {
    if (response && response.state) {
      updateUIState(
        response.state.isRunning,
        response.state.isPaused,
        response.state.progress,
        0,
        response.state.isRunning ? (response.state.isPaused ? 'Paused' : 'Running...') : ''
      );
    }
  });

  // Global state listener
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
      const foundersProgressCont = document.getElementById('founders-progress-container');
      const findFoundersBtn = document.getElementById('btn-find-founders');

      foundersProgressCont.style.display = isRunning ? 'block' : 'none';
      if (isRunning) {
        document.getElementById('founders-progress-fill').style.width = `${progress}%`;
        document.getElementById('founders-progress-text').textContent = `${progress}%`;
        document.getElementById('founders-status-text').textContent =
          currentCompany ? `(${current}/${total}) ${currentCompany}` : (message || 'Scanning...');
        if (findFoundersBtn) {
          findFoundersBtn.textContent = '⏳ Scanning...';
          findFoundersBtn.disabled = true;
        }
      } else {
        if (findFoundersBtn) {
          findFoundersBtn.disabled = false;
          findFoundersBtn.textContent = '🔍 Find All Founders';
        }
        document.getElementById('founders-status-text').textContent = message || 'Done!';
        document.getElementById('founders-progress-text').textContent = '100%';
        document.getElementById('founders-progress-fill').style.width = '100%';
        updateStats();
      }
    }
  });

  // Initial count refresh
  setTimeout(refreshBackendSendButton, 500);
});

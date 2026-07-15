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

  const updateUIState = (isRunning, isPaused, progress = 0, total = 0, statusText = '', completed = 0, failed = 0, pending = 0, currentTask = '') => {
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

    // Update detailed status based on task type
    const detailEl = document.getElementById('batch-detail-text');
    if (detailEl) {
      if (isRunning && total > 0) {
        detailEl.style.display = 'block';
        if (currentTask === 'finding') {
          const found = completedCount;
          const notFound = failedCount;
          const remaining = Math.max(total - currentIndex, 0);
          detailEl.textContent = `✅ Found: ${found}  ❌ Not found: ${notFound}  ⏳ Remaining: ${remaining}`;
          detailEl.style.color = '#4ade80';
        } else if (currentTask === 'sending_backend') {
          detailEl.textContent = `✅ ${completed} sent  ❌ ${failed} failed  ⏳ ${pending} pending`;
          detailEl.style.color = 'var(--text-muted)';
        } else {
          detailEl.textContent = `Processing: ${current}/${total}`;
          detailEl.style.color = 'var(--text-muted)';
        }
      } else {
        detailEl.style.display = 'none';
      }
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
        updateUIState(true, false, 0, response.count, successText, 0, 0, response.count);
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

  // Load Sent Emails Tab
  const loadSentTab = async () => {
    const listEl = document.getElementById('sent-list-view');
    if (!listEl) return;
    listEl.innerHTML = '<div class="empty-state">Loading sent emails...</div>';

    try {
      const founders = await JFH_DB.getAllFounders();
      const sent = founders.filter((f) => f.contacted || f.email);
      if (!sent.length) {
        listEl.innerHTML = '<div class="empty-state">No emails sent yet.</div>';
        return;
      }

      listEl.innerHTML = '';
      for (const f of sent) {
        const item = document.createElement('div');
        item.className = 'data-item';
        const status = f.contacted ? '<span class="data-badge success">✅ Sent</span>' : '<span class="data-badge warning">📧 Email Found</span>';
        const tracking = f.trackingId ? `<div class="tracking-status" id="sent-track-${f.id}">🔄 tracking…</div>` : '';
        const sentAt = f.contactedAt ? `<div style="font-size:10px; color:var(--text-muted);">${new Date(f.contactedAt).toLocaleString()}</div>` : '';

        item.innerHTML = `
          <div style="flex:1; padding-right:8px;">
            <div class="data-item-main">${f.name}</div>
            <div class="data-item-sub">${f.title || f.role} @ ${f.companyName}</div>
            <div class="founder-email-text">${f.email}</div>
            ${sentAt}
            ${tracking}
          </div>
          <div style="text-align:right;">
            ${status}
            <div style="margin-top:4px;">
              <a href="${f.linkedinUrl}" target="_blank" style="color:var(--text-muted); font-size:10px; text-decoration:none;">🔗 LinkedIn</a>
            </div>
          </div>
        `;
        listEl.appendChild(item);
      }

      // Refresh tracking for sent emails
      const backendAuth = await getBackendAuth();
      for (const f of sent) {
        if (!f.trackingId) continue;
        const el = document.getElementById(`sent-track-${f.id}`);
        if (!el) continue;
        try {
          const res = await JFH_Helpers.getTrackingStatus(f.trackingId, backendAuth);
          if (res.success && res.status) {
            const s = res.status;
            let statusText = '';
            if (s.opened) {
              statusText = `📖 Opened ${s.openCount > 1 ? '(' + s.openCount + 'x)' : ''}`;
              if (s.clicked) statusText += `  •  🔗 Clicked (${s.clickCount})`;
            } else {
              statusText = '📭 Not opened';
            }
            el.textContent = statusText;
          } else {
            el.textContent = '⚠️ tracking n/a';
          }
        } catch (e) {
          el.textContent = '⚠️ tracking n/a';
        }
      }
    } catch (e) {
      listEl.innerHTML = '<div class="empty-state">⚠️ Error: ' + e.message + '</div>';
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

      JFH_Data.renderFoundersList(founders, view, filter);
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
    onSent: loadSentTab,
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
      const { isRunning, isPaused, progress, currentIndex, totalCount, currentFounder, message, completedCount, failedCount, pendingCount, currentTask } = msg.data;
      let statusText = '';
      if (message) statusText = message;
      else if (isPaused) statusText = 'Paused';
      else if (currentFounder) statusText = `Processing: ${currentFounder}`;
      else if (isRunning) statusText = 'Running...';

      updateUIState(isRunning, isPaused, progress, totalCount, statusText, completedCount, failedCount, pendingCount, currentTask);
      updateStats();
      if (refreshBackendSendButton) refreshBackendSendButton();
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

  // Sent tab refresh button
  const refreshSentBtn = document.getElementById('btn-refresh-sent');
  if (refreshSentBtn) {
    refreshSentBtn.addEventListener('click', loadSentTab);
  }
});

/**
 * Job Founder Hunter - Data Module
 */

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

function getBackendAuth() {
  return JFH_DB.getAllSettings().then((s) => ({
    backendUrl: s.backendUrl || JFH_CONFIG.BACKEND.DEFAULT_URL,
    apiKey: s.backendApiKey || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
  }));
}

function renderFoundersList(founders) {
  const listEl = document.getElementById('data-list-view');
  if (!founders.length) {
    listEl.innerHTML = '<div class="empty-state">No founders found.</div>';
    return;
  }

  listEl.innerHTML = '';
  founders.forEach((f) => {
    const item = document.createElement('div');
    item.className = 'data-item';

    let badge = '<span class="data-badge">Pending</span>';
    if (f.contacted) badge = '<span class="data-badge success">Contacted</span>';
    else if (f.email) badge = '<span class="data-badge warning">Email Found</span>';

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

  // Bind edit buttons
  document.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const founder = await JFH_DB.getFounder(e.target.dataset.id);
      if (founder) window.JFH_Modal?.open(founder);
    });
  });

  // Bind preview buttons
  document.querySelectorAll('.preview-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const founder = await JFH_DB.getFounder(id);
      const box = document.getElementById(`preview-${id}`);
      if (!box || !founder) return;
      if (box.style.display === 'block') { box.style.display = 'none'; return; }
      const rendered = await renderFounderEmail(founder);
      box.textContent = `Subject: ${rendered.subject}\n\n${rendered.body}`;
      box.style.display = 'block';
    });
  });
}

async function refreshTracking(founders) {
  const backendAuth = await getBackendAuth();
  // Sort: opened first
  const sorted = [...founders].sort((a, b) => (b.openCount || 0) - (a.openCount || 0));

  for (const f of sorted) {
    if (!f.trackingId) continue;
    const el = document.getElementById(`track-${f.id}`);
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
        el.style.fontWeight = s.opened ? 'bold' : 'normal';
        el.style.color = s.opened ? '#4ade80' : 'var(--text-muted)';
      } else {
        el.textContent = '⚠️ tracking n/a';
      }
    } catch (e) {
      el.textContent = '⚠️ tracking n/a';
    }
  }
}

function initData({ loadDataView }) {
  let currentDataView = 'founders';
  let currentFilter = 'all';

  document.querySelectorAll('.data-tab-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.data-tab-btn').forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');
      currentDataView = e.target.dataset.view;
      loadDataView(currentDataView, currentFilter);
    });
  });

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      loadDataView(currentDataView, currentFilter);
      if (window.__JFH_REFRESH_BACKEND_COUNT) window.__JFH_REFRESH_BACKEND_COUNT();
    });
  });

  // Export & Clear
  document.getElementById('btn-export-csv')?.addEventListener('click', async () => {
    const data = currentDataView === 'founders' ?
      await JFH_DB.getAllFounders() : await JFH_DB.getAllCompanies();

    if (data.length === 0) {
      alert('No data to export');
      return;
    }

    const csv = JFH_Helpers.toCSV(data);
    JFH_Helpers.downloadFile(csv, `jfh_${currentDataView}_${Date.now()}.csv`);
  });

  document.getElementById('btn-clear-db')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete ALL scraped companies, founders, and email history? This cannot be undone.')) {
      await JFH_DB.clearAll();
      window.JFH_Home?.updateStats?.();
      loadDataView(currentDataView, currentFilter);
      if (window.__JFH_REFRESH_BACKEND_COUNT) window.__JFH_REFRESH_BACKEND_COUNT();
      alert('Database cleared.');
    }
  });

  // Outreach action buttons
  document.getElementById('btn-data-find-emails')?.addEventListener('click', () => {
    window.JFH_Home?.runSwTask?.('FIND_ALL_EMAILS', 'Finding emails...');
  });
  document.getElementById('btn-data-send-backend')?.addEventListener('click', async () => {
    const founders = await JFH_DB.getAllFounders();
    const withEmail = founders.filter((f) => f.email);
    const total = withEmail.length;
    if (total === 0) {
      alert('No founders with emails found.');
      return;
    }
    if (!confirm(`Send emails to ${total} founders via backend?\n\nThis will queue ALL ${total} emails, including duplicates. Continue?`)) return;
    window.JFH_Home?.runSwTask?.('SEND_ALL_BACKEND', `Queuing ${total} emails to backend...`);
  });
  document.getElementById('btn-refresh-tracking')?.addEventListener('click', () => {
    loadDataView(currentDataView, currentFilter);
  });
}

window.JFH_Data = { initData, renderFoundersList, refreshTracking, renderFounderEmail, getBackendAuth };

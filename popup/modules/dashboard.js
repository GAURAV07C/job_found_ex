/**
 * Job Founder Hunter - Dashboard Module
 */

async function getBackendAuth() {
  const s = await JFH_DB.getAllSettings();
  return {
    backendUrl: s.backendUrl || JFH_CONFIG.BACKEND.DEFAULT_URL,
    apiKey: s.backendApiKey || JFH_CONFIG.BACKEND.DEFAULT_API_KEY,
  };
}

async function loadSentEmails(sentEl, noteEl) {
  const auth = await getBackendAuth();

  if (!auth.backendUrl) {
    if (noteEl) noteEl.style.display = 'block';
    sentEl.innerHTML = '<div class="empty-state">Backend URL not set (My Profile).</div>';
    return;
  }
  if (noteEl) noteEl.style.display = 'none';
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
        ? `<div class="tracking-status"><a href="${auth.backendUrl.replace(/\/+$/, '')}/api/tracking/${s.trackId}" target="_blank" style="color:var(--primary);">🔍 Track: ${s.trackId}</a></div>`
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
}

async function loadReplies() {
  const el = document.getElementById('dashboard-replies');
  const token = window.__JFH_GMAIL_TOKEN;
  if (!token) return;

  el.innerHTML = '<div class="empty-state">Loading replies…</div>';
  try {
    const listRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/threads?labelIds=INBOX&maxResults=15',
      { headers: { Authorization: 'Bearer ' + token } }
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
        { headers: { Authorization: 'Bearer ' + token } }
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

function initDashboard() {
  const note = document.getElementById('dashboard-backend-note');
  const sentEl = document.getElementById('dashboard-sent');
  const repliesEl = document.getElementById('dashboard-replies');
  const refreshBtn = document.getElementById('btn-refresh-dashboard');
  const connectBtn = document.getElementById('btn-connect-gmail');
  const gmailStatus = document.getElementById('gmail-auth-status');

  refreshBtn?.addEventListener('click', async () => {
    await loadSentEmails(sentEl, note);
    await loadReplies();
  });

  connectBtn?.addEventListener('click', async () => {
    if (!chrome.identity || !chrome.identity.getAuthToken) {
      gmailStatus.textContent = '❌ chrome.identity not available. Reload the extension after updating manifest (identity + oauth2).';
      gmailStatus.style.display = 'block';
      return;
    }
    try {
      const token = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (t) => {
          if (chrome.runtime.lastError || !t) return reject(new Error(chrome.runtime.lastError?.message || 'Gmail auth failed'));
          resolve(t);
        });
      });
      window.__JFH_GMAIL_TOKEN = token;
      gmailStatus.textContent = '✅ Gmail connected. Loading replies…';
      gmailStatus.style.display = 'block';
      await loadReplies();
    } catch (e) {
      gmailStatus.textContent = '❌ ' + e.message;
      gmailStatus.style.display = 'block';
    }
  });

  // Public loader
  window.JFH_Dashboard = {
    load: async () => {
      await loadSentEmails(sentEl, note);
      await loadReplies();
    }
  };
}

window.JFH_DashboardModule = { initDashboard, loadReplies };

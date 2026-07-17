/**
 * Job Founder Hunter - Mailmeteor Email Finder Detector
 * Runs on mailmeteor.com/tools/linkedin-email-finder*
 * Shows a manual-input card so the user can copy the found email and Save it.
 * Also tries to auto-detect the email shown on the page (best-effort).
 */

(function () {
  'use strict';

  if (window.__JFH_MAILMETEOR_DETECTOR_LOADED) return;
  window.__JFH_MAILMETEOR_DETECTOR_LOADED = true;

  console.log('[JFH] Mailmeteor Detector loaded on:', window.location.href);

  let currentFounder = null;
  let emailHandled = false;

  // ========== Inject UI ==========
  function injectUI() {
    if (document.getElementById('jfh-mm-fab')) return;

    const fab = document.createElement('div');
    fab.id = 'jfh-mm-fab';
    fab.innerHTML = `
      <div id="jfh-mm-card">
        <div class="jfh-mm-header">
          <span class="jfh-mm-logo">🎯 JFH · Mailmeteor</span>
          <button id="jfh-mm-close">&times;</button>
        </div>
        <div id="jfh-mm-content">
          <p id="jfh-mm-status">Waiting for orchestrator...</p>
          <div id="jfh-mm-manual-input">
            <input type="email" id="jfh-mm-email-input" placeholder="Paste email here" />
            <button id="jfh-mm-save-email-btn">Save</button>
          </div>
          <button id="jfh-mm-skip-btn">Skip this one</button>
        </div>
      </div>
    `;

    fab.style.cssText = `
      position: fixed;
      top: 80px;
      right: 24px;
      z-index: 999999;
      font-family: 'Inter', system-ui, sans-serif;
    `;

    document.body.appendChild(fab);

    const style = document.createElement('style');
    style.textContent = `
      #jfh-mm-card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
        width: 280px;
        overflow: hidden;
        border: 1px solid #eee;
      }
      .jfh-mm-header {
        background: #6C5CE7;
        color: white;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
      }
      .jfh-mm-logo { font-size: 13px; }
      #jfh-mm-close {
        background: none; border: none; color: white; font-size: 18px; cursor: pointer;
      }
      #jfh-mm-content { padding: 16px; }
      #jfh-mm-status {
        margin: 0 0 12px 0;
        font-size: 13px;
        color: #2d3436;
      }
      #jfh-mm-manual-input {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      #jfh-mm-email-input {
        flex: 1;
        padding: 8px;
        border: 1px solid #dfe6e9;
        border-radius: 6px;
        font-size: 12px;
      }
      #jfh-mm-save-email-btn {
        background: #6C5CE7;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 0 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
      }
      #jfh-mm-skip-btn {
        margin-top: 10px;
        width: 100%;
        background: #f1f2f6;
        color: #636e72;
        border: none;
        border-radius: 6px;
        padding: 8px;
        cursor: pointer;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);

    document.getElementById('jfh-mm-close').addEventListener('click', () => {
      document.getElementById('jfh-mm-card').style.display = 'none';
    });

    document.getElementById('jfh-mm-save-email-btn').addEventListener('click', () => {
      const email = document.getElementById('jfh-mm-email-input').value.trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        handleEmailFound(email, 'mailmeteor_manual');
      } else {
        alert('Please enter a valid email address.');
      }
    });

    document.getElementById('jfh-mm-skip-btn').addEventListener('click', () => {
      handleEmailNotFound('user_skipped');
    });
  }

  function updateStatus(text) {
    const statusEl = document.getElementById('jfh-mm-status');
    if (statusEl) statusEl.innerHTML = text;
  }

  // ========== Best-effort auto detection ==========
  // Try to grab an email shown on the Mailmeteor result page and pre-fill it.
  function tryAutoDetect() {
    if (emailHandled) return;

    // 1. mailto links
    const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
    for (const link of mailtoLinks) {
      const email = link.href.replace('mailto:', '').split('?')[0].trim();
      if (isUsableEmail(email)) return prefill(email);
    }

    // 2. any visible email-looking text
    const bodyText = document.body ? document.body.innerText || '' : '';
    const matches = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    for (const m of matches) {
      if (isUsableEmail(m)) return prefill(m);
    }
  }

  function isUsableEmail(email) {
    if (!email) return false;
    const e = email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
    // Ignore Mailmeteor's own / example / support addresses
    const blocked = ['mailmeteor.com', 'example.com', 'sentry.io', 'linkedin.com', 'gmail.com@'];
    return !blocked.some((b) => e.includes(b));
  }

  function prefill(email) {
    const inputEl = document.getElementById('jfh-mm-email-input');
    if (inputEl && !inputEl.value) {
      inputEl.value = email;
      updateStatus(`💡 Detected: <b>${email}</b><br><small>Verify & click Save (or edit it).</small>`);
    }
  }

  function handleEmailFound(email, source) {
    if (emailHandled) return;
    emailHandled = true;

    console.log(`[JFH][MM] Email saved via ${source}:`, email);
    updateStatus(`✅ <b>Saved:</b><br>${email}<br><small>Moving on...</small>`);

    const extractedInfo = currentFounder ? null : { name: '', title: '' };

    try {
      chrome.runtime.sendMessage({
        type: 'EMAIL_DETECTED',
        data: {
          founderId: currentFounder ? currentFounder.id : null,
          email: email,
          found: true,
          source: source,
          extractedInfo: extractedInfo
        }
      });
    } catch (e) {
      console.warn('[JFH][MM] Could not send email detection:', e.message);
    }
  }

  function handleEmailNotFound(reason) {
    if (emailHandled) return;
    emailHandled = true;

    console.log('[JFH][MM] No email, reason:', reason);
    updateStatus('⏭️ Skipped. Moving on...');

    try {
      chrome.runtime.sendMessage({
        type: 'EMAIL_DETECTED',
        data: {
          founderId: currentFounder ? currentFounder.id : null,
          email: null,
          found: false,
          source: 'mailmeteor_' + reason
        }
      });
    } catch (e) {
      console.warn('[JFH][MM] Could not send skip message:', e.message);
    }
  }

  // ========== Message Listener ==========
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DETECT_EMAIL') {
      currentFounder = message.data.founder;
      emailHandled = false;

      const card = document.getElementById('jfh-mm-card');
      if (card) card.style.display = 'block';
      updateStatus(
        `Target: <b>${currentFounder.name || 'Founder'}</b>` +
        `${currentFounder.companyName ? `<br><small>${currentFounder.companyName}</small>` : ''}` +
        `<br><small>Copy the email below & click Save.</small>`
      );

      // Try to auto-detect what's already on the page, and keep watching for a bit.
      tryAutoDetect();
      let ticks = 0;
      const poll = setInterval(() => {
        ticks++;
        if (emailHandled || ticks > 40) { clearInterval(poll); return; }
        tryAutoDetect();
      }, 1000);

      sendResponse({ received: true });
      return true;
    }

    if (message.type === 'PING') {
      sendResponse({ ready: true, source: 'mailmeteor-detector' });
    }
  });

  // Inject UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }
})();

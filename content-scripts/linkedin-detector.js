/**
 * Job Founder Hunter - LinkedIn Detector Content Script
 * Runs on linkedin.com/in/* pages
 * Detects emails injected by other extensions (Hunter, Lusha, Apollo, etc.)
 */

(function () {
  'use strict';

  if (window.__JFH_LINKEDIN_DETECTOR_LOADED) return;
  window.__JFH_LINKEDIN_DETECTOR_LOADED = true;

  console.log('[JFH] LinkedIn Detector loaded on:', window.location.href);

  let currentFounder = null;
  let emailFound = false;

  // Fixed-selector config forwarded from popup settings via DETECT_EMAIL
  let liConfig = {
    mode: 'auto',         // 'auto' | 'finalscout' | 'fixed'
    clickSelector: '',
    emailSelector: '',
    fillSelector: '',
    sendSelector: ''
  };

  // ========== Inject UI ==========
  function injectUI() {
    const fab = document.createElement('div');
    fab.id = 'jfh-li-fab';
    fab.innerHTML = `
      <div id="jfh-li-card">
        <div class="jfh-header">
          <span class="jfh-logo">🎯 JFH</span>
          <button id="jfh-li-close">&times;</button>
        </div>
        <div id="jfh-li-content">
          <p id="jfh-li-status">Waiting for orchestrator...</p>
          <div id="jfh-li-manual-input" style="display:none;">
            <input type="email" id="jfh-email-input" placeholder="Enter email manually" />
            <button id="jfh-save-email-btn">Save</button>
          </div>
        </div>
      </div>
    `;
    
    fab.style.cssText = `
      position: fixed;
      top: 80px;
      left: 24px;
      z-index: 99999;
      font-family: 'Inter', sans-serif;
    `;

    document.body.appendChild(fab);

    const style = document.createElement('style');
    style.textContent = `
      #jfh-li-card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.15);
        width: 280px;
        overflow: hidden;
        border: 1px solid #eee;
      }
      .jfh-header {
        background: #0984E3;
        color: white;
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
      }
      .jfh-logo { font-size: 14px; }
      #jfh-li-close {
        background: none; border: none; color: white; font-size: 18px; cursor: pointer;
      }
      #jfh-li-content {
        padding: 16px;
      }
      #jfh-li-status {
        margin: 0 0 12px 0;
        font-size: 13px;
        color: #2d3436;
      }
      #jfh-li-manual-input {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }
      #jfh-email-input {
        flex: 1;
        padding: 8px;
        border: 1px solid #dfe6e9;
        border-radius: 6px;
        font-size: 12px;
      }
      #jfh-save-email-btn {
        background: #0984E3;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 0 12px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
      }
    `;
    document.head.appendChild(style);

    document.getElementById('jfh-li-close').addEventListener('click', () => {
      document.getElementById('jfh-li-card').style.display = 'none';
    });

    document.getElementById('jfh-save-email-btn').addEventListener('click', () => {
      const email = document.getElementById('jfh-email-input').value.trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        handleEmailFound(email, 'manual');
      } else {
        alert('Please enter a valid email address.');
      }
    });
  }

  function updateStatus(text, showInput = false) {
    const statusEl = document.getElementById('jfh-li-status');
    const inputEl = document.getElementById('jfh-li-manual-input');
    if (statusEl) statusEl.innerHTML = text;
    if (inputEl) inputEl.style.display = showInput ? 'flex' : 'none';
  }

  // ========== Fixed-Selector Mode (configured in popup) ==========
  // Clicks a fixed button, waits for the email to appear at a fixed location,
  // copies it, optionally fills a page input + clicks a page send button.

  function readEmailFromSelector() {
    if (!liConfig.emailSelector) return null;
    const el = document.querySelector(liConfig.emailSelector);
    if (!el) return null;
    const text = (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
    const match = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);
    return match ? match[1] : null;
  }

  function startFixedSelectorMode() {
    // FinalScout mode: click its "Get Email" button (below profile card), then read email
    if (liConfig.mode === 'finalscout' || (!liConfig.clickSelector && !liConfig.emailSelector && liConfig.mode !== 'fixed')) {
      if (liConfig.mode === 'finalscout' || liConfig.mode === 'auto') {
        startFinalScoutMode();
        return;
      }
    }

    const hasConfig = liConfig.clickSelector || liConfig.emailSelector;
    if (!hasConfig) {
      console.log('[JFH] No fixed-selector config set; using generic detection only.');
      return;
    }

    updateStatus('⏳ Clicking fixed email button...', false);

    // 1. Click the fixed target (the email finder button)
    if (liConfig.clickSelector) {
      const clickTarget = document.querySelector(liConfig.clickSelector);
      if (clickTarget) {
        console.log('[JFH] Fixed-selector click:', liConfig.clickSelector);
        clickTarget.click();
      } else {
        console.warn('[JFH] Fixed click selector not found:', liConfig.clickSelector);
      }
    }

    // 2. Poll for the email at the fixed location (extension injects after click)
    const deadline = Date.now() + 30000;
    const poll = () => {
      if (emailFound) return;
      const email = readEmailFromSelector();
      if (email) {
        handleEmailFound(email, 'fixed_selector');
        return;
      }
      if (Date.now() > deadline) {
        updateStatus('⚠️ Email not found at fixed selector. Enter manually below:', true);
        return;
      }
      setTimeout(poll, 500);
    };
    setTimeout(poll, 700);
  }

  // ========== FinalScout Mode ==========
  // FinalScout injects a "Get Email" button below the LinkedIn profile card.
  // Clicking it reveals the email (often in a panel/popup with fs- class names).

  function findFinalScoutButton() {
    // Candidate elements: broaden to any element that could be the FS button
    const candidates = Array.from(
      document.querySelectorAll(
        'button, a, span, div, li, [role="button"], [class*="fs-"], [class*="finalscout"], [data-fs], [class*="fsie"], [class*="fssb"]'
      )
    );

    const EMAIL_WORDS = ['get email', 'get emails', 'show email', 'reveal email', 'find email', 'email address', 'view email', 'copy email'];

    let best = null;
    for (const el of candidates) {
      const cls = (el.className || '').toString().toLowerCase();
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();

      // Prefer an element that has fs- class AND "email" text/aria
      if (cls.includes('fs-') && (txt.includes('email') || aria.includes('email') || txt.includes('get '))) {
        return el;
      }
      // Broad fallback: any clickable-looking element whose text is about email
      if (!best) {
        const hit = EMAIL_WORDS.some(w => txt.includes(w)) || EMAIL_WORDS.some(w => aria.includes(w));
        if (hit && txt.length < 60) best = el;
      }
    }
    return best;
  }

  // Dump candidate elements to console so we can learn FinalScout's real DOM
  function dumpFinalScoutCandidates() {
    try {
      const els = Array.from(
        document.querySelectorAll('[class*="fs-"], [class*="finalscout"], [data-fs], button, a')
      ).filter(el => {
        const t = (el.textContent || '').toLowerCase();
        const c = (el.className || '').toString().toLowerCase();
        return t.includes('email') || c.includes('fs') || c.includes('final');
      });
      console.log('[JFH] FinalScout candidate dump (' + els.length + '):');
      els.slice(0, 25).forEach((el, i) => {
        console.log(
          `  [${i}] <${el.tagName.toLowerCase()}> class="${el.className}" ` +
          `text="${el.textContent.replace(/\s+/g, ' ').trim().slice(0, 50)}" ` +
          `href="${el.getAttribute('href') || ''}"`
        );
      });
    } catch (e) {
      console.warn('[JFH] dump failed', e);
    }
  }

  function startFinalScoutMode() {
    updateStatus('⏳ FinalScout: clicking "Get Email"...', false);

    const btn = findFinalScoutButton();
    if (btn) {
      console.log('[JFH] FinalScout button found, clicking:', btn);
      btn.click();
    } else {
      console.warn('[JFH] FinalScout "Get Email" button not found yet — will retry.');
      dumpFinalScoutCandidates(); // learn FS DOM
    }

    // Poll for the revealed email anywhere on the page
    const deadline = Date.now() + 30000;
    const poll = () => {
      if (emailFound) return;

      // 1. mailto links (most reliable)
      const mailto = document.querySelector('a[href^="mailto:"]');
      if (mailto) {
        const email = mailto.href.replace('mailto:', '').split('?')[0].trim();
        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          handleEmailFound(email, 'finalscout_mailto');
          return;
        }
      }

      // 2. Any fs- element whose text is exactly an email
      const fsEls = document.querySelectorAll('[class*="fs-"], [class*="finalscout"]');
      for (const el of fsEls) {
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const m = txt.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/);
        if (m && !m[1].includes('linkedin.com') && !m[1].includes('sentry.io')) {
          handleEmailFound(m[1], 'finalscout_dom');
          return;
        }
      }

      // 3. Retry clicking the button if it just appeared (page still rendering)
      const retry = findFinalScoutButton();
      if (retry && retry !== btn) {
        console.log('[JFH] FinalScout button appeared on retry, clicking:', retry);
        retry.click();
      }

      if (Date.now() > deadline) {
        updateStatus('⚠️ FinalScout email not found. Enter manually below:', true);
        dumpFinalScoutCandidates();
        return;
      }
      setTimeout(poll, 500);
    };
    setTimeout(poll, 800);
  }

  // Auto-click "Get Email" / "Find Email" / "View Email" buttons
  function autoClickEmailFinder() {
    if (emailFound) return;

    const selectors = [
      'button', 'a', 'div[role="button"]',
      '[class*="email"]', '[class*="Email"]',
      '[class*="find"]', '[class*="Find"]',
      '[class*="get"]', '[class*="Get"]',
      '[class*="view"]', '[class*="View"]',
      '[class*="apollo"]', '[class*="hunter"]', '[class*="lusha"]'
    ];

    const buttons = document.querySelectorAll(selectors.join(', '));
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase();
      const className = (btn.className || '').toString().toLowerCase();

      if (
        text.includes('get email') ||
        text.includes('find email') ||
        text.includes('view email') ||
        text.includes('search email') ||
        text.includes('reveal email') ||
        className.includes('apollo') ||
        className.includes('hunter') ||
        className.includes('lusha') ||
        className.includes('finalscout') ||
        className.includes('email-finder')
      ) {
        if (!btn.dataset.jfhClicked) {
          console.log('[JFH] Auto-clicking email finder button:', btn);
          btn.dataset.jfhClicked = "true";
          btn.click();
          setTimeout(() => {
            if (btn.dataset.jfhClicked) delete btn.dataset.jfhClicked;
          }, 5000);
          break;
        }
      }
    }
  }

  // ========== Email Detection Logic ==========
  
  // Listen for DOM mutations to catch injected emails from other extensions
  function setupMutationObserver() {
    updateStatus('⏳ Scanning for emails...<br><small>Looking for Get Email button...</small>', true);

    // Auto-click "Get Email" button immediately and on changes
    autoClickEmailFinder();

    const observer = new MutationObserver((mutations) => {
      if (emailFound) {
        observer.disconnect();
        return;
      }
      checkForEmail();
      autoClickEmailFinder();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // Timeout after 30 seconds if nothing found
    setTimeout(() => {
      if (!emailFound && currentFounder) {
        observer.disconnect();
        updateStatus('⚠️ Could not detect email automatically. Please enter it below:', true); // Show input field now
        try {
          chrome.runtime.sendMessage({
            type: 'EMAIL_DETECTED',
            data: {
              founderId: currentFounder.id,
              email: null,
              found: false
            }
          });
        } catch (e) {
          console.warn('[JFH] Could not send email detection to background:', e.message);
        }
      }
    }, 30000);
  }

  // Auto-click "Find Email" buttons injected by extensions
  function autoClickFinderButtons() {
    // Check for standard buttons or elements with FinalScout specific class patterns
    const buttons = document.querySelectorAll('button, a, div[role="button"], [class*="fs-fssb-"], [class*="fs-lpv-"], [class*="fs-fsie-"]');
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase();
      const className = (btn.className || '').toString().toLowerCase();
      
      // Look for common extension buttons that reveal emails or FinalScout specific classes
      if (text.includes('view email') || 
          text.includes('get email') || 
          text.includes('find email') || 
          text === 'email' || 
          className.includes('apollo') || 
          className.includes('finalscout') ||
          className.includes('fs-fssb-') ||
          className.includes('fs-lpv-') ||
          className.includes('fs-fsie-')) {
        
        // Ensure we haven't clicked it recently to avoid infinite loops
        if (!btn.dataset.jfhClicked) {
          console.log('[JFH] Auto-clicking email finder button:', btn);
          btn.dataset.jfhClicked = "true";
          btn.click();
          break; // Click one at a time
        }
      }
    }
  }

  // Pattern matching for various extensions
  function checkForEmail() {
    if (emailFound) return true;

    // 1. Look for mailto links injected anywhere
    const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
    for (const link of mailtoLinks) {
      const email = link.href.replace('mailto:', '').split('?')[0].trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return handleEmailFound(email, 'mailto_link');
      }
    }

    // 2. Look for common class names used by email finders
    const genericEmails = document.querySelectorAll(
      '[class*="email"], [class*="Email"], [data-email], [id*="email"]'
    );
    
    for (const el of genericEmails) {
      const text = el.textContent || el.innerText || '';
      const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      
      if (emailMatch && emailMatch[1]) {
        // Exclude common false positives (like login emails or company support emails)
        const email = emailMatch[1].toLowerCase();
        if (!email.includes('sentry.io') && !email.includes('linkedin.com')) {
          return handleEmailFound(emailMatch[1], 'dom_text');
        }
      }
    }

    // 3. Specifically check Apollo extension DOM structure (example)
    const apolloEmails = document.querySelectorAll('.apollo-email-value, [data-test="email-value"]');
    if (apolloEmails.length > 0) {
      const email = apolloEmails[0].textContent.trim();
      if (email) return handleEmailFound(email, 'apollo');
    }

    return false;
  }

  function handleEmailFound(email, source = 'unknown') {
    if (emailFound) return true; // Already processed
    emailFound = true;

    console.log(`[JFH] Email found via ${source}:`, email);

    updateStatus(`✅ <b>Email Found:</b><br>${email}<br><small>Auto-saving...</small>`);

    // Auto-fill input and click Save
    const inputEl = document.getElementById('jfh-email-input');
    const saveBtn = document.getElementById('jfh-save-email-btn');
    if (inputEl) {
      inputEl.value = email;
    }
    if (saveBtn) {
      saveBtn.click();
    }

    // Optionally fill a page input + click a page send button (configured selectors)
    if (liConfig.fillSelector) {
      const fillEl = document.querySelector(liConfig.fillSelector);
      if (fillEl) {
        fillEl.value = email;
        fillEl.dispatchEvent(new Event('input', { bubbles: true }));
        fillEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (liConfig.sendSelector) {
      const sendEl = document.querySelector(liConfig.sendSelector);
      if (sendEl) sendEl.click();
    }

    const extractedInfo = currentFounder ? null : extractProfileInfo();

    // Notify Service Worker
    try {
      chrome.runtime.sendMessage({
        type: 'EMAIL_DETECTED',
        data: {
          founderId: currentFounder ? currentFounder.id : null,
          email: email,
          found: true,
          source: source,
          extractedInfo: extractedInfo // Pass this if no founder ID is known
        }
      });
    } catch (e) {
      console.warn('[JFH] Could not send email detection to background:', e.message);
    }

    return true;
  }

  // ========== Extract basic profile info (as fallback) ==========
  function extractProfileInfo() {
    const nameEl = document.querySelector('h1.text-heading-xlarge');
    const titleEl = document.querySelector('.text-body-medium');
    
    return {
      name: nameEl ? nameEl.textContent.trim() : '',
      title: titleEl ? titleEl.textContent.trim() : ''
    };
  }

  // ========== Message Listener ==========
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DETECT_EMAIL') {
      currentFounder = message.data.founder;
      emailFound = false;

      if (message.data.liConfig) {
        liConfig = Object.assign(liConfig, message.data.liConfig);
      }
      
      document.getElementById('jfh-li-card').style.display = 'block';
      updateStatus(`Target: <b>${currentFounder.name}</b><br><small>${currentFounder.companyName}</small>`);
      
      // Start monitoring for email injection (generic fallback)
      setupMutationObserver();

      // Also run configured fixed-selector flow (click fixed button → read email)
      startFixedSelectorMode();
      
      sendResponse({ received: true });
      return true;
    }
    
    if (message.type === 'PING') {
      sendResponse({ ready: true, source: 'linkedin-detector' });
    }
  });

  // Inject UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }

})();

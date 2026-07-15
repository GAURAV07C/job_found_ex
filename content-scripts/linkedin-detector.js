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
      right: 24px;
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

  // ========== Email Detection Logic ==========
  
  // Listen for DOM mutations to catch injected emails from other extensions
  function setupMutationObserver() {
    // Show status and input box immediately so user can paste manually
    updateStatus('⏳ Scanning for emails...<br><small>Paste email below if found manually:</small>', true);
    
    // Check immediately in case it's already there
    if (checkForEmail()) return;

    const observer = new MutationObserver((mutations) => {
      if (emailFound) {
        observer.disconnect();
        return;
      }
      checkForEmail();
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
        chrome.runtime.sendMessage({
          type: 'EMAIL_DETECTED',
          data: {
            founderId: currentFounder.id,
            email: null,
            found: false
          }
        });
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
    
    updateStatus(`✅ <b>Email Found:</b><br>${email}<br><small>Proceeding to Gmail...</small>`);
    
    const extractedInfo = currentFounder ? null : extractProfileInfo();

    // Notify Service Worker
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
      
      document.getElementById('jfh-li-card').style.display = 'block';
      updateStatus(`Target: <b>${currentFounder.name}</b><br><small>${currentFounder.companyName}</small>`);
      
      // Start monitoring for email injection
      setupMutationObserver();
      
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

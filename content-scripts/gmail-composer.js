/**
 * Job Founder Hunter - Gmail Composer Content Script
 * Runs on mail.google.com
 * Automates opening the compose window and filling it with templates
 */

(function () {
  'use strict';

  if (window.__JFH_GMAIL_COMPOSER_LOADED) return;
  window.__JFH_GMAIL_COMPOSER_LOADED = true;

  console.log('[JFH] Gmail Composer loaded on:', window.location.href);

  // ========== Inject UI Status ==========
  function injectUI() {
    const fab = document.createElement('div');
    fab.id = 'jfh-gm-status';
    fab.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      background: #0984E3;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      display: none;
      pointer-events: none;
    `;
    document.body.appendChild(fab);
  }

  function showStatus(text, duration = 0) {
    const el = document.getElementById('jfh-gm-status');
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    if (duration > 0) {
      setTimeout(() => { el.style.display = 'none'; }, duration);
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== Compose Email Logic ==========
  async function composeEmail(emailData) {
    const { to, subject, body, founderId } = emailData;
    
    showStatus('🚀 JFH: Opening Compose Window...');

    let activeWindow = document;

    if (!emailData.isPreFilled) {
      // 1. Click the "Compose" button (Only if not prefilled)
      const composeBtn = document.querySelector('.T-I.T-I-KE.L3, [role="button"][gh="cm"]');
      if (!composeBtn) {
        console.error('[JFH] Compose button not found');
        showStatus('❌ Error: Compose button not found', 3000);
        return false;
      }
      
      composeBtn.click();
      
      // Wait for compose window to render
      await delay(2000);

      // 2. Find the active compose window
      const composeWindows = document.querySelectorAll('[role="dialog"]');
      if (composeWindows.length === 0) {
        console.error('[JFH] Compose window not found');
        return false;
      }
      
      activeWindow = composeWindows[composeWindows.length - 1];
    } else {
      // If pre-filled via view=cm, the whole page is the compose window. Just wait for it to load.
      await delay(2000);
    }

    if (!emailData.isPreFilled) {
      // 3. Fill "To" field
      showStatus('✍️ JFH: Filling details...');
      const toField = activeWindow.querySelector('input[name="to"], input[peoplekit-id], textarea[name="to"], [aria-label*="To"]');
      if (toField) {
        toField.focus();
        document.execCommand('insertText', false, to);
        await delay(500);
        toField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      }

      // 4. Fill "Subject"
      await delay(500);
      const subjectField = activeWindow.querySelector('input[name="subjectbox"], input[name="subject"]');
      if (subjectField) {
        subjectField.focus();
        document.execCommand('insertText', false, subject);
      }

      // 5. Fill "Body"
      await delay(500);
      const bodyField = activeWindow.querySelector('.Am.Al.editable, [role="textbox"][aria-label*="Body"], div[contenteditable="true"]');
      if (bodyField) {
        bodyField.focus();
        const htmlBody = (body || '').replace(/\n/g, '<br>');
        document.execCommand('insertHTML', false, htmlBody);
      }
    } else {
      showStatus('✍️ JFH: Email drafted automatically via URL!');
    }

    if (emailData.actionMode === 'send') {
      showStatus('⏳ JFH: Waiting for Send button...', 3000);
      
      // Smart polling for the Send button
      let sendBtn = null;
      for (let i = 0; i < 20; i++) { // Try for up to 10 seconds
        const buttons = Array.from(document.querySelectorAll('div[role="button"]'));
        sendBtn = buttons.find(b => b.textContent.trim() === 'Send' && b.offsetWidth > 0);
        
        if (sendBtn) break;
        await delay(500);
      }

      if (sendBtn) {
        showStatus('🚀 JFH: Clicking Send...', 3000);
        sendBtn.click();
        // Wait extra time for the email to actually dispatch before closing tab
        await delay(4000);
      } else {
        console.error('[JFH] Could not find Send button in view=cm mode');
      }
      
      chrome.runtime.sendMessage({
        type: 'EMAIL_SENT_CONFIRM',
        data: {
          founderId: emailData.founderId,
          email: emailData.to,
          success: !!sendBtn,
          status: 'sent'
        }
      });
    } else {
      showStatus('⏳ JFH: Waiting for Gmail to Auto-Save Draft...', 5000);

      // In view=cm mode, Gmail auto-saves. We just need to give it enough time (5 seconds)
      await delay(5000);
      showStatus('✅ JFH: Draft Saved!', 2000);
      await delay(1000);

      // Notify service worker that email was drafted successfully
      chrome.runtime.sendMessage({
        type: 'EMAIL_SENT_CONFIRM',
        data: {
          founderId: emailData.founderId,
          email: emailData.to,
          success: true,
          status: 'drafted'
        }
      });
    }
    
    return true;
  }

  // ========== Bulk Draft Processing ==========
  async function processBulkDrafts() {
    showStatus('🚀 JFH: Starting to send all drafts...', 0);
    let sentCount = 0;

    while (true) {
      await delay(2000);
      // Find the first draft row in the list
      const draftRow = document.querySelector('tr.zA[role="row"]');
      
      if (!draftRow) {
        showStatus('✅ JFH: All drafts processed!', 3000);
        break;
      }

      // Click the draft to open the compose window
      draftRow.click();
      await delay(2000);

      // Find active compose window
      const composeWindows = document.querySelectorAll('[role="dialog"]');
      if (composeWindows.length > 0) {
        const activeWindow = composeWindows[composeWindows.length - 1];
        
        // Find Send button
        const sendBtn = activeWindow.querySelector('.T-I.J-J5-Ji[role="button"][data-tooltip*="Send"], [aria-label*="Send"]');
        if (sendBtn) {
          showStatus(`📧 JFH: Sending draft ${sentCount + 1}...`, 0);
          sendBtn.click();
          sentCount++;
          await delay(3000); // Wait for send animation to complete and return to list
        } else {
          // If no send button, try closing it to avoid getting stuck
          const closeBtn = activeWindow.querySelector('[aria-label="Save & close"], img.Ha');
          if (closeBtn) closeBtn.click();
          await delay(1000);
        }
      }
    }

    chrome.runtime.sendMessage({
      type: 'BULK_DRAFTS_COMPLETED',
      data: { count: sentCount }
    });
  }

  // ========== Message Listener ==========
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'COMPOSE_EMAIL') {
      composeEmail(message.data).then(success => {
        sendResponse({ success });
      });
      return true;
    }

    if (message.type === 'PROCESS_BULK_DRAFTS') {
      processBulkDrafts();
      return true;
    }
    
    if (message.type === 'PING') {
      sendResponse({ ready: true, source: 'gmail-composer' });
    }
  });

  // Inject UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }

})();

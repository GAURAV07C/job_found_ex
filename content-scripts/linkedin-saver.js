/**
 * Job Founder Hunter - Global LinkedIn Saver
 * Runs on all websites
 * Provides a floating input box to save LinkedIn profiles from anywhere
 */

(function () {
  'use strict';

  if (window.__JFH_LINKEDIN_SAVER_LOADED) return;
  window.__JFH_LINKEDIN_SAVER_LOADED = true;

  console.log('[JFH] LinkedIn Saver loaded on:', window.location.href);

  // ========== Inject floating LinkedIn saver ==========
  function injectUI() {
    if (document.getElementById('jfh-linkedin-saver')) return;

    const saver = document.createElement('div');
    saver.id = 'jfh-linkedin-saver';
    saver.innerHTML = `
      <div id="jfh-linkedin-box">
        <input type="url" id="jfh-linkedin-input" placeholder="Paste LinkedIn profile URL here..." />
        <button id="jfh-linkedin-save-btn">💾 Save</button>
        <button id="jfh-linkedin-close-btn">×</button>
        <div id="jfh-linkedin-status" style="display:none;"></div>
      </div>
    `;
    saver.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 99999;
      font-family: 'Inter', 'Segoe UI', sans-serif;
    `;

    const box = document.createElement('div');
    box.id = 'jfh-linkedin-box';
    box.innerHTML = `
      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <input type="url" id="jfh-linkedin-input" placeholder="https://www.linkedin.com/in/username" 
          style="width: 280px; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.75); color: white; font-size: 13px; backdrop-filter: blur(10px); outline: none;" />
        <button id="jfh-linkedin-save-btn" 
          style="padding: 10px 18px; border-radius: 8px; border: none; background: linear-gradient(135deg, #0077B5, #00A0DC); color: white; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;">
          💾 Save LinkedIn
        </button>
        <button id="jfh-linkedin-close-btn" 
          style="padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; font-size: 12px; cursor: pointer;">
          ✕
        </button>
      </div>
      <div id="jfh-linkedin-status" style="display:none; margin-top: 6px; font-size: 11px; font-weight: 500; padding: 6px 10px; border-radius: 6px;"></div>
    `;
    box.style.cssText = `
      background: rgba(20, 20, 30, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 14px;
      padding: 12px 14px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(16px);
      min-width: 380px;
      max-width: 420px;
    `;

    saver.appendChild(box);
    document.body.appendChild(saver);

    // Toggle visibility with a small floating handle
    const handle = document.createElement('button');
    handle.id = 'jfh-linkedin-toggle';
    handle.textContent = '💼';
    handle.title = 'Save LinkedIn Profile';
    handle.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 100000;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #0077B5, #00A0DC);
      color: white;
      font-size: 20px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 119, 181, 0.5);
      transition: all 0.3s ease;
      display: none;
    `;
    document.body.appendChild(handle);

    const boxEl = document.getElementById('jfh-linkedin-box');
    const input = document.getElementById('jfh-linkedin-input');
    const saveBtn = document.getElementById('jfh-linkedin-save-btn');
    const closeBtn = document.getElementById('jfh-linkedin-close-btn');
    const statusEl = document.getElementById('jfh-linkedin-status');

    function showBox() {
      saver.style.display = 'block';
      handle.style.display = 'none';
      input.focus();
    }

    function hideBox() {
      saver.style.display = 'none';
      handle.style.display = 'block';
      if (statusEl) {
        statusEl.style.display = 'none';
      }
    }

    handle.addEventListener('click', showBox);
    closeBtn.addEventListener('click', hideBox);

    saveBtn.addEventListener('click', async () => {
      const url = input.value.trim();
      if (!url) {
        showStatus('Please enter a LinkedIn URL', 'error');
        return;
      }

      if (!url.includes('linkedin.com/in/')) {
        showStatus('Invalid LinkedIn profile URL', 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      showStatus('Saving...', 'progress');

      try {
        const response = await chrome.runtime.sendMessage({
          type: 'SAVE_LINKEDIN_PROFILE',
          data: {
            linkedinUrl: url,
            options: {
              name: extractNameFromUrl(url)
            }
          }
        });

        if (response && response.isDuplicate) {
          showStatus(`✅ Already saved: ${response.name || 'this profile'}`, 'info');
        } else if (response) {
          showStatus(`✅ Saved: ${response.name || 'LinkedIn profile'}`, 'success');
          input.value = '';
        } else {
          showStatus('❌ Failed to save', 'error');
        }
      } catch (error) {
        showStatus('❌ Error: ' + error.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save LinkedIn';
      }
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveBtn.click();
    });

    function showStatus(text, type) {
      statusEl.style.display = 'block';
      statusEl.textContent = text;
      const colors = {
        success: '#00B894',
        error: '#E17055',
        progress: '#0984E3',
        info: '#6C5CE7'
      };
      statusEl.style.background = colors[type] || colors.info;
      statusEl.style.color = 'white';
    }

    function extractNameFromUrl(url) {
      try {
        const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
        if (match && match[1]) {
          return match[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
      } catch (e) {}
      return '';
    }

    // Show the box by default on first load
    setTimeout(showBox, 500);
  }

  // Auto-inject UI
  function tryInjectUI() {
    if (document.body) {
      injectUI();
    } else {
      const observer = new MutationObserver(() => {
        if (document.body) {
          injectUI();
          observer.disconnect();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInjectUI);
  } else {
    tryInjectUI();
  }
})();

/**
 * Job Founder Hunter - WorkAtAStartup Job Applier
 * Auto-applies to jobs on workatastartup.com with smart personalized messages
 */

(function () {
  'use strict';

  if (window.__JFH_WAS_APPLIER_LOADED) return;
  window.__JFH_WAS_APPLIER_LOADED = true;

  console.log('[JFH] WAS Applier loaded on:', window.location.href);

  // ========== Smart Message Generator ==========
  function generateSmartMessage(jobTitle, companyName, settings) {
    const title = (jobTitle || '').toLowerCase();
    const fullName = settings.userName || 'Gaurav Kumar';
    const portfolioLink = settings.portfolioLink || 'https://gaurav07c.vercel.app';
    const resumeLink = settings.resumeLink || 'https://resume-lemon-rho.vercel.app/';
    const experience = settings.experience ? `with ${settings.experience} of experience` : '';

    // Core identity: MERN + Full Stack
    const coreStack = 'React, Node.js, Express, MongoDB (MERN Stack)';

    let roleSpecificLine = '';

    if (title.includes('frontend') || title.includes('front-end') || title.includes('react') || title.includes('ui') || title.includes('vue') || title.includes('angular')) {
      roleSpecificLine = settings.wasTplFrontend || `As a full-stack developer with a strong frontend focus, I specialize in building fast, scalable React applications — from complex state management with Redux/Zustand to pixel-perfect UIs with Tailwind CSS. My MERN stack background means I can collaborate seamlessly across the entire product.`;
    } else if (title.includes('backend') || title.includes('back-end') || title.includes('api') || title.includes('node') || title.includes('server') || title.includes('python') || title.includes('golang')) {
      roleSpecificLine = settings.wasTplBackend || `As a full-stack developer with deep backend experience, I design and build robust REST APIs and server-side systems using Node.js, Express, and MongoDB. I care deeply about clean architecture, performance, and reliability — and my full-stack knowledge means I can ship features end-to-end when needed.`;
    } else if (title.includes('fullstack') || title.includes('full stack') || title.includes('full-stack') || title.includes('software engineer') || title.includes('software developer')) {
      roleSpecificLine = settings.wasTplFullstack || `I'm a full-stack MERN developer who loves building complete products — from designing MongoDB schemas and building Express APIs in Node.js, to crafting polished, responsive React frontends. I thrive in startup environments where one person can make a huge difference.`;
    } else if (title.includes('devops') || title.includes('infra') || title.includes('cloud') || title.includes('platform') || title.includes('sre') || title.includes('kubernetes')) {
      roleSpecificLine = settings.wasTplDefault || `My full-stack MERN background gives me a deep understanding of what applications need at the infrastructure level. I've deployed and managed Node.js/React apps on cloud platforms, set up CI/CD pipelines, and worked with Docker to keep deployments smooth and reliable.`;
    } else if (title.includes('mobile') || title.includes('ios') || title.includes('android') || title.includes('react native') || title.includes('flutter')) {
      roleSpecificLine = settings.wasTplDefault || `With a strong React foundation from full-stack MERN development, I've extended my skills to React Native for cross-platform mobile apps. I can build and connect mobile frontends to Node.js + Express backends — delivering a consistent experience across web and mobile.`;
    } else if (title.includes('data') || title.includes('ml') || title.includes('machine learning') || title.includes('ai') || title.includes('analytics')) {
      roleSpecificLine = settings.wasTplDefault || `My full-stack MERN experience equips me to build data pipelines, dashboards, and AI-powered features end-to-end — from integrating ML APIs in Node.js backends to visualizing results in clean React interfaces.`;
    } else {
      // Default: general software
      roleSpecificLine = settings.wasTplDefault || `I'm a full-stack MERN developer passionate about building real products — React frontends, Node.js + Express backends, and MongoDB databases. I love working at the intersection of product and engineering and thrive in fast-moving startup environments.`;
    }

    return `Hi! I'm ${fullName}, a Full Stack Developer (${coreStack})${experience ? ' ' + experience : ''}. ${roleSpecificLine}

I've been following ${companyName}'s work and I'm genuinely excited about what you're building. I'd love to bring my full-stack skills to your team and help ship impactful features fast.

Portfolio: ${portfolioLink}
Resume: ${resumeLink}

Would love to connect and learn more!`;
  }

  // ========== UI Injection ==========
  function injectUI() {
    if (document.getElementById('jfh-was-fab')) return;

    const fab = document.createElement('div');
    fab.id = 'jfh-was-fab';
    fab.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      font-family: 'Inter', 'Segoe UI', sans-serif;
    `;

    fab.innerHTML = `
      <button id="jfh-was-apply-btn" title="Auto-apply to all visible jobs">
        🚀 Auto-Apply All Jobs
      </button>
      <div id="jfh-was-status" style="display:none;"></div>
    `;
    document.body.appendChild(fab);

    const btn = document.getElementById('jfh-was-apply-btn');
    btn.style.cssText = `
      background: linear-gradient(135deg, #00b894, #00cec9);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 184, 148, 0.4);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
    });
    btn.addEventListener('click', () => startAutoApply());
  }

  function showStatus(text, type = 'info') {
    const statusEl = document.getElementById('jfh-was-status');
    if (!statusEl) return;
    const colors = {
      info: '#6C5CE7',
      success: '#00B894',
      error: '#E17055',
      progress: '#0984E3',
    };
    statusEl.style.cssText = `
      display: block;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      max-width: 320px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    statusEl.textContent = text;
  }

  // ========== Scrape ALL Job Links from listing page ==========
  function scrapeJobCards() {
    const jobs = [];
    const seen = new Set();

    // Only pick links with a numeric job ID like /jobs/92753
    // Ignore category links like /jobs/r/software-engineer
    const allLinks = document.querySelectorAll('a[href]');

    allLinks.forEach(a => {
      const href = a.href || '';
      // Must match pattern: /jobs/<number>
      if (!/\/jobs\/\d+/.test(href)) return;
      // Deduplicate
      const cleanUrl = href.split('?')[0].split('#')[0];
      if (seen.has(cleanUrl)) return;
      seen.add(cleanUrl);

      // Extract job title from the link text or nearby heading
      let jobTitle = a.textContent?.trim() || '';
      if (!jobTitle || jobTitle.length < 3) {
        // Try sibling/parent heading
        const heading = a.closest('div, li, article')?.querySelector('h2, h3, strong, [class*="title"], [class*="role"]');
        jobTitle = heading?.textContent?.trim() || '';
      }
      // Final fallback from URL
      if (!jobTitle) {
        const match = cleanUrl.match(/\/jobs\/(\d+)/);
        jobTitle = match ? `Job #${match[1]}` : 'Software Engineer';
      }

      // Extract company name from nearby context
      const container = a.closest('div, li, article, tr');
      const companyEl = container?.querySelector('[class*="company"], [class*="org"], [class*="name"]');
      const companyName = companyEl?.textContent?.trim() || '';

      jobs.push({ jobUrl: cleanUrl, jobTitle, companyName });
    });

    console.log(`[JFH] Scraped ${jobs.length} unique job links from listing page.`);
    return jobs;
  }

  // ========== Fill and Submit Reach Out Form ==========
  async function fillAndSubmitReachOut(jobTitle, companyName, settings) {
    const maxWait = 8000; // 8 seconds max wait for elements
    let start = Date.now();

    // 1. Find and click the initial "Apply" button (WaaS uses an <a> tag with bg-orange-500)
    let initialApplyBtn = null;
    while (Date.now() - start < maxWait) {
      // Primary: look for the orange Apply button (WaaS specific)
      initialApplyBtn = document.querySelector('a.bg-orange-500, a[class*="bg-orange"]');
      
      // Fallback: any clickable element with exact text "Apply"
      if (!initialApplyBtn) {
        const allClickables = [...document.querySelectorAll('button, a')];
        initialApplyBtn = allClickables.find(el => {
          const text = el.textContent?.trim();
          return (
            text === 'Apply' ||
            text === 'Apply now' ||
            text === 'Reach out' ||
            (text || '').toLowerCase().startsWith('reach out to')
          );
        });
      }
      
      if (initialApplyBtn) {
        console.log('[JFH] Found Apply button:', initialApplyBtn.textContent.trim());
        initialApplyBtn.click();
        break;
      }
      await delay(300);
    }
    
    if (!initialApplyBtn) {
      console.warn('[JFH] Initial Apply button not found on job page');
      return { success: false, reason: 'no_initial_apply_button' };
    }

    // 2. Wait for the modal textarea to appear
    start = Date.now();
    let textarea = null;
    while (Date.now() - start < maxWait) {
      textarea = document.querySelector(
        'textarea[placeholder*="about me"], textarea[placeholder*="looking for"], textarea[name*="message"], textarea[name*="note"], textarea[class*="message"], textarea[id*="message"], form textarea'
      );
      if (textarea) break;
      await delay(300);
    }

    if (!textarea) {
      return { success: false, reason: 'form_modal_not_found' };
    }

    // 3. Fill the message and click Send
    const message = generateSmartMessage(jobTitle, companyName, settings);
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeInputValueSetter.call(textarea, message);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    await delay(500);

    const form = textarea.closest('form') || document;
    const submitBtn = form.querySelector(
      'button[type="submit"], button[class*="submit"], button[class*="send"], input[type="submit"]'
    ) || Array.from(document.querySelectorAll('button')).find(b => {
      const txt = b.textContent?.toLowerCase() || '';
      return txt.includes('send') || txt.includes('submit');
    });

    if (submitBtn && !submitBtn.disabled) {
      submitBtn.click();
      
      // 4. Extract Company URL to route to founder scraping
      await delay(1000); // give it a moment
      const companyLinkEl = document.querySelector('a[href^="/companies/"]');
      let companyProfileUrl = companyLinkEl ? companyLinkEl.href : '';
      if (companyProfileUrl && !companyProfileUrl.startsWith('http')) {
         companyProfileUrl = 'https://www.workatastartup.com' + companyProfileUrl;
      }
      
      return { success: true, message, companyProfileUrl };
    } else {
      console.warn('[JFH] Send button not found or disabled in modal');
      return { success: false, reason: 'no_send_button' };
    }
  }

  // ========== Apply to a Single Job (manual single apply from list page) ==========
  async function applyToJob(job, settings) {
    return safeSendMessage({
      type: 'OPEN_WAS_JOB',
      data: { job, settings }
    });
  }


  // ========== Main Auto-Apply Flow ==========
  async function startAutoApply() {
    // Guard: If extension was reloaded, context will be invalid. User must refresh the tab.
    if (!chrome.runtime?.id) {
      alert('[Job Founder Hunter] Extension was reloaded. Please refresh this tab (F5) and try again.');
      return;
    }

    const btn = document.getElementById('jfh-was-apply-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Applying...';
    }

    // Get user settings
    const settings = await safeSendMessage({ type: 'GET_SETTINGS' });


    showStatus('🔍 Finding jobs on page...', 'progress');

    // Scroll to load more jobs
    await scrollToLoad();

    const jobs = scrapeJobCards();
    showStatus(`📋 Found ${jobs.length} jobs. Starting applications...`, 'info');

    if (jobs.length === 0) {
      showStatus('❌ No job cards found on this page.', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🚀 Auto-Apply All Jobs'; }
      return;
    }

    // Send job list to service worker to process one by one
    const response = await safeSendMessage({ type: 'START_WAS_APPLY', data: { jobs, settings } });
    if (response?.success) {
      showStatus(`✅ Queued ${jobs.length} jobs for auto-apply!`, 'success');
    } else {
      showStatus('⚠️ Could not queue jobs. Check console.', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = '🚀 Auto-Apply All Jobs'; }
  }

  // ========== Infinite Scroll — runs until no new content loads ==========
  async function scrollToLoad() {
    let prevHeight = 0;
    let sameCount = 0;
    let scrollNum = 0;
    const btn = document.getElementById('jfh-was-apply-btn');

    while (true) {
      scrollNum++;
      window.scrollTo(0, document.body.scrollHeight);
      await delay(2000);

      const currHeight = document.body.scrollHeight;
      if (currHeight === prevHeight) {
        sameCount++;
        if (sameCount >= 3) break; // 6 seconds of no new content = we hit bottom
      } else {
        sameCount = 0;
      }
      prevHeight = currHeight;

      if (btn) btn.textContent = `⏳ Loading jobs... (scroll ${scrollNum})`;
      if (scrollNum >= 100) break; // safety cap
    }
    window.scrollTo(0, 0);
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Safe wrapper — prevents crash if extension is reloaded mid-flow
  function safeSendMessage(msg) {
    return new Promise(resolve => {
      try {
        if (!chrome.runtime?.id) {
          console.warn('[JFH] Extension context invalidated, skipping message:', msg.type);
          return resolve(null);
        }
        chrome.runtime.sendMessage(msg, response => {
          if (chrome.runtime.lastError) {
            console.warn('[JFH] sendMessage error:', chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        console.warn('[JFH] Extension context invalidated:', e.message);
        resolve(null);
      }
    });
  }

  // ========== Listen for messages from service worker ==========
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FILL_JOB_APPLICATION') {
      const { jobTitle, companyName, settings } = message.data;

      fillAndSubmitReachOut(jobTitle, companyName, settings).then(result => {
        sendResponse(result);
      });
      return true; // async
    }

    if (message.type === 'PING') {
      sendResponse({ ready: true, source: 'was-applier' });
      return true;
    }
    
    if (message.type === 'TRIGGER_WAS_AUTO_APPLY') {
      console.log('[JFH] Auto-apply triggered externally!');
      startAutoApply();
      sendResponse({ success: true });
      return true;
    }
  });

  // ========== Auto-inject UI ==========
  function init() {
    // Only inject button on the jobs listing page or company detail page
    const path = window.location.pathname;
    if (path.startsWith('/jobs') || (path.startsWith('/companies/') && path.length > 11)) {
      injectUI();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

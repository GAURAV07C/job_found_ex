/**
 * Job Founder Hunter - Wellfound (AngelList) Scraper Content Script
 * Runs on wellfound.com pages
 * Extracts company and founder information
 */

(function () {
  'use strict';

  if (window.__JFH_WELLFOUND_SCRAPER_LOADED) return;
  window.__JFH_WELLFOUND_SCRAPER_LOADED = true;

  console.log('[JFH] Wellfound Scraper loaded on:', window.location.href);

  // ========== Inject floating action button ==========
  function injectUI() {
    const fab = document.createElement('div');
    fab.id = 'jfh-wf-fab';
    fab.innerHTML = `
      <button id="jfh-wf-scrape-btn" title="Scrape companies with Job Founder Hunter">
        🔍 JFH Scrape
      </button>
      <div id="jfh-wf-status" style="display:none;"></div>
    `;
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

    document.body.appendChild(fab);
    const btn = document.getElementById('jfh-wf-scrape-btn');
    btn.style.cssText = `
      background: linear-gradient(135deg, #00B894, #00CEC9);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 184, 148, 0.4);
      transition: all 0.3s ease;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = '0 6px 30px rgba(0, 184, 148, 0.6)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 20px rgba(0, 184, 148, 0.4)';
    });

    btn.addEventListener('click', () => startScraping());
  }

  function showStatus(text, type = 'info') {
    let statusEl = document.getElementById('jfh-wf-status');
    if (!statusEl) return;
    const colors = {
      info: '#0984E3',
      success: '#00B894',
      error: '#E17055',
      progress: '#6C5CE7',
    };
    statusEl.style.display = 'block';
    statusEl.style.cssText = `
      display: block;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      max-width: 300px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    statusEl.textContent = text;
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== Detect page type ==========
  function isStartupListPage() {
    const path = window.location.pathname;
    return path.includes('/jobs') || path.includes('/startups') || 
           path.includes('/discover') || path === '/';
  }

  function isStartupDetailPage() {
    const path = window.location.pathname;
    return path.startsWith('/company/') || path.match(/^\/[a-z0-9-]+$/i);
  }

  // ========== Scrape startup list ==========
  async function scrapeStartupList() {
    showStatus('📜 Loading startups...', 'progress');

    // Scroll to load more
    await scrollToLoadAll(30);

    showStatus('🔍 Extracting startup data...', 'progress');

    const companies = [];
    const seen = new Set();

    // Wellfound startup cards
    const cards = document.querySelectorAll(
      '[data-test="startup-card"], ' +
      'a[href*="/company/"], ' +
      '[class*="startup-link"], ' +
      '[class*="StartupResult"], ' +
      'div[class*="job"] a[href*="/company/"]'
    );

    cards.forEach(card => {
      let href = card.getAttribute('href') || card.querySelector('a')?.getAttribute('href');
      if (!href || seen.has(href)) return;
      seen.add(href);

      // Ensure full URL
      if (href.startsWith('/')) {
        href = `https://www.wellfound.com${href}`;
      }

      const nameEl = card.querySelector('h2, h3, h4, [class*="name"], [class*="title"]');
      const descEl = card.querySelector('[class*="tagline"], [class*="description"], p');

      const name = nameEl?.textContent?.trim() || '';
      const description = descEl?.textContent?.trim() || '';

      if (name) {
        companies.push({
          name,
          description,
          sourceUrl: href,
          source: 'wellfound',
          status: 'scraped',
        });
      }
    });

    return companies;
  }

  // ========== Scrape startup detail page ==========
  async function scrapeStartupDetail() {
    showStatus('🔍 Scraping startup details...', 'progress');
    await delay(2000);

    const company = {
      name: '',
      description: '',
      website: '',
      sourceUrl: window.location.href,
      source: 'wellfound',
      founders: [],
    };

    // Company name
    const nameEl = document.querySelector('h1, [class*="company-name"], [data-test="company-name"]');
    company.name = nameEl?.textContent?.trim() || '';

    // Description
    const descEl = document.querySelector(
      '[class*="tagline"], [class*="description"], [data-test="company-tagline"]'
    );
    company.description = descEl?.textContent?.trim() || '';

    // Website
    const websiteLink = document.querySelector(
      'a[href*="http"]:not([href*="wellfound"]):not([href*="linkedin"]):not([href*="twitter"]):not([href*="facebook"])'
    );
    company.website = websiteLink?.href || '';

    // ===== Find founders/team =====
    // Wellfound shows team members on company pages
    const teamSections = document.querySelectorAll(
      '[class*="team"], [class*="founders"], [class*="people"], [class*="members"]'
    );

    teamSections.forEach(section => {
      const members = section.querySelectorAll(
        '[class*="member"], [class*="person"], [class*="card"], [class*="founder"]'
      );

      members.forEach(member => {
        const name = member.querySelector(
          'h3, h4, [class*="name"], [class*="Name"], a[class*="name"]'
        )?.textContent?.trim() || '';
        
        const title = member.querySelector(
          '[class*="role"], [class*="title"], [class*="Role"], small'
        )?.textContent?.trim() || '';

        const linkedinLink = member.querySelector('a[href*="linkedin.com/in/"]')?.href || '';

        if (name) {
          const roleInfo = detectFounderRole(title);
          if (roleInfo.isFounder || title === '') {
            company.founders.push({
              name,
              title: title || 'Team Member',
              role: roleInfo.isFounder ? roleInfo.role : 'Team Member',
              linkedinUrl: linkedinLink,
              companyName: company.name,
            });
          }
        }
      });
    });

    // Fallback: Look for LinkedIn links anywhere on page
    if (company.founders.length === 0) {
      const linkedinLinks = document.querySelectorAll('a[href*="linkedin.com/in/"]');
      linkedinLinks.forEach(link => {
        const parent = link.closest('div, li, section');
        if (parent) {
          const name = parent.querySelector('h3, h4, strong, [class*="name"]')?.textContent?.trim() || '';
          const title = parent.querySelector('[class*="role"], [class*="title"], small')?.textContent?.trim() || '';
          
          if (name || link.href) {
            const username = link.href.match(/linkedin\.com\/in\/([^/?#]+)/);
            const displayName = name || (username ? username[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '');
            
            const roleInfo = detectFounderRole(title);
            company.founders.push({
              name: displayName,
              title: title || 'Founder',
              role: roleInfo.isFounder ? roleInfo.role : 'Founder',
              linkedinUrl: link.href,
              companyName: company.name,
            });
          }
        }
      });
    }

    return company;
  }

  function detectFounderRole(title) {
    if (!title) return { isFounder: false, role: '' };
    const lower = title.toLowerCase();
    if (lower.includes('co-founder') || lower.includes('cofounder')) return { isFounder: true, role: 'Co-Founder' };
    if (lower.includes('founder')) return { isFounder: true, role: 'Founder' };
    if (lower.includes('ceo')) return { isFounder: true, role: 'CEO' };
    if (lower.includes('cto')) return { isFounder: true, role: 'CTO' };
    return { isFounder: false, role: '' };
  }

  async function scrollToLoadAll(maxScrolls = 30) {
    let prevHeight = 0;
    let sameCount = 0;

    for (let i = 0; i < maxScrolls; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      await delay(1500);

      const loadMoreBtn = document.querySelector(
        'button[class*="load-more"], [class*="showMore"], button[class*="more"]'
      );
      if (loadMoreBtn) {
        loadMoreBtn.click();
        await delay(2000);
      }

      const currentHeight = document.body.scrollHeight;
      if (currentHeight === prevHeight) {
        sameCount++;
        if (sameCount >= 3) break;
      } else {
        sameCount = 0;
      }
      prevHeight = currentHeight;

      showStatus(`📜 Loading... scroll ${i + 1}/${maxScrolls}`, 'progress');
    }

    window.scrollTo(0, 0);
  }

  // ========== Main ==========
  async function startScraping() {
    try {
      const btn = document.getElementById('jfh-wf-scrape-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Scraping...';
      }

      let result;

      if (isStartupDetailPage()) {
        result = await scrapeStartupDetail();
        showStatus(`✅ Found: ${result.name} (${result.founders.length} founders)`, 'success');

        chrome.runtime.sendMessage({
          type: 'COMPANIES_SCRAPED',
          data: {
            companies: [result],
            founders: result.founders,
            source: 'wellfound',
            pageType: 'detail',
          },
        });
      } else {
        result = await scrapeStartupList();
        showStatus(`✅ Found ${result.length} startups!`, 'success');

        chrome.runtime.sendMessage({
          type: 'COMPANIES_SCRAPED',
          data: {
            companies: result,
            founders: [],
            source: 'wellfound',
            pageType: 'list',
          },
        });
      }

      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔍 JFH Scrape';
      }
    } catch (error) {
      console.error('[JFH] Wellfound scraping error:', error);
      showStatus(`❌ Error: ${error.message}`, 'error');

      chrome.runtime.sendMessage({
        type: 'SCRAPE_ERROR',
        data: { error: error.message, source: 'wellfound', url: window.location.href },
      });
    }
  }

  // ========== Message listener ==========
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE_PAGE') {
      startScraping().then(() => sendResponse({ success: true }));
      return true;
    }
    if (message.type === 'PING') {
      sendResponse({ ready: true, source: 'wellfound-scraper' });
      return true;
    }
  });

  // Auto-inject UI
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }

})();

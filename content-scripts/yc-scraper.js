/**
 * Job Founder Hunter - YC Scraper Content Script
 * Runs on ycombinator.com/companies pages
 * Extracts company and founder information
 */

(function () {
  'use strict';

  // Avoid double-injection
  if (window.__JFH_YC_SCRAPER_LOADED) return;
  window.__JFH_YC_SCRAPER_LOADED = true;

  console.log('[JFH] YC Scraper loaded on:', window.location.href);

  // ========== Inject floating action button ==========
  function injectUI() {
    const fab = document.createElement('div');
    fab.id = 'jfh-yc-fab';
    fab.innerHTML = `
      <button id="jfh-yc-scrape-btn" title="Scrape companies with Job Founder Hunter">
        🔍 JFH Scrape
      </button>
      <div id="jfh-yc-status" style="display:none;"></div>
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

    const btnStyle = `
      background: linear-gradient(135deg, #6C5CE7, #a855f7);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(108, 92, 231, 0.4);
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    document.body.appendChild(fab);
    const btn = document.getElementById('jfh-yc-scrape-btn');
    btn.style.cssText = btnStyle;

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.boxShadow = '0 6px 30px rgba(108, 92, 231, 0.6)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.boxShadow = '0 4px 20px rgba(108, 92, 231, 0.4)';
    });

    btn.addEventListener('click', () => startScraping());
  }

  function showStatus(text, type = 'info') {
    let statusEl = document.getElementById('jfh-yc-status');
    if (!statusEl) return;
    const colors = {
      info: '#6C5CE7',
      success: '#00B894',
      error: '#E17055',
      progress: '#0984E3',
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

  // ========== Detect page type ==========
  function isCompanyListPage() {
    return window.location.pathname === '/companies' || 
           window.location.pathname.startsWith('/companies?');
  }

  function isCompanyDetailPage() {
    // e.g., /companies/stripe
    const path = window.location.pathname;
    return path.startsWith('/companies/') && path.split('/').filter(Boolean).length >= 2;
  }

  // ========== Scrape company list page ==========
  async function scrapeCompanyList() {
    showStatus('📜 Scrolling to load all companies...', 'progress');

    // Scroll to load all companies (YC uses infinite scroll)
    await scrollToLoadAll();

    showStatus('🔍 Extracting company data...', 'progress');

    const companies = [];
    
    // YC company directory uses various selectors - try multiple
    const companyLinks = document.querySelectorAll(
      'a[href^="/companies/"][class*="company"], ' +
      'a[href^="/companies/"].WxyYeI, ' +
      'div[class*="CompanyList"] a[href^="/companies/"], ' +
      'a[href^="/companies/"]:not([href="/companies"])'
    );

    const seen = new Set();

    companyLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href === '/companies' || href === '/companies/' || seen.has(href)) return;
      
      // Skip filter/category links
      if (href.includes('?') || href.includes('#')) return;
      
      seen.add(href);

      // Look for specific elements that contain the name
      const nameEl = link.querySelector('span[class*="company-name"], .company-name, .coName, h4, span.font-bold, span[class*="name"]');
      const descEl = link.querySelector('span[class*="one-liner"], .one-liner, span[class*="description"], [class*="tagline"]');
      const batchEl = link.querySelector('span[class*="batch"], .pill, span[class*="YearBatch"], span[class*="pill"]');

      let name = cleanCompanyName(nameEl?.textContent?.trim() || '');
      const description = descEl?.textContent?.trim() || '';
      const batch = batchEl?.textContent?.trim() || '';

      // If name is still empty, try to get just the first text node of the link
      if (!name) {
         let rawName = link.childNodes.length > 0 ? Array.from(link.childNodes).find(n => n.nodeType === 3)?.textContent?.trim() : link.textContent?.trim();
         // If it's too long, it's probably the whole card text. Take the first line.
         if (rawName && rawName.length > 30) {
            rawName = rawName.split('\n')[0].trim();
         }
         name = cleanCompanyName(rawName);

      if (name && name.length > 0) {
        companies.push({
          name,
          description,
          batch,
          sourceUrl: `https://www.ycombinator.com${href}`,
          source: 'yc',
          status: 'scraped',
        });
      }
    });

    return companies;
  }

  // ========== Scrape company detail page ==========
  async function scrapeCompanyDetail() {
    await delay(1500); // Wait for page to fully render

    const company = {
      name: '',
      description: '',
      website: '',
      batch: '',
      sourceUrl: window.location.href,
      source: 'yc',
      founders: [],
    };

    // Company name
    const nameEl = document.querySelector('h1, [class*="company-name"]');
    company.name = cleanCompanyName(nameEl?.textContent?.trim() || document.title || '');

    // Description
    const descEl = document.querySelector('[class*="description"], [class*="tagline"], p[class*="prose"]');
    company.description = descEl?.textContent?.trim() || '';

    // Batch
    const batchEl = document.querySelector('[class*="batch"], [class*="pill"]');
    company.batch = batchEl?.textContent?.trim() || '';

    // ===== Find ALL founders / co-founders =====
    
    // Method 1: Look for "Active Founders" or Team section directly
    const teamSections = document.querySelectorAll('[class*="team"], [class*="founder"], [class*="people"], section');
    const seenFounders = new Set();

    teamSections.forEach(section => {
      // Find cards or containers inside the section
      const members = section.querySelectorAll('[class*="member"], [class*="person"], [class*="card"], div.flex.flex-col');
      
      members.forEach(member => {
        // Look for name (usually bold or a heading)
        const nameEl = member.querySelector('h3, h4, [class*="name"], .font-bold, strong');
        // Look for title/role
        const titleEl = member.querySelector('[class*="title"], [class*="role"], .text-sm, p.text-gray-500, p:not(.font-bold)');
        // Look for LinkedIn link specifically
        const linkedinLink = member.querySelector('a[href*="linkedin.com/in/"]');

        const memberName = nameEl?.textContent?.trim();
        const memberTitle = titleEl?.textContent?.trim();

        if (memberName && memberName.length > 2 && memberName !== company.name) {
          const roleInfo = detectFounderRole(memberTitle || 'Founder');
          
          if (roleInfo.isFounder && !seenFounders.has(memberName)) {
            seenFounders.add(memberName);
            company.founders.push({
              name: memberName,
              title: memberTitle || roleInfo.role || 'Founder',
              role: roleInfo.role || 'Founder',
              linkedinUrl: linkedinLink ? linkedinLink.href : '',
              companyName: company.name,
            });
          }
        }
      });
    });

    // Method 2: Fallback to scraping all LinkedIn links if the above didn't catch them
    const allLinkedInLinks = Array.from(document.querySelectorAll('a[href*="linkedin.com/in/"]'));

    for (const link of allLinkedInLinks) {
      const linkedinUrl = link.href;
      let memberName = '';
      let memberTitle = '';

      let container = link.closest('[class*="team"], [class*="founder"], [class*="member"], [class*="person"], [class*="card"], li, article') 
                    || link.parentElement?.parentElement 
                    || link.parentElement;

      if (container) {
        const nameEl = container.querySelector('h3, h4, h2, [class*="name"], .font-bold, strong, b');
        memberName = nameEl?.textContent?.trim() || '';
        const titleEl = container.querySelector('[class*="title"], [class*="role"], [class*="position"], .text-sm, small, p');
        memberTitle = titleEl?.textContent?.trim() || '';
      }

      if (!memberName) {
        const slug = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/);
        if (slug) {
          memberName = slug[1].replace(/-\d+$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        }
      }

      const roleInfo = detectFounderRole(memberTitle);
      const isLikelyFounder = roleInfo.isFounder || allLinkedInLinks.length <= 6;

      if (memberName && isLikelyFounder && !seenFounders.has(memberName)) {
        seenFounders.add(memberName);
        company.founders.push({
          name: memberName,
          title: memberTitle || roleInfo.role || 'Founder',
          role: roleInfo.role || 'Founder',
          linkedinUrl: linkedinUrl,
          companyName: company.name,
        });
      }
    }

    return company;
  }

  // ========== Utility: Detect founder role ==========
  function detectFounderRole(title) {
    if (!title) return { isFounder: false, role: '' };
    const lower = title.toLowerCase();
    
    if (lower.includes('co-founder') || lower.includes('cofounder')) {
      return { isFounder: true, role: 'Co-Founder' };
    }
    if (lower.includes('founder')) {
      return { isFounder: true, role: 'Founder' };
    }
    if (lower.includes('ceo')) {
      return { isFounder: true, role: 'CEO' };
    }
    if (lower.includes('cto')) {
      return { isFounder: true, role: 'CTO' };
    }
    return { isFounder: false, role: '' };
  }

  // ========== Utility: Scroll to load all ==========
  async function scrollToLoadAll(maxScrolls = 50) {
    let prevHeight = 0;
    let sameCount = 0;

    for (let i = 0; i < maxScrolls; i++) {
      window.scrollTo(0, document.body.scrollHeight);
      await delay(1200);

      // Try clicking "Load More" if exists
      let loadMoreBtn = document.querySelector('button[class*="load-more"], .load-more, [class*="showMore"]');
      if (!loadMoreBtn) {
        loadMoreBtn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent && (b.textContent.includes('Load more') || b.textContent.includes('Show more'))
        );
      }
      
      if (loadMoreBtn) {
        loadMoreBtn.click();
        await delay(2000);
      }

      const currentHeight = document.body.scrollHeight;
      if (currentHeight === prevHeight) {
        sameCount++;
        if (sameCount >= 3) break; // No more content to load
      } else {
        sameCount = 0;
      }
      prevHeight = currentHeight;

      showStatus(`📜 Loading... scroll ${i + 1}/${maxScrolls}`, 'progress');
    }

    // Scroll back to top
    window.scrollTo(0, 0);
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ========== Main scraping function ==========
  async function startScraping() {
    try {
      const btn = document.getElementById('jfh-yc-scrape-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ Scraping...';
      }

      let result;

      if (isCompanyDetailPage()) {
        // Scrape single company detail page
        result = await scrapeCompanyDetail();
        showStatus(`✅ Found: ${result.name} (${result.founders.length} founders)`, 'success');
        
        // Send to service worker
        chrome.runtime.sendMessage({
          type: 'COMPANIES_SCRAPED',
          data: {
            companies: [result],
            founders: result.founders,
            source: 'yc',
            pageType: 'detail',
          },
        });
      } else if (isCompanyListPage()) {
        // Scrape company list
        result = await scrapeCompanyList();
        showStatus(`✅ Found ${result.length} companies!`, 'success');
        
        // Send to service worker
        chrome.runtime.sendMessage({
          type: 'COMPANIES_SCRAPED',
          data: {
            companies: result,
            founders: [],
            source: 'yc',
            pageType: 'list',
          },
        });
      } else {
        showStatus('⚠️ Not a YC companies page', 'error');
      }

      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔍 JFH Scrape';
      }
    } catch (error) {
      console.error('[JFH] Scraping error:', error);
      showStatus(`❌ Error: ${error.message}`, 'error');
      
      chrome.runtime.sendMessage({
        type: 'SCRAPE_ERROR',
        data: { error: error.message, source: 'yc', url: window.location.href },
      });
    }
  }

  // ========== Listen for messages from service worker ==========
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE_PAGE') {
      startScraping().then(() => sendResponse({ success: true }));
      return true; // Keep channel open for async
    }

    if (message.type === 'SCRAPE_COMPANY_DETAIL') {
      const { companyId, companyName } = message.data;
      
      scrapeCompanyDetail().then(company => {
        // Build founders list including both Founder AND Co-Founder
        const founders = company.founders.filter(f => {
          const role = (f.title || f.role || '').toLowerCase();
          return (
            role.includes('founder') ||
            role.includes('co-founder') ||
            role.includes('cofounder') ||
            role.includes('ceo') ||
            role.includes('cto') ||
            role.includes('coo') ||
            role.includes('president') ||
            f.linkedinUrl // If we found a LinkedIn link near them, include anyway
          );
        });

        // Override companyName from what service worker sent (more reliable)
        founders.forEach(f => {
          f.companyName = companyName;
          f.companyId = companyId;
        });

        showStatus(`✅ Found ${founders.length} founders at ${companyName}`, 'success');

        chrome.runtime.sendMessage({
          type: 'COMPANY_FOUNDERS_FOUND',
          data: {
            companyId,
            founders
          }
        });

        sendResponse({ success: true, count: founders.length });
      }).catch(err => {
        console.error('[JFH] Detail scrape error:', err);
        // Still notify service worker so it can move on
        chrome.runtime.sendMessage({
          type: 'COMPANY_FOUNDERS_FOUND',
          data: { companyId, founders: [] }
        });
        sendResponse({ success: false });
      });

      return true;
    }
    
    if (message.type === 'PING') {
      sendResponse({ ready: true, source: 'yc-scraper' });
      return true;
    }
  });

  // ========== Auto-inject UI on load ==========
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectUI);
  } else {
    injectUI();
  }

})();

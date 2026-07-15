/**
 * Job Founder Hunter - Crunchbase Scraper
 * Injects a button to scrape startups from Crunchbase company search pages.
 */

(function () {
  'use strict';

  if (window.__JFH_CB_SCRAPER_LOADED) return;
  window.__JFH_CB_SCRAPER_LOADED = true;

  console.log('[JFH] Crunchbase Scraper loaded on:', window.location.href);

  function injectScrapeButton() {
    if (document.getElementById('jfh-cb-scrape-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'jfh-cb-scrape-btn';
    btn.innerHTML = '🔍 Scrape Crunchbase Startups';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      background: linear-gradient(135deg, #0f62fe, #3b82f6);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(15, 98, 254, 0.4);
      font-family: 'Inter', sans-serif;
    `;

    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Scraping Visible Data...';
      btn.disabled = true;
      
      const companies = scrapeCompanyList();
      
      if (companies.length === 0) {
        btn.textContent = '❌ No startups found on this page';
        setTimeout(() => {
          btn.textContent = '🔍 Scrape Crunchbase Startups';
          btn.disabled = false;
        }, 2000);
        return;
      }
      
      chrome.runtime.sendMessage({
        type: 'COMPANIES_SCRAPED',
        data: { companies }
      });
      
      btn.textContent = `✅ Scraped ${companies.length} Startups!`;
      setTimeout(() => {
        btn.textContent = '🔍 Scrape Next Page';
        btn.disabled = false;
      }, 3000);
    });

    document.body.appendChild(btn);
  }

  function scrapeCompanyList() {
    const companies = [];
    
    // Crunchbase grid rows
    const rows = document.querySelectorAll('grid-row, .grid-row, [role="row"]');
    
    rows.forEach((row, index) => {
      // Find the name/link
      const linkEl = row.querySelector('a[href*="/organization/"]');
      if (!linkEl) return;
      
      const name = linkEl.textContent.trim();
      if (!name) return;
      
      // Attempt to find description in adjacent cells
      let description = '';
      const cells = row.querySelectorAll('grid-cell, [role="gridcell"]');
      cells.forEach(cell => {
        const text = cell.textContent.trim();
        // Naive heuristic: if it's long enough, it might be the description
        if (text.length > 20 && text.length < 300 && !text.includes('$') && !text.includes('Funding')) {
          description = text;
        }
      });
      
      let relativeUrl = linkEl.getAttribute('href');
      let fullUrl = new URL(relativeUrl, window.location.origin).href;

      companies.push({
        id: `cb_${Date.now()}_${index}`,
        name: name,
        description: description,
        url: fullUrl,
        source: 'crunchbase',
        scrapedAt: new Date().toISOString()
      });
    });

    console.log(`[JFH] Extracted ${companies.length} startups from Crunchbase`);
    return companies;
  }

  // Inject UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScrapeButton);
  } else {
    injectScrapeButton();
  }

})();

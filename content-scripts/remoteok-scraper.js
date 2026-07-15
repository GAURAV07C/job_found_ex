/**
 * Job Founder Hunter - Remote OK Scraper
 * Injects a button to scrape startup companies from Remote OK job listings.
 */

(function () {
  'use strict';

  if (window.__JFH_REMOTEOK_SCRAPER_LOADED) return;
  window.__JFH_REMOTEOK_SCRAPER_LOADED = true;

  console.log('[JFH] Remote OK Scraper loaded on:', window.location.href);

  function injectScrapeButton() {
    if (document.getElementById('jfh-remoteok-scrape-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'jfh-remoteok-scrape-btn';
    btn.innerHTML = '🔍 Scrape Remote OK Companies';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      background: linear-gradient(135deg, #ff4742, #ff7171);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(255, 71, 66, 0.4);
      font-family: 'Inter', sans-serif;
    `;

    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Scraping Data...';
      btn.disabled = true;
      
      const companies = scrapeCompanyList();
      
      if (companies.length === 0) {
        btn.textContent = '❌ No companies found';
        setTimeout(() => {
          btn.textContent = '🔍 Scrape Remote OK Companies';
          btn.disabled = false;
        }, 2000);
        return;
      }
      
      chrome.runtime.sendMessage({
        type: 'COMPANIES_SCRAPED',
        data: { companies }
      });
      
      btn.textContent = `✅ Scraped ${companies.length} Companies!`;
      setTimeout(() => {
        btn.textContent = '🔍 Scrape Remote OK Companies';
        btn.disabled = false;
      }, 3000);
    });

    document.body.appendChild(btn);
  }

  function scrapeCompanyList() {
    const companies = [];
    const seenNames = new Set();
    
    // Remote OK job rows
    const rows = document.querySelectorAll('tr.job');
    
    rows.forEach((row, index) => {
      const nameEl = row.querySelector('h3[itemprop="name"]');
      const titleEl = row.querySelector('h2[itemprop="title"]'); // Job title can serve as description
      
      if (!nameEl) return;
      
      let name = nameEl.textContent.trim();
      if (!name || seenNames.has(name)) return; // Avoid duplicates from multiple jobs by same company
      
      seenNames.add(name);
      
      let description = titleEl ? `Hiring: ${titleEl.textContent.trim()}` : '';
      let url = window.location.href; // Remote OK doesn't always have standalone company pages

      companies.push({
        id: `rok_${Date.now()}_${index}`,
        name: name,
        description: description,
        url: url,
        source: 'remoteok',
        scrapedAt: new Date().toISOString()
      });
    });

    console.log(`[JFH] Extracted ${companies.length} startups from Remote OK`);
    return companies;
  }

  // Inject UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScrapeButton);
  } else {
    injectScrapeButton();
  }

})();

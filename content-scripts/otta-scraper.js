/**
 * Job Founder Hunter - Otta Scraper
 * Injects a button to scrape startup companies from Otta job feeds.
 */

(function () {
  'use strict';

  if (window.__JFH_OTTA_SCRAPER_LOADED) return;
  window.__JFH_OTTA_SCRAPER_LOADED = true;

  console.log('[JFH] Otta Scraper loaded on:', window.location.href);

  function injectScrapeButton() {
    if (document.getElementById('jfh-otta-scrape-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'jfh-otta-scrape-btn';
    btn.innerHTML = '🔍 Scrape Otta Companies';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      background: linear-gradient(135deg, #001A7A, #324CBB);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 26, 122, 0.4);
      font-family: 'Inter', sans-serif;
    `;

    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Scraping Data...';
      btn.disabled = true;
      
      const companies = scrapeCompanyList();
      
      if (companies.length === 0) {
        btn.textContent = '❌ No companies found';
        setTimeout(() => {
          btn.textContent = '🔍 Scrape Otta Companies';
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
        btn.textContent = '🔍 Scrape Otta Companies';
        btn.disabled = false;
      }, 3000);
    });

    document.body.appendChild(btn);
  }

  function scrapeCompanyList() {
    const companies = [];
    const seenNames = new Set();
    
    // Otta job cards
    const cards = document.querySelectorAll('[data-testid*="job-card"], [class*="JobCard"]');
    
    cards.forEach((card, index) => {
      const nameEl = card.querySelector('h2, h3, [data-testid="company-name"]');
      const titleEl = card.querySelector('[data-testid="job-title"]');
      
      if (!nameEl) return;
      
      let name = nameEl.textContent.trim();
      if (!name || seenNames.has(name)) return;
      
      seenNames.add(name);
      
      let description = titleEl ? `Hiring: ${titleEl.textContent.trim()}` : '';
      let url = window.location.href; // Otta feed

      companies.push({
        id: `otta_${Date.now()}_${index}`,
        name: name,
        description: description,
        url: url,
        source: 'otta',
        scrapedAt: new Date().toISOString()
      });
    });

    console.log(`[JFH] Extracted ${companies.length} startups from Otta`);
    return companies;
  }

  // Inject UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScrapeButton);
  } else {
    injectScrapeButton();
  }

})();

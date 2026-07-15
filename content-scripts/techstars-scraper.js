/**
 * Job Founder Hunter - Techstars Scraper
 * Injects a button to scrape startups from Techstars portfolio.
 */

(function () {
  'use strict';

  if (window.__JFH_TS_SCRAPER_LOADED) return;
  window.__JFH_TS_SCRAPER_LOADED = true;

  console.log('[JFH] Techstars Scraper loaded on:', window.location.href);

  function injectScrapeButton() {
    if (document.getElementById('jfh-ts-scrape-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'jfh-ts-scrape-btn';
    btn.innerHTML = '🔍 Scrape Techstars Startups';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      background: linear-gradient(135deg, #00d233, #009925);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 210, 51, 0.4);
      font-family: 'Inter', sans-serif;
    `;

    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Scraping Data...';
      btn.disabled = true;
      
      const companies = scrapeCompanyList();
      
      if (companies.length === 0) {
        btn.textContent = '❌ No startups found';
        setTimeout(() => {
          btn.textContent = '🔍 Scrape Techstars Startups';
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
        btn.textContent = '🔍 Scrape Techstars Startups';
        btn.disabled = false;
      }, 3000);
    });

    document.body.appendChild(btn);
  }

  function scrapeCompanyList() {
    const companies = [];
    
    // Techstars portfolio cards
    const cards = document.querySelectorAll('.portfolio-company-card, [class*="CompanyCard"]');
    
    cards.forEach((card, index) => {
      const nameEl = card.querySelector('h3, [class*="companyName"]');
      const descEl = card.querySelector('p, [class*="description"]');
      const linkEl = card.querySelector('a');
      
      if (!nameEl) return;
      
      let name = nameEl.textContent.trim();
      let description = descEl ? descEl.textContent.trim() : '';
      
      let relativeUrl = linkEl ? linkEl.getAttribute('href') : null;
      let fullUrl = relativeUrl ? new URL(relativeUrl, window.location.origin).href : window.location.href;

      companies.push({
        id: `ts_${Date.now()}_${index}`,
        name: name,
        description: description,
        url: fullUrl,
        source: 'techstars',
        scrapedAt: new Date().toISOString()
      });
    });

    console.log(`[JFH] Extracted ${companies.length} startups from Techstars`);
    return companies;
  }

  // Inject UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScrapeButton);
  } else {
    injectScrapeButton();
  }

})();

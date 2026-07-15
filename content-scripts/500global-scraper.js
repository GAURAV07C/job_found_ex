/**
 * Job Founder Hunter - 500 Global Scraper
 * Injects a button to scrape startups from 500 Global portfolio.
 */

(function () {
  'use strict';

  if (window.__JFH_500_SCRAPER_LOADED) return;
  window.__JFH_500_SCRAPER_LOADED = true;

  console.log('[JFH] 500 Global Scraper loaded on:', window.location.href);

  function injectScrapeButton() {
    if (document.getElementById('jfh-500-scrape-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'jfh-500-scrape-btn';
    btn.innerHTML = '🔍 Scrape 500 Global Startups';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      background: linear-gradient(135deg, #000000, #333333);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
      font-family: 'Inter', sans-serif;
    `;

    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Scraping Data...';
      btn.disabled = true;
      
      const companies = scrapeCompanyList();
      
      if (companies.length === 0) {
        btn.textContent = '❌ No startups found';
        setTimeout(() => {
          btn.textContent = '🔍 Scrape 500 Global Startups';
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
        btn.textContent = '🔍 Scrape 500 Global Startups';
        btn.disabled = false;
      }, 3000);
    });

    document.body.appendChild(btn);
  }

  function scrapeCompanyList() {
    const companies = [];
    
    // 500 Global portfolio grid
    const cards = document.querySelectorAll('.portfolio-item, [class*="portfolio"] [class*="item"]');
    
    cards.forEach((card, index) => {
      const nameEl = card.querySelector('h3, h4, [class*="name"], [class*="title"]');
      const descEl = card.querySelector('p, [class*="description"]');
      const linkEl = card.querySelector('a');
      
      if (!nameEl) return;
      
      let name = nameEl.textContent.trim();
      let description = descEl ? descEl.textContent.trim() : '';
      
      let relativeUrl = linkEl ? linkEl.getAttribute('href') : null;
      let fullUrl = relativeUrl ? new URL(relativeUrl, window.location.origin).href : window.location.href;

      companies.push({
        id: `500_${Date.now()}_${index}`,
        name: name,
        description: description,
        url: fullUrl,
        source: '500global',
        scrapedAt: new Date().toISOString()
      });
    });

    console.log(`[JFH] Extracted ${companies.length} startups from 500 Global`);
    return companies;
  }

  // Inject UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScrapeButton);
  } else {
    injectScrapeButton();
  }

})();

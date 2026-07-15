/**
 * Job Founder Hunter - Product Hunt Scraper
 * Injects a button to scrape startups from Product Hunt daily leaderboards.
 */

(function () {
  'use strict';

  if (window.__JFH_PH_SCRAPER_LOADED) return;
  window.__JFH_PH_SCRAPER_LOADED = true;

  console.log('[JFH] Product Hunt Scraper loaded on:', window.location.href);

  function injectScrapeButton() {
    if (document.getElementById('jfh-ph-scrape-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'jfh-ph-scrape-btn';
    btn.innerHTML = '🔍 Scrape Product Hunt Startups';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      background: linear-gradient(135deg, #da552f, #ea7351); /* Product Hunt Orange */
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(218, 85, 47, 0.4);
      font-family: 'Inter', sans-serif;
    `;

    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Scraping Data...';
      btn.disabled = true;
      
      const companies = scrapeCompanyList();
      
      if (companies.length === 0) {
        btn.textContent = '❌ No startups found';
        setTimeout(() => {
          btn.textContent = '🔍 Scrape Product Hunt Startups';
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
        btn.textContent = '🔍 Scrape Product Hunt Startups';
        btn.disabled = false;
      }, 3000);
    });

    document.body.appendChild(btn);
  }

  function scrapeCompanyList() {
    const companies = [];
    
    // Product Hunt list items usually have `data-test="post-item"`
    const cards = document.querySelectorAll('[data-test^="post-item"], [class*="styles_item"]');
    
    cards.forEach((card, index) => {
      // Find the name (usually an h3 or strong tag)
      const nameEl = card.querySelector('h1, h2, h3, strong, [class*="title"], [class*="name"]');
      const descEl = card.querySelector('p, span, [class*="tagline"], [class*="description"]');
      const linkEl = card.querySelector('a'); // Get the main link to the product page
      
      if (!nameEl) return;
      
      let name = nameEl.textContent.trim();
      let description = descEl ? descEl.textContent.trim() : '';
      
      let relativeUrl = linkEl ? linkEl.getAttribute('href') : null;
      let fullUrl = relativeUrl ? new URL(relativeUrl, window.location.origin).href : window.location.href;

      // Filter out ads
      if (name.toLowerCase() === 'promoted' || card.textContent.toLowerCase().includes('promoted')) {
        return; 
      }

      companies.push({
        id: `ph_${Date.now()}_${index}`,
        name: name,
        description: description,
        url: fullUrl,
        source: 'producthunt',
        scrapedAt: new Date().toISOString()
      });
    });

    console.log(`[JFH] Extracted ${companies.length} startups from Product Hunt`);
    return companies;
  }

  // Inject UI on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectScrapeButton);
  } else {
    injectScrapeButton();
  }

})();

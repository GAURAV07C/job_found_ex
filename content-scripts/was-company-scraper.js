/**
 * Job Founder Hunter - WorkAtAStartup Company Scraper
 * Extracts companies from list view, and founders/jobs from detail view.
 */

(function () {
  'use strict';

  if (window.__JFH_WAS_COMPANY_SCRAPER_LOADED) return;
  window.__JFH_WAS_COMPANY_SCRAPER_LOADED = true;

  console.log('[JFH] WAS Company Scraper loaded on:', window.location.href);

  const isListPage = window.location.pathname === '/companies' || window.location.pathname === '/companies/';
  
  // ==========================================
  // LIST PAGE SCRAPER (workatastartup.com/companies)
  // ==========================================
  function injectScrapeButton() {
    if (document.getElementById('jfh-was-scrape-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'jfh-was-scrape-btn';
    btn.innerHTML = '🔍 Scrape WaaS Companies';
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      background: linear-gradient(135deg, #0984e3, #74b9ff);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 50px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(9, 132, 227, 0.4);
      font-family: 'Inter', sans-serif;
    `;

    btn.addEventListener('click', async () => {
      btn.textContent = '⏳ Auto-Scrolling & Loading...';
      btn.disabled = true;
      
      // Scroll to load all companies dynamically until no more content loads
      let prevHeight = 0;
      let sameHeightCount = 0;
      let scrollCount = 0;
      
      while (true) {
        scrollCount++;
        window.scrollTo(0, document.body.scrollHeight);
        
        // Wait for potential network request and render
        await new Promise(r => setTimeout(r, 2000));
        
        const currHeight = document.body.scrollHeight;
        if (currHeight === prevHeight) {
          sameHeightCount++;
          // If height hasn't changed for 3 consecutive scrolls (6 seconds of waiting), assume we hit the very bottom
          if (sameHeightCount >= 3) {
            console.log(`[JFH] Reached bottom after ${scrollCount} scrolls.`);
            break; 
          }
        } else {
          sameHeightCount = 0;
        }
        
        prevHeight = currHeight;
        btn.textContent = `⏳ Loading... (Scroll ${scrollCount})`;
        
        // Failsafe to prevent infinite loops if something goes wrong (100 scrolls max)
        if (scrollCount >= 100) {
          console.log('[JFH] Reached max safety scroll limit (100).');
          break;
        }
      }
      
      window.scrollTo(0, 0);
      btn.textContent = '⏳ Scraping Data...';
      
      const companies = scrapeCompanyList();
      
      if (companies.length === 0) {
        btn.textContent = '❌ No companies found';
        setTimeout(() => {
          btn.textContent = '🔍 Scrape WaaS Companies';
          btn.disabled = false;
        }, 2000);
        return;
      }
      
      chrome.runtime.sendMessage({
        type: JFH_CONFIG.MESSAGES.COMPANIES_SCRAPED,
        data: { companies }
      });
      
      btn.textContent = `✅ Scraped ${companies.length} Companies!`;
      setTimeout(() => {
        btn.textContent = '🔍 Scrape WaaS Companies';
        btn.disabled = false;
      }, 3000);
    });

    document.body.appendChild(btn);
  }

  function scrapeCompanyList() {
    const companies = [];
    
    // Selectors for WaaS company cards (compact list view)
    const cards = document.querySelectorAll('.company-list-item, [class*="companyCard"], a[href^="/companies/"]');
    
    // We must deduplicate by URL
    const seenUrls = new Set();
    
    cards.forEach(card => {
      // Find the link
      let url = '';
      if (card.tagName.toLowerCase() === 'a') {
        url = card.getAttribute('href');
      } else {
        const a = card.querySelector('a[href^="/companies/"]');
        if (a) url = a.getAttribute('href');
      }
      
      if (!url) return;
      if (!url.startsWith('http')) {
        url = 'https://www.workatastartup.com' + url;
      }
      
      if (seenUrls.has(url)) return;
      seenUrls.add(url);
      
      // Extract name (usually an h2, h3, or a strong tag)
      const nameEl = card.querySelector('h1, h2, h3, .company-name, [class*="name"]');
      let name = nameEl ? nameEl.textContent.trim() : '';
      
      // If we couldn't find the name inside the card, we might try to infer from URL
      if (!name) {
        const parts = url.split('/');
        name = parts[parts.length - 1].replace(/-/g, ' ');
        // capitalize
        name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
      
      // Extract description
      const descEl = card.querySelector('.company-description, [class*="description"], [class*="tagline"]');
      const desc = descEl ? descEl.textContent.trim() : '';
      
      companies.push({
        id: 'was_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: name,
        description: desc,
        profileUrl: url,
        source: 'workatastartup',
        batch: 'WaaS', // WaaS doesn't always have explicit batches on list view
        scrapedAt: Date.now()
      });
    });
    
    return companies;
  }

  // ==========================================
  // DETAIL PAGE SCRAPER (Founders & Jobs)
  // ==========================================
  function extractFoundersFromDetail() {
    console.log('[JFH] Extracting WaaS founders from page...');
    
    const founders = [];
    const seen = new Set();

    // Get company name from page title or h1
    const companyNameEl = document.querySelector('h1.company-name, h1');
    const companyName = companyNameEl ? companyNameEl.textContent.trim() : document.title.split('-')[0].trim();

    // ---- Strategy 1: Find "Founders" heading and parse siblings/children ----
    const allHeadings = [...document.querySelectorAll('h2, h3, h4, div, p, span')];
    let foundersSection = null;
    for (const el of allHeadings) {
      if (/^founders?$/i.test(el.textContent?.trim())) {
        foundersSection = el;
        break;
      }
    }

    if (foundersSection) {
      // Collect next sibling elements until another heading or end
      let sibling = foundersSection.nextElementSibling;
      while (sibling) {
        // Stop at next major section heading
        if (/^(jobs|about|description|tech stack|funding|culture)$/i.test(sibling.textContent?.trim())) break;

        // Each founder block: has a name (usually bold/h3/strong) and a bio paragraph
        const nameEl = sibling.querySelector('h3, h4, strong, b, [class*="name"], [class*="founder"]') || 
                        (sibling.tagName.match(/H[2-4]/) ? sibling : null);
        
        if (nameEl) {
          const name = nameEl.textContent?.trim();
          if (!name || seen.has(name) || name.length < 3 || name.length > 60) {
            sibling = sibling.nextElementSibling;
            continue;
          }
          seen.add(name);

          // Get bio text
          const bioEl = sibling.querySelector('p, [class*="bio"], [class*="desc"]');
          const bio = bioEl ? bioEl.textContent.trim() : sibling.textContent.replace(name, '').trim();

          // Extract title from bio (e.g. "Co-Founder and COO at OneSignal")
          const titleMatch = bio.match(/^([\w\s,-]+at\s[\w\s]+)/i) || bio.match(/^(co-founder[^.]*)/i);
          const title = titleMatch ? titleMatch[1].trim() : 'Founder';

          // Try to find LinkedIn link near this element
          const linkedinEl = sibling.querySelector('a[href*="linkedin.com"]');
          const linkedinUrl = linkedinEl ? linkedinEl.href : '';

          // Extract email hint from LinkedIn slug or bio
          founders.push({
            id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name,
            title,
            bio,
            linkedinUrl,
            companyName,
            source: 'workatastartup',
            status: JFH_CONFIG.STATUS.PENDING,
            scrapedAt: Date.now()
          });
        }

        sibling = sibling.nextElementSibling;
      }
    }

    // ---- Strategy 2: Fallback - find any LinkedIn /in/ links on the page ----
    if (founders.length === 0) {
      const allLinks = document.querySelectorAll('a[href*="linkedin.com/in/"]');
      allLinks.forEach(link => {
        const parentText = (link.closest('div, section, li') || link.parentElement)?.textContent || '';
        const founderKeywords = ['founder', 'ceo', 'cto', 'coo', 'co-founder'];
        const isFounder = founderKeywords.some(kw => parentText.toLowerCase().includes(kw));
        
        if (!isFounder) return;

        let name = link.textContent.trim();
        if (!name || name.toLowerCase().includes('linkedin')) {
          const slug = link.href.split('linkedin.com/in/')[1]?.split('/')[0] || '';
          name = slug.replace(/-\d+$/, '').replace(/-/g, ' ')
                     .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        }

        if (!name || seen.has(name)) return;
        seen.add(name);

        founders.push({
          id: 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
          name,
          title: 'Founder',
          bio: '',
          linkedinUrl: link.href,
          companyName,
          source: 'workatastartup',
          status: JFH_CONFIG.STATUS.PENDING,
          scrapedAt: Date.now()
        });
      });
    }

    console.log(`[JFH] Found ${founders.length} founders for ${companyName}:`, founders.map(f => f.name));
    return founders;
  }
  // ==========================================
  // MESSAGE LISTENER

  // ==========================================
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SCRAPE_COMPANY_DETAIL') {
      console.log('[JFH] Service Worker requested WaaS detail scrape');
      
      // Wait for page to fully render
      setTimeout(async () => {
        // ---- Step 1: Check for relevant jobs on this company page ----
        const jobLinks = [...document.querySelectorAll('a[href]')]
          .filter(a => /\/jobs\/\d+/.test(a.href))
          .map(a => ({
            jobUrl: a.href.split('?')[0],
            jobTitle: a.textContent?.trim() || 'Software Engineer',
            companyName: document.querySelector('h1')?.textContent?.trim() || ''
          }));

        // Filter only relevant engineering roles
        const relevantKeywords = ['engineer', 'developer', 'frontend', 'backend', 'fullstack', 'full stack', 'full-stack', 'mern', 'react', 'node', 'software'];
        const relevantJobs = jobLinks.filter(j =>
          relevantKeywords.some(kw => j.jobTitle.toLowerCase().includes(kw))
        );

        if (relevantJobs.length > 0) {
          console.log(`[JFH] Found ${relevantJobs.length} relevant jobs on company page. Queuing apply...`);
          // Send to service worker to handle job applications in its own queue
          chrome.runtime.sendMessage({
            type: 'QUEUE_WAS_JOBS',
            data: { jobs: relevantJobs }
          });
        } else {
          console.log('[JFH] No relevant engineering jobs found on this company page. Skipping apply.');
        }

        // ---- Step 2: Always extract founders regardless ----
        const founders = extractFoundersFromDetail();
        console.log('[JFH] Extracted founders:', founders.map(f => f.name));
        
        sendResponse({ success: true, founders, jobsFound: relevantJobs.length });
      }, JFH_CONFIG.DELAYS.PAGE_LOAD_WAIT || 2000);
      
      return true; // Keep message channel open
    }
  });


  // Initialization
  if (isListPage) {
    injectScrapeButton();
  }

})();

/**
 * Job Founder Hunter - Background Scraper Module
 */

async function startScrapingFlow(data) {
  const { source, url } = data;

  chrome.tabs.create({ url, active: true }, (tab) => {
    // Content script will auto-load and inject UI.
    // User clicks the button on the page to trigger scraping,
    // which then sends COMPANIES_SCRAPED back here.
  });

  return { success: true, message: 'Tab opened. Please start scraping from the page.' };
}

async function handleScrapedData(data) {
  const { companies = [], founders = [], source = 'unknown' } = data;

  console.log(`[JFH] Saving ${companies.length} companies and ${founders.length} founders`);

  // Save companies
  for (const company of companies) {
    await JFH_DB.addCompany(company);

    // Auto-generate placeholder founders for platforms that don't have dedicated detail page scrapers
    const platformsNeedingPlaceholders = ['producthunt', 'crunchbase', 'techstars', '500global', 'antler', 'remoteok', 'otta'];
    if (platformsNeedingPlaceholders.includes(company.source) && founders.length === 0) {
      const searchKeywords = encodeURIComponent(`founder CEO ${company.name}`);
      founders.push({
        id: `fnd_${Date.now()}_${company.id}`,
        companyId: company.id,
        companyName: company.name,
        name: 'Founder (Auto-Search)',
        title: 'Founder / CEO',
        linkedinUrl: `https://www.linkedin.com/search/results/people/?keywords=${searchKeywords}`,
        source: company.source,
        contacted: false
      });
    }
  }

  // Save founders
  for (const founder of founders) {
    const companyRecords = await JFH_DB.getCompaniesBySource(source);
    // Try to map founder to correct company DB ID
    const matchingCompany = companyRecords.find(c => c.name === founder.companyName);

    if (matchingCompany) {
      founder.companyId = matchingCompany.id;
    }
    await JFH_DB.addFounder(founder);
  }

  // Trigger notification
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    title: 'Scraping Complete',
    message: `Saved ${companies.length} companies and ${founders.length} founders.`
  });

  broadcastState();
}

// ========== Founder Scraping Flow ==========

async function startFounderScraping() {
  if (JFH_State.isFounderScraping) return { error: 'Already scraping founders' };

  const companies = await JFH_DB.getAllCompanies();
  if (companies.length === 0) return { success: false, message: 'No companies found. Scrape leads first!' };

  // Filter companies that haven't had their detail page scraped
  JFH_State.founderScrapeQueue = companies.filter(c =>
    (c.source === 'yc' || c.source === 'workatastartup' || c.source === 'wellfound') &&
    (c.sourceUrl || c.profileUrl) &&
    !c.foundersScraped
  );
  JFH_State.founderScrapeIndex = 0;
  JFH_State.completedCount = 0;
  JFH_State.failedCount = 0;
  JFH_State.isFounderScraping = true;

  console.log(`[JFH] Starting founder scrape for ${JFH_State.founderScrapeQueue.length} companies`);
  broadcastFounderScrapeState();
  processNextCompany();

  return { success: true, count: JFH_State.founderScrapeQueue.length };
}

function broadcastFounderScrapeState(extra = {}) {
  const progress = JFH_State.founderScrapeQueue.length > 0
    ? Math.round((JFH_State.founderScrapeIndex / JFH_State.founderScrapeQueue.length) * 100)
    : 0;

  chrome.runtime.sendMessage({
    type: 'FOUNDER_SCRAPE_UPDATE',
    data: {
      isRunning: JFH_State.isFounderScraping,
      progress,
      current: JFH_State.founderScrapeIndex,
      total: JFH_State.founderScrapeQueue.length,
      ...extra
    }
  }).catch(() => {});
}

async function processNextCompany() {
  if (!JFH_State.isFounderScraping) return;

  if (JFH_State.founderScrapeIndex >= JFH_State.founderScrapeQueue.length) {
    JFH_State.isFounderScraping = false;
    broadcastFounderScrapeState({ message: 'All companies scanned!' });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      title: 'Founder Scan Complete!',
      message: `Scanned ${JFH_State.founderScrapeQueue.length} companies for founders.`
    });
    return;
  }

  const company = JFH_State.founderScrapeQueue[JFH_State.founderScrapeIndex];
  console.log(`[JFH] Scanning company ${JFH_State.founderScrapeIndex + 1}/${JFH_State.founderScrapeQueue.length}: ${company.name}`);
  broadcastFounderScrapeState({ currentCompany: company.name });

  // Close previous tab if still open
  if (JFH_State.founderScrapeTabId) {
    chrome.tabs.remove(JFH_State.founderScrapeTabId).catch(() => {});
    JFH_State.founderScrapeTabId = null;
  }

  // Safety timeout - if no response in 20s, skip to next
  let safetyTimer = setTimeout(() => {
    console.warn('[JFH] Safety timeout for:', company.name);
    if (JFH_State.founderScrapeTabId) {
      chrome.tabs.remove(JFH_State.founderScrapeTabId).catch(() => {});
      JFH_State.founderScrapeTabId = null;
    }
    JFH_State.founderScrapeIndex++;
    broadcastFounderScrapeState();
    setTimeout(processNextCompany, 1000);
  }, 22000);

  // Open company page
  const targetUrl = company.sourceUrl || company.profileUrl;
  chrome.tabs.create({ url: targetUrl, active: false }, (tab) => {
    JFH_State.founderScrapeTabId = tab.id;

    // Use polling to send message as soon as content script is ready
    sendMessageWithRetry(tab.id, {
      type: 'SCRAPE_COMPANY_DETAIL',
      data: { companyId: company.id, companyName: company.name }
    }, 15, 1000)
    .then(response => {
      clearTimeout(safetyTimer);
      console.log(`[JFH] Scrape response from ${company.name}:`, response);
      // handleCompanyFounders will call processNextCompany after saving
    })
    .catch(err => {
      clearTimeout(safetyTimer);
      console.warn('[JFH] Content script not ready on:', company.name, err.message);
      // Close tab and skip
      if (JFH_State.founderScrapeTabId) {
        chrome.tabs.remove(JFH_State.founderScrapeTabId).catch(() => {});
        JFH_State.founderScrapeTabId = null;
      }
      JFH_State.founderScrapeIndex++;
      broadcastFounderScrapeState();
      setTimeout(processNextCompany, 1000);
    });
  });
}

async function handleCompanyFounders(data) {
  const { companyId, founders } = data;

  // Prevent race conditions: ignore if we already moved on
  const expectedCompany = JFH_State.founderScrapeQueue[JFH_State.founderScrapeIndex];
  if (!expectedCompany || expectedCompany.id !== companyId) {
    console.warn('[JFH] Ignoring stale company response for:', companyId);
    return { success: false, message: 'Stale response' };
  }

  for (const founder of founders) {
    founder.companyId = companyId;
    await JFH_DB.addFounder(founder);
  }

  console.log(`[JFH] Saved ${founders.length} founders for company ${companyId}`);

  // Mark company as having founders scraped
  const company = await JFH_DB.getCompany(companyId);
  if (company) {
    company.foundersScraped = true;
    await JFH_DB._put('companies', company);
  }

  // Close tab and move to next company
  if (JFH_State.founderScrapeTabId) {
    chrome.tabs.remove(JFH_State.founderScrapeTabId).catch(() => {});
    JFH_State.founderScrapeTabId = null;
  }

  JFH_State.founderScrapeIndex++;
  broadcastFounderScrapeState();
  setTimeout(processNextCompany, 2000);

  return { success: true };
}

const JFH_Scraper = {
  startScrapingFlow,
  handleScrapedData,
  startFounderScraping,
  processNextCompany,
  handleCompanyFounders
};

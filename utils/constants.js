/**
 * Job Founder Hunter - Constants & Configuration
 * All selectors, URLs, and settings in one place
 */

const JFH_CONFIG = {
  // ========== DELAYS (milliseconds) ==========
  DELAYS: {
    BETWEEN_COMPANIES: 3000,      // 3s between company page opens
    BETWEEN_LINKEDIN: 4000,       // 4s between LinkedIn opens
    BETWEEN_EMAILS: 5000,         // 5s between Gmail compose
    PAGE_LOAD_WAIT: 2000,         // 2s wait for page to load
    SCROLL_DELAY: 1000,           // 1s between scrolls
    EMAIL_DETECTION_TIMEOUT: 30000, // 30s max wait for email finder
    GMAIL_COMPOSE_WAIT: 2000,     // 2s wait for Gmail compose UI
  },

  // ========== YC SELECTORS ==========
  YC: {
    BASE_URL: 'https://www.ycombinator.com/companies',
    COMPANY_CARD: 'a[class*="company"]',
    COMPANY_NAME: 'span[class*="company-name"], .company-name, h4',
    COMPANY_DESC: 'span[class*="company-one-liner"], .one-liner',
    COMPANY_BATCH: 'span[class*="batch"], .pill',
    COMPANY_LINK: 'a[href*="/companies/"]',
    // Company detail page
    TEAM_SECTION: '.team-section, [class*="team"], [class*="founder"]',
    TEAM_MEMBER: '.team-member, [class*="team-member"], [class*="person"]',
    MEMBER_NAME: '.team-member-name, [class*="name"], h3',
    MEMBER_TITLE: '.team-member-title, [class*="title"], [class*="role"]',
    LINKEDIN_LINK: 'a[href*="linkedin.com"]',
    LOAD_MORE_BTN: 'button[class*="load-more"], .load-more, [class*="showMore"]',
    // Founder keywords
    FOUNDER_KEYWORDS: ['founder', 'co-founder', 'cofounder', 'ceo', 'cto'],
  },

  // ========== WELLFOUND SELECTORS ==========
  WELLFOUND: {
    BASE_URL: 'https://www.wellfound.com',
    COMPANY_CARD: '[class*="startup-link"], [data-test="startup-card"]',
    COMPANY_NAME: 'h2, [class*="name"]',
    COMPANY_DESC: '[class*="tagline"], [class*="description"]',
    TEAM_SECTION: '[class*="team"], [class*="people"], [class*="founders"]',
    TEAM_MEMBER: '[class*="member"], [class*="person"], [class*="founder-card"]',
    MEMBER_NAME: '[class*="name"], h3, h4',
    MEMBER_TITLE: '[class*="role"], [class*="title"]',
    LINKEDIN_LINK: 'a[href*="linkedin.com"]',
    FOUNDER_KEYWORDS: ['founder', 'co-founder', 'cofounder', 'ceo', 'cto'],
  },

  // ========== LINKEDIN SELECTORS ==========
  LINKEDIN: {
    PROFILE_NAME: 'h1.text-heading-xlarge, h1[class*="name"], .pv-top-card h1',
    PROFILE_TITLE: '.text-body-medium, [class*="headline"], .pv-top-card div[class*="text-body"]',
    PROFILE_COMPANY: '[class*="experience"] span[class*="t-bold"]',
    CONTACT_INFO_BTN: '#top-card-text-details-contact-info, a[href*="contact-info"]',
    EMAIL_FIELD: 'a[href^="mailto:"], [class*="email"]',
    // Email finder extension detection selectors
    EMAIL_FINDERS: {
      HUNTER: '.hunter-email, [class*="hunter"] [class*="email"], [data-hunter-email]',
      LUSHA: '.lusha-email, [class*="lusha"] [class*="email"], [data-lusha]',
      APOLLO: '.apollo-email, [class*="apollo"] [class*="email"], [data-apollo]',
      SNOV: '.snov-email, [class*="snov"] [class*="email"]',
      ROCKETREACH: '[class*="rocketreach"] [class*="email"]',
      // Generic pattern - most extensions inject email near contact section
      GENERIC: '[class*="email-finder"], [data-email], [class*="found-email"]',
    },
  },

  // ========== GMAIL SELECTORS ==========
  GMAIL: {
    COMPOSE_BTN: '.T-I.T-I-KE.L3, [role="button"][gh="cm"]',
    TO_FIELD: 'input[name="to"], textarea[name="to"], [aria-label*="To"]',
    SUBJECT_FIELD: 'input[name="subjectbox"], input[name="subject"]',
    BODY_FIELD: '.Am.Al.editable, [role="textbox"][aria-label*="Body"], div[contenteditable="true"][aria-label*="Body"]',
    SEND_BTN: '.T-I.J-J5-Ji[role="button"][data-tooltip*="Send"], [aria-label*="Send"]',
  },

  // ========== DATABASE ==========
  DB: {
    NAME: 'JobFounderHunterDB',
    VERSION: 1,
    STORES: {
      COMPANIES: 'companies',
      FOUNDERS: 'founders',
      EMAILS_SENT: 'emails_sent',
      SETTINGS: 'settings',
    },
  },

  // ========== STATUS CODES ==========
  STATUS: {
    PENDING: 'pending',
    SCRAPING: 'scraping',
    SCRAPED: 'scraped',
    LINKEDIN_OPENED: 'linkedin_opened',
    EMAIL_FOUND: 'email_found',
    EMAIL_SENT: 'email_sent',
    SKIPPED: 'skipped',
    ERROR: 'error',
    COMPLETED: 'completed',
    PAUSED: 'paused',
  },

  // ========== BACKEND (Nodemailer + Queue) ==========
  BACKEND: {
    DEFAULT_URL: 'https://job-found-exapi.vercel.app',
    DEFAULT_API_KEY: 'job-founder-hunter-dev-key',
    SEND_ENDPOINT: '/api/send',
    QUEUE_ENDPOINT: '/api/queue',
    TRACK_ENDPOINT: '/api/tracking',
    SENT_ENDPOINT: '/api/sent',
    HEALTH_ENDPOINT: '/api/health',
  },

  // ========== MESSAGE TYPES ==========
  MESSAGES: {
    // Popup → Service Worker
    START_SCRAPING: 'START_SCRAPING',
    FIND_ALL_EMAILS: 'FIND_ALL_EMAILS',
    SEND_ALL_BACKEND: 'SEND_ALL_BACKEND',
    SEND_ALL_BACKEND_NORMAL: 'SEND_ALL_BACKEND_NORMAL',
    PAUSE_PROCESS: 'PAUSE_PROCESS',
    RESUME_PROCESS: 'RESUME_PROCESS',
    STOP_PROCESS: 'STOP_PROCESS',
    GET_STATS: 'GET_STATS',
    GET_FOUNDERS: 'GET_FOUNDERS',
    GET_COMPANIES: 'GET_COMPANIES',
    EXPORT_DATA: 'EXPORT_DATA',
    CLEAR_DATA: 'CLEAR_DATA',
    SAVE_SETTINGS: 'SAVE_SETTINGS',
    GET_SETTINGS: 'GET_SETTINGS',
    SAVE_LINKEDIN_PROFILE: 'SAVE_LINKEDIN_PROFILE',
    
    // Content Script → Service Worker
    COMPANIES_SCRAPED: 'COMPANIES_SCRAPED',
    FOUNDERS_FOUND: 'FOUNDERS_FOUND',
    EMAIL_DETECTED: 'EMAIL_DETECTED',
    EMAIL_SENT_CONFIRM: 'EMAIL_SENT_CONFIRM',
    SCRAPE_ERROR: 'SCRAPE_ERROR',
    
    // Service Worker → Content Script
    SCRAPE_PAGE: 'SCRAPE_PAGE',
    COMPOSE_EMAIL: 'COMPOSE_EMAIL',
    DETECT_EMAIL: 'DETECT_EMAIL',
    
    // Service Worker → Popup
    PROGRESS_UPDATE: 'PROGRESS_UPDATE',
    STATUS_UPDATE: 'STATUS_UPDATE',
    STATS_RESPONSE: 'STATS_RESPONSE',
  },
};

// Make available in both content scripts and modules
if (typeof window !== 'undefined') {
  window.JFH_CONFIG = JFH_CONFIG;
}

/**
 * Clean a raw company name scraped from a directory/detail page.
 * Strips fused location, tagline, batch, industry, and other appended metadata
 * so the name is safe to drop into a cold-email subject/body.
 *
 * @param {string} raw
 * @returns {string}
 */
function cleanCompanyName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let name = raw.trim();

  // Remove parenthetical / bracketed metadata FIRST: "(San Francisco)"
  name = name.replace(/\s*[\(\[][^\)\]]*[\)\]]/g, ' ').trim();

  // YC detail h1 concatenates everything with NO spaces, e.g.
  // "BillionToOneSan Francisco, CA, USAThe genetic testing platform..."
  // The real name is the part BEFORE the first location/metadata chunk.
  // Cut at the first location keyword (city/state/country) that begins a new
  // capitalized word — this handles "BillionToOneSan Francisco" (no space).
  let head = name.split(/(?=[,]\s*[A-Z]{2}\b|(New |Los |Columbia|Remote|United States|USA|UK|Canada)\b)/)[0];
  head = head.replace(/(San Francisco|Columbia|Remote)$/i, '').trim();

  // Fallback: cut at the first separator if present: " | ", " — ", " - ", " : "
  if (!head || head === name) {
    head = name.split(/\s*[\|—–\-:]\s*/)[0];
  }

  // Cut at the first uppercase-starting descriptive word AFTER a sentence-ending
  // period (e.g. "BillionToOne...disease.Summer 2017") — keep only up to a dot.
  head = head.split(/\.(?=[A-Z])/)[0];

  // Remove parenthetical / bracketed metadata: "(San Francisco)"
  head = head.replace(/\s*[\(\[][^\)\]]*[\)\]]/g, '').trim();

  // Cut off trailing known YC-style metadata tokens (batch, category, industry)
  head = head.replace(/\b(Winter|Summer|Spring|Fall)\s*\d{4}.*$/i, '');
  head = head.replace(/\b(YC\s*S?\d{2}.*|Consumer|Enterprise|B2B|B2C).*$/i, '');
  head = head.replace(/\b(Virtual and Augmented Reality|Real Estate and Construction|Construction|FinTech|Healthcare|AI|SaaS|Diagnostics).*$/i, '');

  return head.replace(/\s+/g, ' ').trim();
}

/**
 * Job Founder Hunter - IndexedDB Database Wrapper
 * Stores companies, founders, and email tracking data
 */

const JFH_DB = {
  db: null,

  /**
   * Initialize the database
   * @returns {Promise<IDBDatabase>}
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('JobFounderHunterDB', 2);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Companies store
        if (!db.objectStoreNames.contains('companies')) {
          const companyStore = db.createObjectStore('companies', { keyPath: 'id' });
          companyStore.createIndex('name', 'name', { unique: false });
          companyStore.createIndex('source', 'source', { unique: false });
          companyStore.createIndex('status', 'status', { unique: false });
          companyStore.createIndex('sourceUrl', 'sourceUrl', { unique: true });
        }

        // Founders store
        if (!db.objectStoreNames.contains('founders')) {
          const founderStore = db.createObjectStore('founders', { keyPath: 'id' });
          founderStore.createIndex('name', 'name', { unique: false });
          founderStore.createIndex('companyId', 'companyId', { unique: false });
          founderStore.createIndex('email', 'email', { unique: false });
          founderStore.createIndex('linkedinUrl', 'linkedinUrl', { unique: false });
          founderStore.createIndex('status', 'status', { unique: false });
          founderStore.createIndex('contacted', 'contacted', { unique: false });
        }

        // Emails sent store
        if (!db.objectStoreNames.contains('emails_sent')) {
          const emailStore = db.createObjectStore('emails_sent', { keyPath: 'id' });
          emailStore.createIndex('founderId', 'founderId', { unique: false });
          emailStore.createIndex('email', 'email', { unique: false });
          emailStore.createIndex('sentAt', 'sentAt', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // Applied Jobs store (WorkAtAStartup)
        if (!db.objectStoreNames.contains('applied_jobs')) {
          const appliedJobsStore = db.createObjectStore('applied_jobs', { keyPath: 'id' });
          appliedJobsStore.createIndex('companyName', 'companyName', { unique: false });
          appliedJobsStore.createIndex('source', 'source', { unique: false });
          appliedJobsStore.createIndex('appliedAt', 'appliedAt', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(new Error('Failed to open database: ' + event.target.error));
      };
    });
  },

  /**
   * Generic add/put to a store
   */
  async _put(storeName, data) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      request.onsuccess = () => resolve(data);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * Generic get by key
   */
  async _get(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * Generic get all from a store
   */
  async _getAll(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * Generic get by index
   */
  async _getByIndex(storeName, indexName, value) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * Generic delete
   */
  async _delete(storeName, key) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e.target.error);
    });
  },

  /**
   * Generic count
   */
  async _count(storeName) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  },

  // ============ COMPANY METHODS ============

  /**
   * Add a company (skips duplicates by sourceUrl)
   */
  async addCompany(company) {
    const id = company.id || `comp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Check for duplicates by sourceUrl
    try {
      const existing = await this._getByIndex('companies', 'sourceUrl', company.sourceUrl);
      if (existing && existing.length > 0) {
        return existing[0]; // Return existing
      }
    } catch (e) {
      // Index might not find anything, that's fine
    }

    const record = {
      id,
      name: company.name || '',
      description: company.description || '',
      website: company.website || '',
      sourceUrl: company.sourceUrl || '',
      source: company.source || 'yc', // yc, wellfound, other
      batch: company.batch || '',
      status: company.status || 'pending',
      scrapedAt: Date.now(),
    };

    return this._put('companies', record);
  },

  /**
   * Add multiple companies in batch
   */
  async addCompanies(companies) {
    const results = [];
    for (const c of companies) {
      try {
        const result = await this.addCompany(c);
        results.push(result);
      } catch (e) {
        console.warn('Failed to add company:', c.name, e);
      }
    }
    return results;
  },

  async getCompany(id) {
    return this._get('companies', id);
  },

  async getAllCompanies() {
    return this._getAll('companies');
  },

  async getCompaniesBySource(source) {
    return this._getByIndex('companies', 'source', source);
  },

  async updateCompanyStatus(id, status) {
    const company = await this._get('companies', id);
    if (company) {
      company.status = status;
      return this._put('companies', company);
    }
  },

  // ============ FOUNDER METHODS ============

  async addFounder(founder) {
    // Check for duplicates by LinkedIn URL
    if (founder.linkedinUrl) {
      const existing = await this._getByIndex('founders', 'linkedinUrl', founder.linkedinUrl);
      if (existing && existing.length > 0) {
        return { ...existing[0], isDuplicate: true };
      }
    }

    // Check for duplicates by Name within the same Company
    if (founder.name && founder.companyId) {
      const companyFounders = await this._getByIndex('founders', 'companyId', founder.companyId);
      if (companyFounders && companyFounders.length > 0) {
        const match = companyFounders.find(f => f.name.toLowerCase() === founder.name.toLowerCase());
        if (match) {
          return { ...match, isDuplicate: true };
        }
      }
    }

    const id = founder.id || `fdr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const record = {
      id,
      name: founder.name || '',
      title: founder.title || '',
      role: founder.role || '', // Founder, Co-Founder, CEO
      companyId: founder.companyId || '',
      companyName: founder.companyName || '',
      linkedinUrl: founder.linkedinUrl || '',
      email: founder.email || '',
      status: founder.status || 'pending',
      contacted: false,
      contactedAt: null,
      addedAt: Date.now(),
    };

    return this._put('founders', record);
  },

  /**
   * Add multiple founders in batch
   */
  async addFounders(founders) {
    const results = [];
    for (const f of founders) {
      try {
        const result = await this.addFounder(f);
        results.push(result);
      } catch (e) {
        console.warn('Failed to add founder:', f.name, e);
      }
    }
    return results;
  },

  async getFounder(id) {
    return this._get('founders', id);
  },

  async getAllFounders() {
    return this._getAll('founders');
  },

  async getFoundersByCompany(companyId) {
    return this._getByIndex('founders', 'companyId', companyId);
  },

  async getUncontactedFounders() {
    const all = await this._getAll('founders');
    return all.filter(f => !f.contacted && f.email);
  },

  async getFoundersWithEmail() {
    const all = await this._getAll('founders');
    return all.filter(f => f.email && f.email.length > 0);
  },

  async getFoundersWithoutEmail() {
    const all = await this._getAll('founders');
    return all.filter(f => !f.email || f.email.length === 0);
  },

  async updateFounder(founder) {
    return this._put('founders', founder);
  },

  async updateFounderEmail(id, email) {
    const founder = await this._get('founders', id);
    if (founder) {
      founder.email = email;
      founder.status = 'email_found';
      return this._put('founders', founder);
    }
  },

  async markFounderContacted(id) {
    const founder = await this._get('founders', id);
    if (founder) {
      founder.contacted = true;
      founder.contactedAt = Date.now();
      founder.status = 'email_sent';
      return this._put('founders', founder);
    }
  },

  async isEmailDuplicate(email) {
    if (!email) return false;
    const all = await this._getAll('emails_sent');
    return all.some(e => e.email.toLowerCase() === email.toLowerCase());
  },

  // ============ EMAIL TRACKING METHODS ============

  async logEmailSent(emailRecord) {
    const id = `eml_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const record = {
      id,
      founderId: emailRecord.founderId || '',
      founderName: emailRecord.founderName || '',
      companyName: emailRecord.companyName || '',
      email: emailRecord.email || '',
      subject: emailRecord.subject || '',
      templateUsed: emailRecord.templateUsed || '',
      sentAt: Date.now(),
    };
    return this._put('emails_sent', record);
  },

  async getAllEmailsSent() {
    return this._getAll('emails_sent');
  },

  // ============ SETTINGS METHODS ============

  async saveSetting(key, value) {
    return this._put('settings', { key, value });
  },

  async getSetting(key) {
    const result = await this._get('settings', key);
    return result ? result.value : null;
  },

  async getAllSettings() {
    const all = await this._getAll('settings');
    const settings = {};
    for (const s of all) {
      settings[s.key] = s.value;
    }
    return settings;
  },

  // ============ STATS ============

  async getStats() {
    const companies = await this._getAll('companies');
    const founders = await this._getAll('founders');
    const emailsSent = await this._getAll('emails_sent');
    let appliedJobs = [];
    try { appliedJobs = await this._getAll('applied_jobs'); } catch(e) {}

    return {
      totalCompanies: companies.length,
      companiesBySource: {
        yc: companies.filter(c => c.source === 'yc').length,
        wellfound: companies.filter(c => c.source === 'wellfound').length,
        other: companies.filter(c => c.source === 'other').length,
      },
      totalFounders: founders.length,
      foundersWithEmail: founders.filter(f => f.email).length,
      foundersContacted: founders.filter(f => f.contacted).length,
      foundersRemaining: founders.filter(f => !f.contacted && f.email).length,
      totalEmailsSent: emailsSent.length,
      totalAppliedJobs: appliedJobs.length,
    };
  },

  // ============ CLEAR & EXPORT ============

  async clearAll() {
    await this.init();
    const storeNames = ['companies', 'founders', 'emails_sent'];
    for (const name of storeNames) {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(name, 'readwrite');
        const store = tx.objectStore(name);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e.target.error);
      });
    }
  },

  async exportAll() {
    return {
      companies: await this._getAll('companies'),
      founders: await this._getAll('founders'),
      emailsSent: await this._getAll('emails_sent'),
      exportedAt: Date.now(),
    };
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JFH_DB = JFH_DB;
}

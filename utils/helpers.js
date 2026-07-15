/**
 * Job Founder Hunter - Helper Utilities
 */

const JFH_Helpers = {
  /**
   * Promise-based delay
   * @param {number} ms - Milliseconds to wait
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Random delay between min and max
   * @param {number} min - Minimum ms
   * @param {number} max - Maximum ms
   */
  randomDelay(min, max) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Validate email address
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    if (!email) return false;
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(email.trim());
  },

  /**
   * Sanitize and normalize email
   * @param {string} email
   * @returns {string}
   */
  sanitizeEmail(email) {
    if (!email) return '';
    return email.trim().toLowerCase().replace(/\s+/g, '');
  },

  /**
   * Replace template variables with actual data
   * @param {string} template - Template string with {{variables}}
   * @param {Object} data - Key-value pairs for replacement
   * @returns {string}
   */
  renderTemplate(template, data) {
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value || '');
    }
    return result;
  },

  /**
   * Generate a unique ID
   * @returns {string}
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Format date to readable string
   * @param {Date|number} date
   * @returns {string}
   */
  formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  /**
   * Export data to CSV string
   * @param {Array<Object>} data
   * @param {Array<string>} headers
   * @returns {string}
   */
  toCSV(data, headers) {
    if (!data || data.length === 0) return '';
    
    const csvHeaders = headers || Object.keys(data[0]);
    const rows = data.map(item =>
      csvHeaders.map(h => {
        const val = item[h] !== undefined ? String(item[h]) : '';
        // Escape commas and quotes
        return val.includes(',') || val.includes('"')
          ? `"${val.replace(/"/g, '""')}"`
          : val;
      }).join(',')
    );
    
    return [csvHeaders.join(','), ...rows].join('\n');
  },

  /**
   * Download a string as file
   * @param {string} content
   * @param {string} filename
   * @param {string} type
   */
  downloadFile(content, filename, type = 'text/csv') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  /**
   * Extract domain from URL
   * @param {string} url
   * @returns {string}
   */
  getDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  },

  /**
   * Check if a title contains founder keywords
   * @param {string} title
   * @returns {{isFounder: boolean, role: string}}
   */
  detectFounderRole(title) {
    if (!title) return { isFounder: false, role: '' };
    const lower = title.toLowerCase();
    
    if (lower.includes('co-founder') || lower.includes('cofounder')) {
      return { isFounder: true, role: 'Co-Founder' };
    }
    if (lower.includes('founder')) {
      return { isFounder: true, role: 'Founder' };
    }
    if (lower.includes('ceo') && (lower.includes('founder') || lower.includes('co-founder'))) {
      return { isFounder: true, role: 'CEO & Founder' };
    }
    if (lower.includes('ceo')) {
      return { isFounder: true, role: 'CEO' };
    }
    if (lower.includes('cto') && (lower.includes('founder') || lower.includes('co-founder'))) {
      return { isFounder: true, role: 'CTO & Co-Founder' };
    }
    if (lower.includes('cto')) {
      return { isFounder: true, role: 'CTO' };
    }
    
    return { isFounder: false, role: '' };
  },

  /**
   * Clean text - remove extra whitespace and newlines
   * @param {string} text
   * @returns {string}
   */
  cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  },

  /**
   * Extract LinkedIn username from URL
   * @param {string} url
   * @returns {string}
   */
  getLinkedInUsername(url) {
    if (!url) return '';
    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
    return match ? match[1] : '';
  },

  /**
   * Truncate text with ellipsis
   * @param {string} text
   * @param {number} maxLen
   * @returns {string}
   */
  truncate(text, maxLen = 50) {
    if (!text || text.length <= maxLen) return text || '';
    return text.substring(0, maxLen) + '...';
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.JFH_Helpers = JFH_Helpers;
}

/**
 * Job Founder Hunter - Background Service Worker
 * Thin entry point: loads dependencies + modules, then initializes.
 */

// ========== Dependencies ==========
importScripts('../utils/constants.js', '../utils/helpers.js', '../templates/email-templates.js');
importScripts('../database/db.js');

// ========== Modules ==========
importScripts('modules/state.js');
importScripts('modules/messaging.js');
importScripts('modules/scraper.js');
importScripts('modules/email.js');
importScripts('modules/compose.js');
importScripts('modules/was.js');
importScripts('modules/main.js');

console.log('[JFH] Service Worker loaded');

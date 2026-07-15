const fs = require('fs');
const path = require('path');
const config = require('./config');

const CONFIG_FILE = path.join(__dirname, '..', 'data', 'config.json');

// Load persisted config overrides (written by the extension's "push to server")
function loadFile() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (raw.redisUrl) config.redisUrl = raw.redisUrl;
      if (raw.smtp) Object.assign(config.smtp, raw.smtp);
      if (raw.mailFrom) config.mailFrom = raw.mailFrom;
      if (raw.publicBaseUrl) config.publicBaseUrl = raw.publicBaseUrl;
      if (raw.apiKey) config.apiKey = raw.apiKey;
      if (raw.queue) Object.assign(config.queue, raw.queue);
      console.log('[config] loaded overrides from', CONFIG_FILE);
    }
  } catch (e) {
    console.warn('[config] failed to load file:', e.message);
  }
}

function saveFile() {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const data = {
    redisUrl: config.redisUrl,
    smtp: config.smtp,
    mailFrom: config.mailFrom,
    publicBaseUrl: config.publicBaseUrl,
    apiKey: config.apiKey,
    queue: config.queue,
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// Non-secret view returned to the extension
function publicView() {
  return {
    redisUrl: config.redisUrl,
    smtp: { ...config.smtp, pass: config.smtp.pass ? '********' : '' },
    mailFrom: config.mailFrom,
    publicBaseUrl: config.publicBaseUrl,
    apiKey: config.apiKey ? '********' : '',
    queue: config.queue,
  };
}

// Apply a partial patch pushed from the extension
function applyPatch(patch) {
  if (patch.redisUrl) config.redisUrl = patch.redisUrl;
  if (patch.smtp) {
    if (patch.smtp.host) config.smtp.host = patch.smtp.host;
    if (patch.smtp.port) config.smtp.port = parseInt(patch.smtp.port, 10);
    if (typeof patch.smtp.secure === 'boolean') config.smtp.secure = patch.smtp.secure;
    if (patch.smtp.user) config.smtp.user = patch.smtp.user;
    if (patch.smtp.pass) config.smtp.pass = patch.smtp.pass;
  }
  if (patch.mailFrom) config.mailFrom = patch.mailFrom;
  if (patch.publicBaseUrl) config.publicBaseUrl = patch.publicBaseUrl.trim().replace(/\/+$/, '');
  if (patch.apiKey) config.apiKey = patch.apiKey;
  if (patch.queue) Object.assign(config.queue, patch.queue);
  saveFile();
}

module.exports = { loadFile, saveFile, publicView, applyPatch };

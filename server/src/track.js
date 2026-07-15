const config = require('./config');
const { getClient } = require('./redisClient');

const META_PREFIX = 'track:meta:';
const OPENS_PREFIX = 'track:opens:';
const CLICKS_PREFIX = 'track:clicks:';

function generateTrackingId() {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Store metadata for a tracking id (recipient, founder, subject).
 */
async function saveMeta(trackId, meta) {
  const conn = getClient();
  await conn.hset(META_PREFIX + trackId, {
    to: meta.to || '',
    founderId: meta.founderId || '',
    subject: meta.subject || '',
    createdAt: Date.now(),
  });
  await conn.expire(META_PREFIX + trackId, 60 * 60 * 24 * 30); // 30 days
}

/**
 * Take a plaintext email body and return HTML with:
 *  - line breaks as <br>
 *  - every http(s) link rewritten through the click tracker
 *  - a 1x1 invisible open-tracking pixel appended
 * @param {string} body
 * @param {string} trackId
 * @returns {string}
 */
function buildTrackedHtml(body, trackId) {
  const openPixel = `${config.publicBaseUrl}/track/open/${trackId}.png`;
  const clickBase = `${config.publicBaseUrl}/track/click/${trackId}?to=`;

  // Rewrite plaintext links to go through the click tracker
  const urlRegex = /https?:\/\/[^\s<>"')]+/g;
  const trackedText = (body || '').replace(urlRegex, (url) => {
    return clickBase + encodeURIComponent(url);
  });

  const html = (trackedText || '').replace(/\n/g, '<br>');
  return `${html}<br><img src="${openPixel}" width="1" height="1" alt="" style="display:none" />`;
}

async function recordOpen(trackId) {
  if (!trackId) return;
  const conn = getClient();
  await conn.incr(OPENS_PREFIX + trackId);
  await conn.expire(OPENS_PREFIX + trackId, 60 * 60 * 24 * 30);
}

async function recordClick(trackId, url) {
  if (!trackId) return;
  const conn = getClient();
  const payload = JSON.stringify({ url: url || '', at: Date.now() });
  await conn.rpush(CLICKS_PREFIX + trackId, payload);
  await conn.expire(CLICKS_PREFIX + trackId, 60 * 60 * 24 * 30);
}

async function getStatus(trackId) {
  const conn = getClient();
  const meta = await conn.hgetall(META_PREFIX + trackId);
  const opens = parseInt((await conn.get(OPENS_PREFIX + trackId)) || '0', 10);
  const clicksRaw = await conn.lrange(CLICKS_PREFIX + trackId, 0, -1);
  const clicks = clicksRaw.map((c) => {
    try { return JSON.parse(c); } catch { return null; }
  }).filter(Boolean);

  return {
    trackId,
    to: meta?.to || '',
    founderId: meta?.founderId || '',
    subject: meta?.subject || '',
    opened: opens > 0,
    openCount: opens,
    clicked: clicks.length > 0,
    clickCount: clicks.length,
    clicks,
  };
}

/**
 * List recent tracking records (for the dashboard).
 * @param {number} limit
 */
async function listRecent(limit = 100) {
  const conn = getClient();
  const keys = [];
  let cursor = '0';
  do {
    const [next, found] = await conn.scan(cursor, 'MATCH', META_PREFIX + '*', 'COUNT', 200);
    cursor = next;
    keys.push(...found);
  } while (cursor !== '0' && keys.length < limit * 3);

  const out = [];
  for (const k of keys.slice(0, limit)) {
    const id = k.replace(META_PREFIX, '');
    out.push(await getStatus(id));
  }
  // Most recently created first
  out.sort((a, b) => (Number(b.trackId.split('_')[1] || 0) - Number(a.trackId.split('_')[1] || 0)));
  return out;
}

module.exports = {
  generateTrackingId,
  saveMeta,
  buildTrackedHtml,
  recordOpen,
  recordClick,
  getStatus,
  listRecent,
};

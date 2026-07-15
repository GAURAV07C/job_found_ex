const express = require('express');
const cors = require('cors');
const config = require('./config');
const { enqueueEmails, getQueueCounts } = require('./queue');
const track = require('./track');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ---- Auth middleware (API key) ----
function requireApiKey(req, res, next) {
  const key = req.header('x-api-key') || req.query.apiKey;
  if (!key || key !== config.apiKey) {
    return res.status(401).json({ success: false, message: 'Unauthorized: invalid API key' });
  }
  next();
}

// Validate a single email object
function isValidMail(m) {
  return (
    m &&
    typeof m.to === 'string' &&
    m.to.includes('@') &&
    typeof m.subject === 'string' &&
    typeof m.body === 'string'
  );
}

// ---- Health ----
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', service: 'job-founder-hunter-backend' });
});

// ---- Open tracking pixel (hit by recipient mail clients) ----
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
app.get('/track/open/:id.png', async (req, res) => {
  const id = req.params.id;
  await track.recordOpen(id).catch(() => {});
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(PIXEL);
});

// ---- Click tracking (redirects to original URL) ----
app.get('/track/click/:id', async (req, res) => {
  const id = req.params.id;
  const target = req.query.to;
  await track.recordClick(id, target).catch(() => {});
  if (target) {
    return res.redirect(302, target);
  }
  res.status(400).send('Missing target');
});

// ---- Tracking status (api-key protected) ----
app.get('/api/tracking/:id', requireApiKey, async (req, res) => {
  try {
    const status = await track.getStatus(req.params.id);
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---- List recent sent emails (for dashboard) ----
app.get('/api/sent', requireApiKey, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '100', 10);
    const sent = await track.listRecent(limit);
    res.json({ success: true, sent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---- Queue stats ----
app.get('/api/queue', requireApiKey, async (req, res) => {
  try {
    const counts = await getQueueCounts();
    res.json({ success: true, counts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ---- Send emails (single object or array) ----
app.post('/api/send', requireApiKey, async (req, res) => {
  try {
    let emails = req.body.emails;
    if (!emails) {
      // Allow a single email object too
      emails = [req.body];
    }
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ success: false, message: 'No emails provided.' });
    }
    const invalid = emails.filter((e) => !isValidMail(e));
    if (invalid.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Some emails are missing to/subject/body.', invalidCount: invalid.length });
    }

    const jobs = await enqueueEmails(emails);
    res.json({
      success: true,
      queued: jobs.length,
      jobs,
      message: `Queued ${jobs.length} email(s) for delivery.`,
    });
  } catch (err) {
    console.error('[api] /api/send error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(config.port, () => {
  console.log(`[server] Job Founder Hunter backend listening on http://localhost:${config.port}`);
  console.log(`[server] API key: ${config.apiKey}`);
  console.log(`[server] Redis: ${config.redisUrl}`);
  console.log(`[server] SMTP: ${config.smtp.host}:${config.smtp.port} as ${config.smtp.user}`);
  console.log(`[server] Public base: ${config.publicBaseUrl}`);
  console.log(
    `[server] Queue rate: ${config.queue.maxPerWindow} email(s) / ${config.queue.windowMs}ms`
  );
});

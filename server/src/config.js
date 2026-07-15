require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiKey: process.env.API_KEY || 'job-founder-hunter-dev-key',

  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: (process.env.SMTP_SECURE || 'true') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },

  mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER || '',

  // Public base URL used inside tracking links/pixels (must be reachable by recipients)
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, ''),

  queue: {
    maxPerWindow: parseInt(process.env.QUEUE_MAX_PER_WINDOW || '1', 10),
    windowMs: parseInt(process.env.QUEUE_WINDOW_MS || '5000', 10),
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '1', 10),
    attempts: parseInt(process.env.JOB_ATTEMPTS || '3', 10),
    backoffMs: parseInt(process.env.JOB_BACKOFF_MS || '10000', 10),
  },
};

module.exports = config;

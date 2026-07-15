const nodemailer = require('nodemailer');
const config = require('./config');

const SMTP_TIMEOUT_MS = 30_000; // 30s for Render free tier cold starts

function createTransporter() {
  const { host, port, secure, user, pass } = config.smtp;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in your .env file.'
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 50,
    rateDelta: config.queue.windowMs,
    rateLimit: config.queue.maxPerWindow,
    connectionTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}

/**
 * Send a single email via SMTP.
 * @param {{to:string, subject:string, body:string, html?:string, replyTo?:string, fromName?:string}} mail
 */
async function sendMail(mail) {
  const transporter = createTransporter();

  const from = config.mailFrom;
  const html = mail.html || (mail.body || '').replace(/\n/g, '<br>');

  const info = await transporter.sendMail({
    from,
    to: mail.to,
    replyTo: mail.replyTo || config.mailFrom,
    subject: mail.subject || '(no subject)',
    text: mail.body || '',
    html,
  });

  return info;
}

module.exports = { createTransporter, sendMail };

import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export const runtime = 'nodejs';

function getEnv(name: string, fallback = '') {
  return (process.env[name] || fallback).trim();
}

function unauthorized() {
  return NextResponse.json({ success: false, message: 'Unauthorized: invalid API key' }, { status: 401 });
}

function auth(req: NextRequest) {
  const key = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('apiKey');
  return key && key === getEnv('API_KEY', 'job-founder-hunter-dev-key');
}

function getOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return unauthorized();

  try {
    const body = await req.json();
    const emails = Array.isArray(body.emails) ? body.emails : [body];

    const invalid = emails.filter((e: any) => !e?.to || !e?.subject || !e?.body);
    if (invalid.length > 0) {
      return NextResponse.json({ success: false, message: 'Some emails are missing to/subject/body.', invalidCount: invalid.length }, { status: 400 });
    }

    const origin = getOrigin(req);
    const jobs: any[] = [];

    for (const mail of emails) {
      const trackId = 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      const openPixel = `${origin}/api/track/open?id=${trackId}`;
      const clickBase = `${origin}/api/track/click?id=${trackId}&to=`;

      const urlRegex = /https?:\/\/[^\s<>"')]+/g;
      const trackedText = (mail.body || '').replace(urlRegex, (url: string) => {
        const linkId = 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
        return `${origin}/api/track/click?id=${linkId}&to=${encodeURIComponent(url)}`;
      });

      const html = (trackedText || '').replace(/\n/g, '<br>');
      const spacer = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      const trackedHtml = `${html}<br><img src="${spacer}" width="1" height="1" border="0" alt="" /><img src="${openPixel}" width="1" height="1" border="0" alt="" style="border:0; outline:none; text-decoration:none;" />`;

      jobs.push({ ...mail, html: trackedHtml, trackId });
    }

    const results: any[] = [];
    for (const job of jobs) {
      try {
        const info = await sendMail(job);
        const result = { to: job.to, trackId: job.trackId, messageId: info.messageId, status: 'sent' };
        results.push(result);
        try {
          console.log('[send] saving to redis, trackId:', job.trackId);
          const r = await getRedis();
          console.log('[send] redis connected');
          await r.hset('track:meta:' + job.trackId, {
            to: job.to,
            subject: job.subject,
            createdAt: Date.now(),
            status: 'sent',
          });
          console.log('[send] hset done');
          await r.expire('track:meta:' + job.trackId, 60 * 60 * 24 * 30);
          console.log('[send] expire done');
          await r.quit();
          console.log('[send] redis save complete for:', job.trackId);
        } catch (redisErr: any) {
          console.error('[send] redis save failed:', redisErr.message);
          console.error('[send] stack:', redisErr.stack);
        }
      } catch (err: any) {
        const result = { to: job.to, trackId: job.trackId, status: 'failed', error: err.message };
        results.push(result);
        try {
          const r = await getRedis();
          await r.hset('track:meta:' + job.trackId, {
            to: job.to,
            subject: job.subject,
            createdAt: Date.now(),
            status: 'failed',
            error: err.message,
          });
          await r.expire('track:meta:' + job.trackId, 60 * 60 * 24 * 30);
          await r.quit();
        } catch (redisErr: any) {
          console.error('[send] redis save failed:', redisErr.message);
        }
      }
    }

    return NextResponse.json({ success: true, queued: results.length, jobs: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

async function sendMail(mail: any): Promise<{ messageId: string }> {
  const nodemailer = await import('nodemailer');

  const host = getEnv('SMTP_HOST', 'smtp.gmail.com');
  const port = parseInt(getEnv('SMTP_PORT', '465'), 10);
  const secure = getEnv('SMTP_SECURE', 'true') === 'true';
  const user = getEnv('SMTP_USER');
  const pass = getEnv('SMTP_PASS');
  const from = getEnv('MAIL_FROM') || user;

  if (!host || !user || !pass) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    connectionTimeout: 30000,
    socketTimeout: 30000,
  });

  const info = await transporter.sendMail({
    from,
    to: mail.to,
    replyTo: mail.replyTo || from,
    subject: mail.subject || '(no subject)',
    text: mail.body || '',
    html: mail.html || (mail.body || '').replace(/\n/g, '<br>'),
  });

  return { messageId: info.messageId };
}

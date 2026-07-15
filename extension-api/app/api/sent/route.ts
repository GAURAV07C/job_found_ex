import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export const runtime = 'nodejs';

function getEnv(name: string, fallback = '') {
  return (process.env[name] || fallback).trim();
}

function auth(req: NextRequest) {
  const key = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('apiKey');
  return key && key === getEnv('API_KEY', 'job-founder-hunter-dev-key');
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });

  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);
    const r = await getRedis();
    const keys = await r.keys('track:meta:*');
    const out: any[] = [];
    for (const k of keys.slice(0, limit)) {
      const id = k.replace('track:meta:', '');
      const meta = await r.hgetall(k);
      const opens = parseInt((await r.get('track:opens:' + id)) || '0', 10);
      const clicksRaw = await r.lrange('track:clicks:' + id, 0, -1);
      const clicks = clicksRaw.map((c) => { try { return JSON.parse(c); } catch { return null; } }).filter(Boolean);
      out.push({
        trackId: id,
        to: meta?.to || '',
        subject: meta?.subject || '',
        status: meta?.status || '',
        opened: opens > 0,
        openCount: opens,
        clicked: clicks.length > 0,
        clickCount: clicks.length,
        clicks,
      });
    }
    out.sort((a, b) => (b.trackId || '').localeCompare(a.trackId || ''));
    await r.quit();
    return NextResponse.json({ success: true, sent: out.slice(0, limit) });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const trackId = body.trackId;
    if (!trackId) return NextResponse.json({ success: false, message: 'trackId required' }, { status: 400 });
    const r = await getRedis();
    const key = 'track:meta:' + trackId;
    const existing = await r.hgetall(key);
    const merged = { ...existing, ...body };
    await r.hset(key, merged);
    await r.expire(key, 60 * 60 * 24 * 30);
    await r.quit();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

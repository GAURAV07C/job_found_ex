import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  const target = req.nextUrl.searchParams.get('to');

  if (id) {
    try {
      const r = await getRedis();
      const entry = await r.hgetall('track:meta:' + id);
      const clicksRaw = await r.lrange('track:clicks:' + id, 0, -1);
      const clicks = clicksRaw.map((c: string) => { try { return JSON.parse(c); } catch { return null; } }).filter(Boolean);
      clicks.push({ url: target || '', at: Date.now() });
      await r.lpush('track:clicks:' + id, ...clicks.map((c: any) => JSON.stringify(c)));
      await r.expire('track:clicks:' + id, 60 * 60 * 24 * 30);
      await r.quit();
    } catch (err: any) {
      console.error('[track/click] redis failed:', err.message);
    }
  }

  if (target) {
    return NextResponse.redirect(target, { status: 302 });
  }
  return NextResponse.json({ success: true, clicked: true }, { status: 400 });
}

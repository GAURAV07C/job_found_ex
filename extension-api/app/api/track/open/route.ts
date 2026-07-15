import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export const runtime = 'nodejs';

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (id) {
    try {
      const r = await getRedis();
      const opens = parseInt((await r.get('track:opens:' + id)) || '0', 10);
      await r.set('track:opens:' + id, opens + 1);
      await r.expire('track:opens:' + id, 60 * 60 * 24 * 30);
      await r.quit();
    } catch (err: any) {
      console.error('[track/open] redis failed:', err.message);
    }
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

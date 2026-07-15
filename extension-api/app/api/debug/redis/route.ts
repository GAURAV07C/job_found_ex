import { NextRequest, NextResponse } from 'next/server';
import IORedis from 'ioredis';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const url = process.env.UPSTASH_REDIS_URL || process.env.REDIS_URL || '';
  console.log('[redis-test] UPSTASH_REDIS_URL:', process.env.UPSTASH_REDIS_URL ? 'SET' : 'MISSING');
  console.log('[redis-test] REDIS_URL:', process.env.REDIS_URL ? 'SET' : 'MISSING');
  console.log('[redis-test] using url:', url ? 'SET' : 'MISSING');

  if (!url) {
    return NextResponse.json({ success: false, error: 'No Redis URL configured' });
  }

  try {
    const r = new IORedis(url, { maxRetriesPerRequest: null });
    await r.set('test:ping', 'pong');
    const val = await r.get('test:ping');
    await r.del('test:ping');
    await r.quit();
    return NextResponse.json({ success: true, value: val });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}

import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const r = await getRedis();
    const waiting = await r.zcard('queue:waiting');
    const active = await r.zcard('queue:active');
    const completed = await r.zcard('queue:completed');
    const failed = await r.zcard('queue:failed');
    return NextResponse.json({ success: true, counts: { waiting, active, completed, failed } });
  } catch (err: any) {
    return NextResponse.json({ success: true, counts: { waiting: 0, active: 0, completed: 0, failed: 0 } });
  }
}

export async function POST() {
  return NextResponse.json({ success: true, counts: { waiting: 0, active: 0, completed: 0, failed: 0 } });
}

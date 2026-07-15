import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    REDIS_URL: process.env.REDIS_URL ? 'SET' : 'MISSING',
    UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL ? 'SET' : 'MISSING',
    SMTP_USER: process.env.SMTP_USER || 'MISSING',
    API_KEY: process.env.API_KEY ? 'SET' : 'MISSING',
  });
}

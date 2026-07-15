import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  return res;
}

export const config = {
  matcher: '/api/:path*',
};

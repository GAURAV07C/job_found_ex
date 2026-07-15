import { NextRequest, NextResponse } from 'next/server';

export function proxy(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  return res;
}

export const config = {
  matcher: '/api/:path*',
};

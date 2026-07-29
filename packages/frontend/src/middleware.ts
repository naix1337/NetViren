import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/_next', '/api', '/favicon.ico'];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths (API routes, login page, static assets)
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next());
  }

  // For dashboard pages, let the request through and let the frontend
  // redirect to login if API calls return 401
  return addSecurityHeaders(NextResponse.next());
}

function addSecurityHeaders(res: NextResponse) {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

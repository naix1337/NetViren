import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/_next', '/api/auth/login', '/api/auth/set-session', '/api/auth/google', '/api/auth/github', '/api/agents', '/favicon.ico'];
const LOCALES = ['/de', '/en'];

/**
 * Strip locale prefix from pathname to match PUBLIC_PATHS.
 * next-intl adds /de or /en prefix to all page routes.
 */
function stripLocale(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname === locale) return '/';
    if (pathname.startsWith(locale + '/')) return pathname.slice(locale.length);
  }
  return pathname;
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const basePath = stripLocale(pathname);

  // Allow public paths (with or without locale prefix)
  if (PUBLIC_PATHS.some(p => basePath.startsWith(p))) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Check httpOnly JWT cookie (set by server, not spoofable by JS)
  const token = req.cookies.get('netviren_token')?.value;
  if (!token) {
    // Preserve locale prefix in the redirect URL
    const currentLocale = LOCALES.find(l => pathname === l || pathname.startsWith(l + '/'));
    const loginPath = currentLocale ? `${currentLocale}/login` : '/login';
    return addSecurityHeaders(NextResponse.redirect(new URL(loginPath, req.url)));
  }

  return addSecurityHeaders(NextResponse.next());
}

function addSecurityHeaders(res: NextResponse) {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

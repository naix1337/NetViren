import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Admin-only routes
    if (path.startsWith('/settings') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Analyst+Admin routes
    if ((path.startsWith('/reports') || path.startsWith('/alerts')) && token?.role === 'viewer') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: '/login' },
  }
);

export const config = {
  matcher: ['/((?!api|_next|login|register).*)'],
};

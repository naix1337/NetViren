import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });

    // Set httpOnly cookie with JWT - not spoofable from client-side JS
    response.cookies.set('netviren_token', token, {
      httpOnly: true,
      secure: true, // HTTPS is terminated by Caddy
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('netviren_token', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0, // delete cookie
  });
  return response;
}

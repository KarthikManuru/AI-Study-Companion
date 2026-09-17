import { withAuth } from 'next-auth/middleware';
import { NextResponse, NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ─── Admin Routes ───
  if (pathname.startsWith('/admin')) {
    // Allow admin auth pages (login/signup) without any session check
    if (pathname === '/admin/login' || pathname === '/admin/signup') {
      return NextResponse.next();
    }

    // For protected admin pages, check the admin-specific JWT cookie
    const adminToken = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: 'next-auth.admin-session-token',
    });

    if (!adminToken || adminToken.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }

    return NextResponse.next();
  }

  // ─── Learner Dashboard Routes ───
  if (pathname.startsWith('/dashboard')) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.redirect(new URL('/auth/login', req.url));
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};

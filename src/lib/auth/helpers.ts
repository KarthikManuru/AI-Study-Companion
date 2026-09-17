import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { authOptions } from './config';
import { adminAuthOptions } from './admin-config';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
}

/**
 * Get the authenticated user from the server session.
 * Returns null if not authenticated.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  
  const user = session.user as any;
  return {
    id: user.id,
    email: user.email!,
    name: user.name!,
    role: user.role || 'USER',
  };
}

/**
 * Get the admin user from the admin-specific session cookie.
 * Returns null if no admin session exists.
 */
export async function getAdminUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('next-auth.admin-session-token')?.value;
    if (token) {
      const decoded = await decode({
        token,
        secret: process.env.NEXTAUTH_SECRET!,
      });
      if (decoded && decoded.role === 'ADMIN') {
        return {
          id: (decoded.id || decoded.sub) as string,
          email: (decoded.email || '') as string,
          name: (decoded.name || '') as string,
          role: 'ADMIN',
        };
      }
    }
  } catch {
    // continue to fallback
  }

  const session = await getServerSession(adminAuthOptions);
  if (!session?.user) return null;
  
  const user = session.user as any;
  if (user.role !== 'ADMIN') return null;
  return {
    id: user.id,
    email: user.email!,
    name: user.name!,
    role: 'ADMIN',
  };
}

/**
 * Require authentication. Returns the user or throws a 401 response.
 * Use in API routes.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Require admin role. Checks the admin-specific session first,
 * then falls back to the standard session.
 */
export async function requireAdmin(): Promise<AuthUser> {
  // First check the admin-specific session cookie
  const adminUser = await getAdminUser();
  if (adminUser) return adminUser;

  // Fall back to standard session (for backward compatibility)
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}

/**
 * Standard API error response helper
 */
export function apiError(message: string, status: number = 400) {
  return NextResponse.json(
    { error: message, success: false },
    { status }
  );
}

/**
 * Standard API success response helper
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(
    { data, success: true },
    { status }
  );
}

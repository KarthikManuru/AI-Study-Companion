import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { encode } from 'next-auth/jwt';
import prisma from '@/lib/db/prisma';

const adminSignupSchema = z.object({
  email: z.string().email('Invalid email address').transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  adminSecret: z.string().min(1, 'Admin secret key is required'),
});

/**
 * Admin signup endpoint.
 * Requires the ADMIN_SECRET_KEY env variable to match the provided secret.
 * If the user already exists, it updates/promotes the account to ADMIN with the new password.
 * If the user does not exist, it creates a new ADMIN user.
 * Automatically issues the admin session cookie so the user is logged in immediately.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = adminSignupSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message, success: false },
        { status: 400 }
      );
    }

    const { email, password, name, adminSecret } = validation.data;

    // Verify admin secret key from environment
    const expectedSecret = process.env.ADMIN_SECRET_KEY;
    if (!expectedSecret) {
      return NextResponse.json(
        { error: 'Server configuration error: ADMIN_SECRET_KEY is not configured.', success: false },
        { status: 500 }
      );
    }
    if (adminSecret.trim() !== expectedSecret.trim()) {
      return NextResponse.json(
        { error: 'Invalid admin secret key. Please check the secret key and try again.', success: false },
        { status: 403 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    let user;
    if (existingUser) {
      // User exists — promote to ADMIN and update password + name
      user = await prisma.user.update({
        where: { email },
        data: {
          role: 'ADMIN',
          passwordHash,
          name: name || existingUser.name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });
    } else {
      // Create new admin user
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'ADMIN',
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });
    }

    // Issue the admin JWT token cookie directly so they are immediately logged in
    const token = await encode({
      token: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        sub: user.id,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    const response = NextResponse.json(
      {
        data: user,
        message: existingUser
          ? 'Existing account upgraded to Admin and password updated!'
          : 'Admin account created successfully!',
        success: true,
      },
      { status: existingUser ? 200 : 201 }
    );

    // Set the admin-specific session cookie
    response.cookies.set('next-auth.admin-session-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error('Admin signup error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during admin registration', success: false },
      { status: 500 }
    );
  }
}

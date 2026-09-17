import { NextRequest, NextResponse } from 'next/server';
import { decode } from 'next-auth/jwt';

export async function GET(req: NextRequest) {
  try {
    const adminTokenCookie = req.cookies.get('next-auth.admin-session-token')?.value;

    if (!adminTokenCookie) {
      return NextResponse.json({ user: null });
    }

    const decoded = await decode({
      token: adminTokenCookie,
      secret: process.env.NEXTAUTH_SECRET!,
    });

    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: decoded.id || decoded.sub,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role,
      },
    });
  } catch (error) {
    console.error('Admin session verification error:', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

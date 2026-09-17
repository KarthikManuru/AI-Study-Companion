import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';

const createSpaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).default(''),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#4c6ef5'),
  icon: z.string().max(4).default('📚'),
});

// GET /api/spaces — list all spaces for the authenticated user
export async function GET() {
  try {
    const user = await requireAuth();

    const spaces = await prisma.space.findMany({
      where: { userId: user.id },
      include: {
        _count: { select: { projects: true } },
        projects: {
          select: { id: true, name: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return apiSuccess(spaces);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    console.error('GET /api/spaces error:', error);
    return apiError('Failed to fetch spaces', 500);
  }
}

// POST /api/spaces — create a new space
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const validation = createSpaceSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const space = await prisma.space.create({
      data: {
        ...validation.data,
        userId: user.id,
      },
      include: {
        _count: { select: { projects: true } },
      },
    });

    // Emit learning event
    await prisma.learningEvent.create({
      data: {
        userId: user.id,
        type: 'space.created',
        payload: { spaceId: space.id, spaceName: space.name },
        idempotencyKey: `space.created:${space.id}`,
      },
    });

    return apiSuccess(space, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    console.error('POST /api/spaces error:', error);
    return apiError('Failed to create space', 500);
  }
}

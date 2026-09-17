import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';
import { assertSpaceOwnership } from '@/lib/db/ownership';

const updateSpaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(4).optional(),
});

// GET /api/spaces/[spaceId] — get space details
export async function GET(
  _req: NextRequest,
  { params }: { params: { spaceId: string } }
) {
  try {
    const user = await requireAuth();
    await assertSpaceOwnership(user.id, params.spaceId);

    const space = await prisma.space.findUnique({
      where: { id: params.spaceId },
      include: {
        projects: {
          include: {
            _count: {
              select: {
                materials: true,
                concepts: true,
                quizAttempts: true,
                conversations: true,
              },
            },
            conceptMasteries: {
              select: { masteryScore: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
        _count: { select: { projects: true } },
      },
    });

    return apiSuccess(space);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Space not found', 404);
    console.error('GET /api/spaces/[spaceId] error:', error);
    return apiError('Failed to fetch space', 500);
  }
}

// PATCH /api/spaces/[spaceId] — update space
export async function PATCH(
  req: NextRequest,
  { params }: { params: { spaceId: string } }
) {
  try {
    const user = await requireAuth();
    await assertSpaceOwnership(user.id, params.spaceId);

    const body = await req.json();
    const validation = updateSpaceSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const space = await prisma.space.update({
      where: { id: params.spaceId },
      data: validation.data,
    });

    return apiSuccess(space);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Space not found', 404);
    console.error('PATCH /api/spaces/[spaceId] error:', error);
    return apiError('Failed to update space', 500);
  }
}

// DELETE /api/spaces/[spaceId] — delete space and all its projects
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { spaceId: string } }
) {
  try {
    const user = await requireAuth();
    await assertSpaceOwnership(user.id, params.spaceId);

    await prisma.space.delete({
      where: { id: params.spaceId },
    });

    return apiSuccess({ deleted: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Space not found', 404);
    console.error('DELETE /api/spaces/[spaceId] error:', error);
    return apiError('Failed to delete space', 500);
  }
}

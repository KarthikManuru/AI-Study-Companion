import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';
import { assertProjectOwnership } from '@/lib/db/ownership';

const updateRecSchema = z.object({
  status: z.enum(['ACTIVE', 'DISMISSED', 'DONE']),
});

// PATCH /api/projects/[projectId]/recommendations/[recommendationId] — update recommendation status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string; recommendationId: string } }
) {
  try {
    const user = await requireAuth();
    await assertProjectOwnership(user.id, params.projectId);

    const body = await req.json();
    const validation = updateRecSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const updated = await prisma.recommendation.update({
      where: {
        id: params.recommendationId,
        projectId: params.projectId,
      },
      data: {
        status: validation.data.status,
      },
    });

    return apiSuccess({ recommendation: updated });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    console.error('PATCH recommendation error:', error);
    return apiError('Failed to update recommendation', 500);
  }
}

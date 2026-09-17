import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';
import { assertProjectOwnership } from '@/lib/db/ownership';

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
  goal: z.string().max(2000).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireAuth();

    // Merge ownership check into the main query — saves one DB round-trip (~600ms)
    const [project, recentActivity] = await Promise.all([
      prisma.project.findFirst({
        where: {
          id: params.projectId,
          space: { userId: user.id }, // ownership filter built-in
        },
        include: {
          space: { select: { id: true, name: true, color: true, icon: true } },
          materials: {
            select: { id: true, fileName: true, status: true, pageCount: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          },
          concepts: {
            select: { id: true, name: true, description: true },
            orderBy: { name: 'asc' },
          },
          conceptMasteries: {
            include: {
              concept: { select: { name: true } },
            },
            orderBy: { masteryScore: 'asc' },
          },
          recommendations: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          _count: {
            select: {
              materials: true,
              concepts: true,
              quizAttempts: true,
              conversations: true,
            },
          },
        },
      }),
      prisma.learningEvent.findMany({
        where: { projectId: params.projectId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    if (!project) {
      return apiError('Project not found', 404);
    }

    // Compute overall progress (average mastery)
    const avgMastery = project.conceptMasteries.length > 0
      ? Math.round(
          project.conceptMasteries.reduce((sum, m) => sum + m.masteryScore, 0) /
          project.conceptMasteries.length
        )
      : 0;

    return apiSuccess({
      ...project,
      recentActivity,
      overallProgress: avgMastery,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Project not found', 404);
    console.error('GET /api/projects/[projectId] error:', error);
    return apiError('Failed to fetch project', 500);
  }
}

// PATCH /api/projects/[projectId] — update project
export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireAuth();
    await assertProjectOwnership(user.id, params.projectId);

    const body = await req.json();
    const validation = updateProjectSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const project = await prisma.project.update({
      where: { id: params.projectId },
      data: validation.data,
    });

    return apiSuccess(project);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Project not found', 404);
    console.error('PATCH /api/projects/[projectId] error:', error);
    return apiError('Failed to update project', 500);
  }
}

// DELETE /api/projects/[projectId] — delete project
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireAuth();
    await assertProjectOwnership(user.id, params.projectId);

    await prisma.project.delete({
      where: { id: params.projectId },
    });

    return apiSuccess({ deleted: true });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Project not found', 404);
    console.error('DELETE /api/projects/[projectId] error:', error);
    return apiError('Failed to delete project', 500);
  }
}

import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';
import { assertSpaceOwnership } from '@/lib/db/ownership';

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).default(''),
  goal: z.string().max(2000).default(''),
});

// GET /api/spaces/[spaceId]/projects — list projects in a space
export async function GET(
  _req: NextRequest,
  { params }: { params: { spaceId: string } }
) {
  try {
    const user = await requireAuth();
    await assertSpaceOwnership(user.id, params.spaceId);

    const projects = await prisma.project.findMany({
      where: { spaceId: params.spaceId },
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
          select: { masteryScore: true, trend: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return apiSuccess(projects);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Space not found', 404);
    console.error('GET /api/spaces/[spaceId]/projects error:', error);
    return apiError('Failed to fetch projects', 500);
  }
}

// POST /api/spaces/[spaceId]/projects — create a project
export async function POST(
  req: NextRequest,
  { params }: { params: { spaceId: string } }
) {
  try {
    const user = await requireAuth();
    await assertSpaceOwnership(user.id, params.spaceId);

    const body = await req.json();
    const validation = createProjectSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const project = await prisma.project.create({
      data: {
        ...validation.data,
        spaceId: params.spaceId,
      },
    });

    // Create initial learning context for the goal
    if (validation.data.goal) {
      await prisma.learningContext.create({
        data: {
          projectId: project.id,
          kind: 'GOAL',
          content: validation.data.goal,
        },
      });
    }

    // Emit learning event
    await prisma.learningEvent.create({
      data: {
        userId: user.id,
        projectId: project.id,
        type: 'project.created',
        payload: { projectName: project.name, goal: project.goal },
        idempotencyKey: `project.created:${project.id}`,
      },
    });

    return apiSuccess(project, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Space not found', 404);
    console.error('POST /api/spaces/[spaceId]/projects error:', error);
    return apiError('Failed to create project', 500);
  }
}

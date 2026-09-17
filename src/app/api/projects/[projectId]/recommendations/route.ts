import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';
import { assertProjectOwnership } from '@/lib/db/ownership';
import { callLLMStructured } from '@/lib/ai';

// GET /api/projects/[projectId]/recommendations — fetch active recommendations
export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireAuth();
    await assertProjectOwnership(user.id, params.projectId);

    const recommendations = await prisma.recommendation.findMany({
      where: { projectId: params.projectId },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });

    return apiSuccess({ recommendations });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Project not found', 404);
    return apiError('Failed to fetch recommendations', 500);
  }
}

// POST /api/projects/[projectId]/recommendations — generate fresh recommendations using LLM
export async function POST(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireAuth();
    await assertProjectOwnership(user.id, params.projectId);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        conceptMasteries: {
          include: { concept: true },
          orderBy: { masteryScore: 'asc' },
        },
        learningContexts: true,
      },
    });

    if (!project) return apiError('Project not found', 404);

    const masterySummary = project.conceptMasteries
      .map((cm) => `${cm.concept.name}: ${Math.round(cm.masteryScore)}% (Trend: ${cm.trend})`)
      .join('\n');

    const prompt = `Based on the following learner's progress in project "${project.name}" (Goal: "${project.goal || 'General Mastery'}"):

Concept Mastery State:
${masterySummary || 'No concepts evaluated yet'}

Generate 2-3 specific, actionable learning recommendations.
Return JSON with an array named "recommendations", where each object has:
- "text": concise action-oriented recommendation (e.g. "Review backpropagation gradients with the AI tutor")
- "reason": 1-2 sentence explanation grounded in their mastery or trends
- "priority": integer from 1 to 5 (5 highest)`;

    const result = await callLLMStructured<{
      recommendations: { text: string; reason: string; priority: number }[];
    }>('recommendation_generation', [{ role: 'user', content: prompt }], null, {
      userId: user.id,
      projectId: project.id,
      temperature: 0.4,
      maxTokens: 800,
    });

    const createdRecs = [];
    if (result.data?.recommendations) {
      for (const rec of result.data.recommendations) {
        const saved = await prisma.recommendation.create({
          data: {
            projectId: project.id,
            text: rec.text,
            reason: rec.reason,
            priority: rec.priority || 3,
            status: 'ACTIVE',
          },
        });
        createdRecs.push(saved);
      }
    }

    return apiSuccess({ recommendations: createdRecs }, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    console.error('POST recommendations error:', error);
    return apiError('Failed to generate recommendations', 500);
  }
}

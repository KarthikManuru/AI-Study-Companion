import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';
import { assertProjectOwnership } from '@/lib/db/ownership';

// GET /api/projects/[projectId]/analytics — dedicated per-project analytics
export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireAuth();
    await assertProjectOwnership(user.id, params.projectId);

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        space: { select: { id: true, name: true, color: true, icon: true } },
        materials: {
          select: { id: true, fileName: true, status: true, pageCount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        concepts: {
          select: { id: true, name: true, description: true },
        },
        conceptMasteries: {
          include: { concept: true },
          orderBy: { masteryScore: 'asc' },
        },
        quizAttempts: {
          include: {
            questions: {
              include: {
                answer: true,
                concept: true,
              },
            },
          },
          orderBy: { completedAt: 'desc' },
        },
        conversations: {
          include: {
            messages: {
              select: { id: true, role: true, createdAt: true },
            },
          },
        },
        learningEvents: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
      },
    });

    if (!project) return apiError('Project not found', 404);

    // AI Usage scoped to this project
    const aiLogs = await prisma.aiUsageLog.findMany({
      where: { projectId: params.projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    let projectAiTokens = 0;
    let projectAiCost = 0;
    const aiCallsByFeature: Record<string, number> = {};

    for (const log of aiLogs) {
      projectAiTokens += log.promptTokens + log.completionTokens;
      projectAiCost += log.costUsd;
      aiCallsByFeature[log.feature] = (aiCallsByFeature[log.feature] || 0) + 1;
    }

    // Assessment timeline
    const quizTimeline = project.quizAttempts
      .filter((q) => q.status === 'COMPLETED' && q.totalScore !== null)
      .map((q) => ({
        id: q.id,
        score: Math.round(q.totalScore || 0),
        completedAt: q.completedAt,
        questionCount: q.questions.length,
      }));

    // Concept strength distribution
    const masteryScores = project.conceptMasteries.map((m) => Math.round(m.masteryScore));
    const averageMastery =
      masteryScores.length > 0
        ? Math.round(masteryScores.reduce((a, b) => a + b, 0) / masteryScores.length)
        : 0;

    const distribution = {
      mastered: project.conceptMasteries.filter((m) => m.masteryScore >= 80),
      inProgress: project.conceptMasteries.filter((m) => m.masteryScore >= 40 && m.masteryScore < 80),
      needsAttention: project.conceptMasteries.filter((m) => m.masteryScore < 40),
    };

    // Tutor metrics
    const totalMessages = project.conversations.reduce((sum, c) => sum + c.messages.length, 0);

    return apiSuccess({
      project: {
        id: project.id,
        name: project.name,
        goal: project.goal,
        space: project.space,
      },
      summary: {
        totalMaterials: project.materials.length,
        totalPages: project.materials.reduce((sum, m) => sum + (m.pageCount || 0), 0),
        totalConcepts: project.concepts.length,
        averageMastery,
        totalQuizzes: project.quizAttempts.length,
        completedQuizzes: quizTimeline.length,
        averageQuizScore:
          quizTimeline.length > 0
            ? Math.round(quizTimeline.reduce((sum, q) => sum + q.score, 0) / quizTimeline.length)
            : 0,
        totalConversations: project.conversations.length,
        totalMessages,
        aiTokens: projectAiTokens,
        aiCost: Number(projectAiCost.toFixed(4)),
      },
      distribution,
      conceptMasteries: project.conceptMasteries.map((cm) => ({
        id: cm.id,
        name: cm.concept.name,
        score: Math.round(cm.masteryScore),
        trend: cm.trend,
        history: cm.history,
        lastEvidenceAt: cm.lastEvidenceAt,
      })),
      quizTimeline,
      aiUsage: {
        totalCalls: aiLogs.length,
        tokens: projectAiTokens,
        cost: Number(projectAiCost.toFixed(4)),
        callsByFeature: aiCallsByFeature,
        recentLogs: aiLogs.slice(0, 10),
      },
      recentEvents: project.learningEvents.map((evt) => ({
        id: evt.id,
        type: evt.type,
        payload: evt.payload,
        createdAt: evt.createdAt,
      })),
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Project not found', 404);
    console.error('GET /api/projects/[projectId]/analytics error:', error);
    return apiError('Failed to fetch project analytics', 500);
  }
}

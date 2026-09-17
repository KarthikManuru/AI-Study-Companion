import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';

// GET /api/analytics — user global analytics and learning activity feed
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    // 1. Get user's project IDs first (single lightweight query)
    const userSpaces = await prisma.space.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        projects: { select: { id: true, name: true } },
      },
    });

    const projectMap = new Map<string, string>();
    for (const space of userSpaces) {
      for (const project of space.projects) {
        projectMap.set(project.id, project.name);
      }
    }
    const projectIds = Array.from(projectMap.keys());

    // 2. Fetch all data in parallel (each query ~500-700ms on Neon, 
    //    parallel reduces 7× sequential to 1× round-trip wall-clock)
    const searchParams = req.nextUrl.searchParams;
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const [
      materials,
      conceptMasteries,
      quizAttempts,
      conversationCounts,
      learningEvents,
    ] = await Promise.all([
      // Materials stats
      prisma.material.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true, status: true, pageCount: true, projectId: true },
      }),
      // Concept masteries
      prisma.conceptMastery.findMany({
        where: { projectId: { in: projectIds } },
        include: { concept: { select: { name: true } } },
      }),
      // Quiz attempts
      prisma.quizAttempt.findMany({
        where: { projectId: { in: projectIds } },
        select: { id: true, totalScore: true, completedAt: true, status: true, projectId: true },
        orderBy: { completedAt: 'desc' },
      }),
      // Conversation counts
      prisma.conversation.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds } },
        _count: true,
      }),
      // Recent learning events
      prisma.learningEvent.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          project: { select: { id: true, name: true } },
        },
      }),
    ]);

    // 3. Aggregate counts in-memory (fast, no more DB round-trips)
    let totalMaterials = materials.length;
    let totalPages = 0;
    for (const mat of materials) {
      totalPages += mat.pageCount || 0;
    }

    let totalQuizAttempts = quizAttempts.length;
    let completedQuizzes = 0;
    let totalQuizScoreSum = 0;
    const quizScoreHistory: { date: string; score: number; projectName: string }[] = [];

    for (const q of quizAttempts) {
      if (q.status === 'COMPLETED' && q.totalScore !== null) {
        completedQuizzes += 1;
        totalQuizScoreSum += q.totalScore;
        if (q.completedAt) {
          quizScoreHistory.push({
            date: q.completedAt.toISOString().split('T')[0],
            score: Math.round(q.totalScore),
            projectName: projectMap.get(q.projectId) || 'Unknown',
          });
        }
      }
    }

    let totalConversations = 0;
    let totalMessages = 0;
    for (const conv of conversationCounts) {
      totalConversations += conv._count;
    }
    // Note: we no longer count individual messages to avoid the deep include overhead
    // The conversation count is the primary metric shown in analytics

    const allMasteries = conceptMasteries.map((m) => ({
      name: m.concept.name,
      score: Math.round(m.masteryScore),
      trend: m.trend,
      projectName: projectMap.get(m.projectId) || 'Unknown',
    }));

    const averageMastery =
      allMasteries.length > 0
        ? Math.round(allMasteries.reduce((acc, m) => acc + m.score, 0) / allMasteries.length)
        : 0;

    const averageQuizScore =
      completedQuizzes > 0 ? Math.round(totalQuizScoreSum / completedQuizzes) : 0;

    // Categorize masteries
    const strongConcepts = allMasteries.filter((m) => m.score >= 75).slice(0, 8);
    const attentionConcepts = allMasteries.filter((m) => m.score < 50).slice(0, 8);

    return apiSuccess({
      stats: {
        totalSpaces: userSpaces.length,
        totalProjects: projectIds.length,
        totalMaterials,
        totalPages,
        totalQuizAttempts,
        completedQuizzes,
        averageQuizScore,
        averageMastery,
        totalConversations,
        totalMessages,
      },
      concepts: {
        totalTracked: allMasteries.length,
        strongConcepts,
        attentionConcepts,
        allMasteries: allMasteries.slice(0, 20),
      },
      quizScoreHistory: quizScoreHistory.slice(0, 15),
      activityFeed: learningEvents.map((evt) => ({
        id: evt.id,
        type: evt.type,
        payload: evt.payload,
        createdAt: evt.createdAt,
        projectName: evt.project?.name || 'General',
        projectId: evt.projectId,
      })),
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    console.error('GET /api/analytics error:', error);
    return apiError('Failed to load analytics', 500);
  }
}

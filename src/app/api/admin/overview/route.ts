import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAdmin, apiSuccess, apiError } from '@/lib/auth/helpers';

// GET /api/admin/overview — comprehensive admin telemetry and user management data
export async function GET(_req: NextRequest) {
  try {
    await requireAdmin();

    // 1. User metrics & recent user list
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: {
            spaces: true,
            conversations: true,
            learningEvents: true,
          },
        },
      },
    });

    const totalUsers = await prisma.user.count();
    const totalSpaces = await prisma.space.count();
    const totalProjects = await prisma.project.count();
    const totalMaterials = await prisma.material.count();
    const totalQuizzes = await prisma.quizAttempt.count();

    // 2. AI Usage metrics
    const aiLogs = await prisma.aiUsageLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalCostUsd = 0;
    let totalLatencyMs = 0;
    const featureBreakdown: Record<string, { calls: number; cost: number; tokens: number }> = {};

    for (const log of aiLogs) {
      totalPromptTokens += log.promptTokens;
      totalCompletionTokens += log.completionTokens;
      totalCostUsd += log.costUsd;
      totalLatencyMs += log.latencyMs;

      if (!featureBreakdown[log.feature]) {
        featureBreakdown[log.feature] = { calls: 0, cost: 0, tokens: 0 };
      }
      featureBreakdown[log.feature].calls += 1;
      featureBreakdown[log.feature].cost += log.costUsd;
      featureBreakdown[log.feature].tokens += log.promptTokens + log.completionTokens;
    }

    const avgLatencyMs = aiLogs.length > 0 ? Math.round(totalLatencyMs / aiLogs.length) : 0;

    // 3. Eval results
    const evalResults = await prisma.evalResult.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const passedEvals = evalResults.filter((e) => e.passed).length;
    const evalPassRate = evalResults.length > 0 ? Math.round((passedEvals / evalResults.length) * 100) : 100;

    // 4. System-wide learning events
    const recentEvents = await prisma.learningEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 25,
      include: {
        user: { select: { email: true, name: true } },
        project: { select: { name: true } },
      },
    });

    return apiSuccess({
      platformStats: {
        totalUsers,
        totalSpaces,
        totalProjects,
        totalMaterials,
        totalQuizzes,
      },
      aiUsage: {
        totalCalls: aiLogs.length,
        totalPromptTokens,
        totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        totalCostUsd: Number(totalCostUsd.toFixed(4)),
        avgLatencyMs,
        featureBreakdown,
        recentLogs: aiLogs.slice(0, 20),
      },
      evals: {
        totalRuns: evalResults.length,
        passRate: evalPassRate,
        results: evalResults,
      },
      users,
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        type: e.type,
        payload: e.payload,
        createdAt: e.createdAt,
        userEmail: e.user.email,
        projectName: e.project?.name || 'N/A',
      })),
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return apiError('Forbidden: Admin access required', 403);
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    console.error('GET /api/admin/overview error:', error);
    return apiError('Failed to load admin metrics', 500);
  }
}

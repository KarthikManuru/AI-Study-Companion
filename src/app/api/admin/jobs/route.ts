import { NextRequest } from 'next/server';
import { requireAdmin, apiSuccess, apiError } from '@/lib/auth/helpers';
import { getMaterialQueue, getLearningQueue } from '@/lib/jobs/queue';

// GET /api/admin/jobs — real BullMQ background job queue health & telemetry
export async function GET(_req: NextRequest) {
  try {
    await requireAdmin();

    let materialStats: Record<string, number> = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 };
    let learningStats: Record<string, number> = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 };
    let recentFailedJobs: any[] = [];
    let redisConnected = true;

    try {
      const matQueue = getMaterialQueue();
      const learnQueue = getLearningQueue();

      // Query BullMQ queue metrics
      const [matCounts, learnCounts, matFailed, learnFailed] = await Promise.all([
        matQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'),
        learnQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'),
        matQueue.getFailed(0, 10),
        learnQueue.getFailed(0, 10),
      ]);

      materialStats = matCounts as Record<string, number>;
      learningStats = learnCounts as Record<string, number>;

      const formatFailed = (job: any, queueName: string) => ({
        id: job.id,
        queue: queueName,
        name: job.name,
        failedReason: job.failedReason || 'Unknown error',
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts?.attempts || 1,
        timestamp: job.timestamp ? new Date(job.timestamp).toISOString() : new Date().toISOString(),
        data: job.data,
      });

      recentFailedJobs = [
        ...matFailed.map((j) => formatFailed(j, 'material-processing')),
        ...learnFailed.map((j) => formatFailed(j, 'learning-workflows')),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (redisError: any) {
      console.warn('BullMQ Redis connection error in admin jobs health check:', redisError.message);
      redisConnected = false;
    }

    return apiSuccess({
      redisConnected,
      queues: {
        materialProcessing: {
          name: 'material-processing',
          concurrencyLimit: 2,
          counts: materialStats,
          totalQueueDepth: materialStats.waiting + materialStats.active + materialStats.delayed,
        },
        learningWorkflows: {
          name: 'learning-workflows',
          concurrencyLimit: 5,
          counts: learningStats,
          totalQueueDepth: learningStats.waiting + learningStats.active + learningStats.delayed,
        },
      },
      recentFailedJobs,
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden')) return apiError('Forbidden', 403);
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    console.error('GET /api/admin/jobs error:', error);
    return apiError('Failed to retrieve job queue metrics', 500);
  }
}

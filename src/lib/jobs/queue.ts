import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

let connection: IORedis | null = null;
let materialQueue: Queue | null = null;
let learningQueue: Queue | null = null;

function getConnection(): IORedis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return connection;
}

export function getMaterialQueue(): Queue {
  if (!materialQueue) {
    materialQueue = new Queue('material-processing', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return materialQueue;
}

export function getLearningQueue(): Queue {
  if (!learningQueue) {
    learningQueue = new Queue('learning-workflows', {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return learningQueue;
}

/**
 * Add a job to the appropriate queue.
 */
export async function addJob(
  type: string,
  data: Record<string, any>,
  opts?: { priority?: number; delay?: number; jobId?: string }
) {
  const queue = type === 'process-material'
    ? getMaterialQueue()
    : getLearningQueue();

  await queue.add(type, data, {
    priority: opts?.priority,
    delay: opts?.delay,
    jobId: opts?.jobId, // for idempotency
  });
}

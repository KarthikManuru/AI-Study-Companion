import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { processMaterialJob } from './jobs/process-material';
import { processLearningWorkflow } from './jobs/learning-workflows';

const prisma = new PrismaClient();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

console.log('🚀 Starting AI Study Companion Worker...');
console.log(`📡 Connected to Redis: ${redisUrl}`);

// Material processing worker
const materialWorker = new Worker(
  'material-processing',
  async (job: Job) => {
    console.log(`📄 Processing job: ${job.name} (${job.id})`);
    try {
      await processMaterialJob(job, prisma);
      console.log(`✅ Completed job: ${job.name} (${job.id})`);
    } catch (error) {
      console.error(`❌ Failed job: ${job.name} (${job.id})`, error);
      throw error; // Let BullMQ handle retries
    }
  },
  {
    connection,
    concurrency: 2, // Process 2 materials at a time
    limiter: {
      max: 5,
      duration: 60000, // Max 5 jobs per minute
    },
  }
);

// Learning workflow worker
const learningWorker = new Worker(
  'learning-workflows',
  async (job: Job) => {
    console.log(`🧠 Processing workflow: ${job.name} (${job.id})`);
    try {
      await processLearningWorkflow(job, prisma);
      console.log(`✅ Completed workflow: ${job.name} (${job.id})`);
    } catch (error) {
      console.error(`❌ Failed workflow: ${job.name} (${job.id})`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 3,
  }
);

// Error handlers
materialWorker.on('failed', (job, err) => {
  console.error(`❌ Material job ${job?.id} failed:`, err.message);
});

learningWorker.on('failed', (job, err) => {
  console.error(`❌ Learning job ${job?.id} failed:`, err.message);
});

materialWorker.on('completed', (job) => {
  console.log(`✅ Material job ${job.id} completed`);
});

learningWorker.on('completed', (job) => {
  console.log(`✅ Learning job ${job.id} completed`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down workers...');
  await materialWorker.close();
  await learningWorker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Shutting down workers...');
  await materialWorker.close();
  await learningWorker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
});

console.log('✅ Workers running. Waiting for jobs...');

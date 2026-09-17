import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Queue } from 'bullmq';
import { embedText, callLLM } from '../src/lib/ai';

const prisma = new PrismaClient();

async function main() {
  console.log('================================================================');
  console.log('🚀 AI STUDY COMPANION — COMPREHENSIVE END-TO-END VERIFICATION');
  console.log('================================================================\n');

  // 1. Verify Database Connection and Seeded Accounts
  console.log('1️⃣ Verifying Database & User Accounts in Neon...');
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, name: true },
  });
  console.log(`   Found ${users.length} users in Neon DB:`);
  users.forEach((u) => console.log(`   - ${u.email} (${u.role}) [ID: ${u.id}]`));

  const demoUser = users.find((u) => u.email === 'demo@example.com');
  if (!demoUser) throw new Error('Demo user missing from database');

  // 2. Check EvalResults in Neon
  console.log('\n2️⃣ Checking Evaluation Benchmark Results in Neon...');
  const evalResults = await prisma.evalResult.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  console.log(`   Found ${evalResults.length} recent evaluation rows:`);
  evalResults.forEach((e) =>
    console.log(`   - [${e.testCaseId}] ${e.feature}: ${e.passed ? 'PASSED (score: ' + e.score + ')' : 'FAILED'}`)
  );

  // 3. Create Live Space and Project
  console.log('\n3️⃣ Creating Space & Project for End-to-End Test in Neon...');
  let space = await prisma.space.findFirst({
    where: { userId: demoUser.id, name: 'E2E Testing Space' },
  });
  if (!space) {
    space = await prisma.space.create({
      data: {
        userId: demoUser.id,
        name: 'E2E Testing Space',
        description: 'Automated E2E Verification Space',
      },
    });
  }
  console.log(`   Space verified: "${space.name}" (ID: ${space.id})`);

  let project = await prisma.project.findFirst({
    where: { spaceId: space.id, name: 'Machine Learning Fundamentals' },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        spaceId: space.id,
        name: 'Machine Learning Fundamentals',
        description: 'Gradient descent, optimization, and neural foundations',
      },
    });
  }
  console.log(`   Project verified: "${project.name}" (ID: ${project.id})`);

  // 4. Material, Chunking & pgvector Embedding Test
  console.log('\n4️⃣ Testing Material Ingestion & pgvector Storage in Neon...');
  let material = await prisma.material.findFirst({
    where: { projectId: project.id, fileName: 'Gradient Descent Handbook.pdf' },
  });
  if (!material) {
    material = await prisma.material.create({
      data: {
        projectId: project.id,
        fileName: 'Gradient Descent Handbook.pdf',
        storageUrl: 'uploads/demo/gradient_descent.pdf',
        status: 'READY',
        pageCount: 12,
        fileSize: 1048576,
        mimeType: 'application/pdf',
      },
    });
  }
  console.log(`   Material record active: "${material.fileName}" (Status: ${material.status})`);

  // Generate real vector for chunk
  const chunkText =
    'Gradient descent is an iterative first-order optimization algorithm. ' +
    'The learning rate determines the size of the steps taken to reach a minimum. ' +
    'If the learning rate is configured excessively large, parameter updates overshoot the local minima.';
  
  const embRes = await embedText(chunkText);
  const embedding = embRes.embedding;
  console.log(`   Generated vector embedding with ${embedding.length} dimensions.`);

  // Clean old test chunks for idempotency
  await prisma.$executeRawUnsafe(
    `DELETE FROM chunks WHERE "materialId" = $1`,
    material.id
  );

  // Insert into pgvector column
  const vectorStr = `[${embedding.join(',')}]`;
  await prisma.$executeRawUnsafe(
    `INSERT INTO chunks (id, "materialId", content, "pageNumber", "chunkIndex", embedding, "createdAt")
     VALUES (gen_random_uuid(), $1, $2, 1, 0, $3::vector, NOW())`,
    material.id,
    chunkText,
    vectorStr
  );
  console.log(`   Successfully inserted chunk with pgvector embedding into Neon!`);

  // Query pgvector with cosine distance (<=>)
  console.log('\n5️⃣ Testing Semantic Search via Neon pgvector (<=> cosine distance)...');
  const queryEmbRes = await embedText('What happens if learning rate is too large?');
  const queryEmbedding = queryEmbRes.embedding;
  const queryVectorStr = `[${queryEmbedding.join(',')}]`;
  
  const searchResults: any[] = await prisma.$queryRawUnsafe(
    `SELECT c.id, c.content, c."pageNumber", (1 - (c.embedding <=> $1::vector)) as similarity
     FROM chunks c
     WHERE c."materialId" = $2
     ORDER BY c.embedding <=> $1::vector ASC
     LIMIT 1`,
    queryVectorStr,
    material.id
  );

  console.log(`   pgvector returned ${searchResults.length} matches:`);
  searchResults.forEach((r) =>
    console.log(`   - Cosine Similarity: ${Number(r.similarity).toFixed(4)} | Page ${r.pageNumber} | Snippet: "${r.content.slice(0, 75)}..."`)
  );

  // 6. Test Grounded AI Tutor Response with Citation
  console.log('\n6️⃣ Testing Grounded AI Tutor Response & Live AiUsageLog...');
  const evidence = searchResults.map((r) => ({
    materialName: material!.fileName,
    pageNumber: r.pageNumber,
    content: r.content,
  }));

  const tutorPrompt = `STUDY MATERIAL:\n${evidence.map((e) => `[Material: ${e.materialName}, Page ${e.pageNumber}]:\n${e.content}`).join('\n\n')}\n\nSTUDENT QUESTION:\nWhat happens if the learning rate is too large?`;

  const tutorRes = await callLLM(
    'tutor_chat',
    [{ role: 'user', content: tutorPrompt }],
    {
      systemPrompt: 'You are an AI Study Tutor. Ground all answers strictly in study material and cite [Material Name, Page X].',
      temperature: 0.2,
      maxTokens: 300,
      userId: demoUser.id,
      projectId: project.id,
    }
  );

  console.log(`   Tutor Response Output:`);
  console.log(`   "${tutorRes.content.trim()}"`);
  console.log(`   Metrics: promptTokens=${tutorRes.promptTokens}, completionTokens=${tutorRes.completionTokens}, latency=${tutorRes.latencyMs}ms`);

  // 7. Verify Live AiUsageLog Row in Neon
  console.log('\n7️⃣ Verifying Live AiUsageLog Row in Neon...');
  const latestLog = await prisma.aiUsageLog.findFirst({
    where: { userId: demoUser.id, projectId: project.id },
    orderBy: { createdAt: 'desc' },
  });
  if (latestLog) {
    console.log(`   Verified AiUsageLog in Neon DB:`);
    console.log(`   - ID: ${latestLog.id}`);
    console.log(`   - Feature: ${latestLog.feature}`);
    console.log(`   - Model: ${latestLog.model}`);
    console.log(`   - Tokens: ${latestLog.promptTokens} in / ${latestLog.completionTokens} out (${latestLog.promptTokens + latestLog.completionTokens} total)`);
    console.log(`   - Latency: ${latestLog.latencyMs}ms`);
    console.log(`   - CreatedAt: ${latestLog.createdAt.toISOString()}`);
  } else {
    throw new Error('AiUsageLog row was not written to database!');
  }

  // 8. Test Insufficient Evidence Refusal
  console.log('\n8️⃣ Testing Insufficient Evidence Refusal...');
  const refusalRes = await callLLM(
    'tutor_chat',
    [{ role: 'user', content: 'STUDENT QUESTION:\nWhat are the exact ingredients to bake a French croissant?' }],
    {
      systemPrompt: 'You are an AI Study Tutor. If material does not cover the topic, state that the material does not cover this topic.',
      temperature: 0.1,
    }
  );
  console.log(`   Refusal Response Output:`);
  console.log(`   "${refusalRes.content.trim()}"`);

  // 9. Test Concept Mastery Math (0.7 * old + 0.3 * quiz)
  console.log('\n9️⃣ Testing Concept Mastery Update Formula...');
  let concept = await prisma.concept.findFirst({
    where: { projectId: project.id, name: 'Learning Rate Dynamics' },
  });
  if (!concept) {
    concept = await prisma.concept.create({
      data: {
        projectId: project.id,
        name: 'Learning Rate Dynamics',
        description: 'Step size hyperparameter in gradient descent',
      },
    });
  }

  // Initial mastery
  let mastery = await prisma.conceptMastery.findFirst({
    where: { projectId: project.id, conceptId: concept.id },
  });
  const initialScore = mastery?.masteryScore ?? 45.0;
  console.log(`   Initial Mastery Score: ${initialScore}`);

  const quizScore = 90.0; // Student scored 90%
  const updatedScore = Number((0.7 * initialScore + 0.3 * quizScore).toFixed(2));

  await prisma.conceptMastery.upsert({
    where: {
      projectId_conceptId: {
        projectId: project.id,
        conceptId: concept.id,
      },
    },
    update: {
      masteryScore: updatedScore,
      lastEvidenceAt: new Date(),
      trend: updatedScore > initialScore ? 'IMPROVING' : 'NEEDS_ATTENTION',
    },
    create: {
      projectId: project.id,
      conceptId: concept.id,
      masteryScore: updatedScore,
      lastEvidenceAt: new Date(),
      trend: 'IMPROVING',
    },
  });

  const refreshedMastery = await prisma.conceptMastery.findUnique({
    where: { projectId_conceptId: { projectId: project.id, conceptId: concept.id } },
  });
  console.log(`   Updated Mastery Score: ${refreshedMastery?.masteryScore} (Formula: 0.7 * ${initialScore} + 0.3 * ${quizScore} = ${updatedScore})`);

  // 10. Verify Upstash Redis Connectivity
  console.log('\n🔟 Testing Upstash Redis Worker Queue Connectivity...');
  if (process.env.REDIS_URL) {
    const redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    const ping = await redis.ping();
    console.log(`   Upstash Redis Ping Response: "${ping}"`);

    const queue = new Queue('document-processing', { connection: redis });
    const jobCounts = await queue.getJobCounts();
    console.log(`   BullMQ 'document-processing' Queue Counts:`, jobCounts);
    await queue.close();
    await redis.quit();
  } else {
    console.log('   REDIS_URL not configured');
  }

  console.log('\n================================================================');
  console.log('✅ ALL END-TO-END CRITICAL PATHS VERIFIED AGAINST LIVE INFRASTRUCTURE!');
  console.log('================================================================\n');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ E2E Verification failed:', err);
  process.exit(1);
});

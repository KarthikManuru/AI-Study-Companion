import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { callLLMStructured } from '@/lib/ai';

export async function processLearningWorkflow(job: Job, prisma: PrismaClient) {
  switch (job.name) {
    case 'update-mastery':
      await updateMasteryWorkflow(job, prisma);
      break;
    case 'generate-recommendation':
      await generateRecommendationWorkflow(job, prisma);
      break;
    case 'detect-patterns':
      await detectPatternsWorkflow(job, prisma);
      break;
    default:
      console.warn(`Unknown workflow: ${job.name}`);
  }
}

/**
 * Recalculate mastery trends after quiz completion.
 */
async function updateMasteryWorkflow(job: Job, prisma: PrismaClient) {
  const { projectId, userId } = job.data;

  const masteries = await prisma.conceptMastery.findMany({
    where: { projectId },
    include: { concept: true },
  });

  for (const mastery of masteries) {
    // Determine trend based on history
    const history = (mastery.history as number[]) || [];
    let trend: 'IMPROVING' | 'STABLE' | 'NEEDS_ATTENTION' = 'STABLE';

    if (history.length >= 2) {
      const recent = history.slice(-3);
      const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const prevAvg = history.slice(-6, -3).length > 0
        ? history.slice(-6, -3).reduce((s, v) => s + v, 0) / history.slice(-6, -3).length
        : mastery.masteryScore;

      if (avg - prevAvg > 5) trend = 'IMPROVING';
      else if (prevAvg - avg > 5) trend = 'NEEDS_ATTENTION';
      else trend = 'STABLE';
    }

    if (mastery.masteryScore < 40) trend = 'NEEDS_ATTENTION';

    await prisma.conceptMastery.update({
      where: { id: mastery.id },
      data: { trend },
    });
  }
}

/**
 * Generate personalized recommendations based on mastery state.
 */
async function generateRecommendationWorkflow(job: Job, prisma: PrismaClient) {
  const { projectId, userId } = job.data;

  // Get current mastery state
  const masteries = await prisma.conceptMastery.findMany({
    where: { projectId },
    include: { concept: true },
    orderBy: { masteryScore: 'asc' },
  });

  if (masteries.length === 0) return;

  // Get recent quiz results
  const recentAnswers = await prisma.answer.findMany({
    where: { question: { quizAttempt: { projectId } } },
    include: {
      question: {
        include: { concept: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Get project goal
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, goal: true },
  });

  // Build context for recommendation
  const weakConcepts = masteries.filter((m) => m.masteryScore < 60);
  const recentMistakes = recentAnswers.filter((a) => !a.isCorrect && a.question.concept);

  const contextSummary = `
Project: ${project?.name}
Goal: ${project?.goal || 'No specific goal'}

Weak Concepts:
${weakConcepts.map((m) => `- ${m.concept.name}: ${Math.round(m.masteryScore)}% (${m.trend})`).join('\n')}

Recent Mistakes:
${recentMistakes.slice(0, 5).map((a) => `- ${a.question.concept?.name}: "${a.question.prompt.slice(0, 100)}"`).join('\n')}

Overall Mastery: ${Math.round(masteries.reduce((s, m) => s + m.masteryScore, 0) / masteries.length)}%
  `.trim();

  // Generate recommendation
  let rec: { text?: string; reason?: string } = {};

  try {
    const recResult = await callLLMStructured<{ text: string; reason: string }>(
      'recommendation',
      [
        {
          role: 'user',
          content: `Generate a learning recommendation based on:\n\n${contextSummary}`,
        },
      ],
      null,
      {
        systemPrompt: `You are a learning advisor. Based on the student's mastery data, generate a specific, actionable recommendation.
Return valid JSON with "text" (the recommendation, 1-2 sentences) and "reason" (why this is recommended, 1 sentence).
The recommendation should be concrete and helpful, not generic.`,
        temperature: 0.5,
        maxTokens: 500,
        userId,
        projectId,
      }
    );
    rec = recResult.data || {};
  } catch (err) {
    console.warn('  ⚠️ Failed to generate recommendation with LLM:', err);
  }

    // Dismiss old active recommendations
    await prisma.recommendation.updateMany({
      where: { projectId, status: 'ACTIVE' },
      data: { status: 'DISMISSED' },
    });

    // Create new recommendation
    await prisma.recommendation.create({
      data: {
        projectId,
        text: rec.text || 'Continue practicing your weak concepts.',
        reason: rec.reason || 'Based on your recent performance.',
        status: 'ACTIVE',
      },
    });

    // Emit event
    await prisma.learningEvent.create({
      data: {
        userId,
        projectId,
        type: 'recommendation.generated',
        payload: { text: rec.text },
        idempotencyKey: `recommendation.generated:${projectId}:${Date.now()}`,
      },
    });
  }

/**
 * Detect repeated mistake patterns.
 */
async function detectPatternsWorkflow(job: Job, prisma: PrismaClient) {
  const { projectId, userId } = job.data;

  // Find concepts with 2+ wrong answers
  const wrongAnswers = await prisma.answer.findMany({
    where: {
      isCorrect: false,
      question: {
        quizAttempt: { projectId },
        conceptId: { not: null },
      },
    },
    include: {
      question: { include: { concept: true } },
    },
  });

  // Group by concept
  const conceptMistakes: Record<string, { name: string; count: number; details: string[] }> = {};
  for (const answer of wrongAnswers) {
    const conceptName = answer.question.concept?.name || 'Unknown';
    if (!conceptMistakes[conceptName]) {
      conceptMistakes[conceptName] = { name: conceptName, count: 0, details: [] };
    }
    conceptMistakes[conceptName].count++;
    conceptMistakes[conceptName].details.push(answer.question.prompt.slice(0, 100));
  }

  // Write patterns to LearningContext
  for (const [, mistake] of Object.entries(conceptMistakes)) {
    if (mistake.count >= 2) {
      await prisma.learningContext.upsert({
        where: {
          id: `mistake_${projectId}_${mistake.name}`,
        },
        update: {
          content: `Repeated mistakes in "${mistake.name}" (${mistake.count} times). Questions missed: ${mistake.details.join('; ')}`,
          relevanceScore: Math.min(1.0, mistake.count * 0.3),
        },
        create: {
          id: `mistake_${projectId}_${mistake.name}`,
          projectId,
          kind: 'MISTAKE_PATTERN',
          content: `Repeated mistakes in "${mistake.name}" (${mistake.count} times). Questions missed: ${mistake.details.join('; ')}`,
          relevanceScore: Math.min(1.0, mistake.count * 0.3),
        },
      });
    }
  }
}

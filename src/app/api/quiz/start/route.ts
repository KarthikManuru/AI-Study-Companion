import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';
import { assertProjectOwnership } from '@/lib/db/ownership';
import { callLLMStructured, callLLM } from '@/lib/ai';
import { retrieveRelevantChunks, formatChunksAsContext } from '@/lib/ai/retrieval';
import { addJob } from '@/lib/jobs/queue';

const startQuizSchema = z.object({
  projectId: z.string(),
  questionCount: z.number().min(3).max(20).default(5),
});

const answerSchema = z.object({
  questionId: z.string(),
  answer: z.string().min(1),
});

// POST /api/quiz/start — start a new quiz
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const validation = startQuizSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const { projectId, questionCount } = validation.data;
    await assertProjectOwnership(user.id, projectId);

    // Get current mastery state
    const masteries = await prisma.conceptMastery.findMany({
      where: { projectId },
      include: { concept: true },
      orderBy: { masteryScore: 'asc' },
    });

    if (masteries.length === 0) {
      return apiError('No concepts available. Upload and process materials first.', 400);
    }

    // Get recent answer history for adaptive selection
    const recentAnswers = await prisma.answer.findMany({
      where: { question: { quizAttempt: { projectId } } },
      include: { question: { select: { conceptId: true, type: true, difficulty: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // Adaptive concept selection: weight by lower mastery + recently wrong
    const conceptScores: { conceptId: string; conceptName: string; weight: number; masteryScore: number }[] = [];
    
    for (const mastery of masteries) {
      let weight = 100 - mastery.masteryScore; // Lower mastery = higher weight

      // Boost weight for recently wrong concepts
      const recentWrong = recentAnswers.filter(
        (a) => a.question.conceptId === mastery.conceptId && !a.isCorrect
      ).length;
      weight += recentWrong * 10;

      // Boost weight for NEEDS_ATTENTION trend
      if (mastery.trend === 'NEEDS_ATTENTION') weight += 15;

      // Slight randomness to avoid repetitive quizzes
      weight += Math.random() * 10;

      conceptScores.push({
        conceptId: mastery.conceptId,
        conceptName: mastery.concept.name,
        weight,
        masteryScore: mastery.masteryScore,
      });
    }

    // Sort by weight (descending) and select top concepts
    conceptScores.sort((a, b) => b.weight - a.weight);
    const selectedConcepts = conceptScores.slice(0, questionCount);

    // Create quiz attempt
    const quizAttempt = await prisma.quizAttempt.create({
      data: { projectId },
    });

    // Generate questions for selected concepts
    const questions = [];
    for (let i = 0; i < selectedConcepts.length; i++) {
      const concept = selectedConcepts[i];
      
      // Determine difficulty based on mastery
      const difficulty = concept.masteryScore >= 80 ? 5
        : concept.masteryScore >= 60 ? 4
        : concept.masteryScore >= 40 ? 3
        : concept.masteryScore >= 20 ? 2
        : 1;

      // Determine question type: mix MCQ and open-ended
      const type = i % 3 === 2 ? 'OPEN' : 'MCQ'; // Every 3rd question is open-ended

      // Get relevant material for this concept
      const chunks = await retrieveRelevantChunks(projectId, concept.conceptName, 3);
      const evidence = formatChunksAsContext(chunks);

      // Generate question using LLM
      const questionPrompt = type === 'MCQ'
        ? `Generate a multiple-choice question about "${concept.conceptName}" at difficulty level ${difficulty}/5.
Based on this study material:
${evidence}

Return JSON with:
- "prompt": the question text
- "choices": array of 4 objects with "id" (a/b/c/d), "text", and "isCorrect" (exactly one true)
- "correctAnswer": the id of the correct choice
- "explanation": brief explanation of the correct answer`
        : `Generate an open-ended question about "${concept.conceptName}" at difficulty level ${difficulty}/5.
Based on this study material:
${evidence}

Return JSON with:
- "prompt": the question text (should require explanation/understanding, not just recall)
- "explanation": what a good answer should cover
- "correctAnswer": a model answer`;

      try {
        const response = await callLLMStructured<any>(
          'quiz_generation',
          [{ role: 'user', content: questionPrompt }],
          null,
          {
            userId: user.id,
            projectId,
            temperature: 0.5,
            maxTokens: 1000,
            systemPrompt: 'You are a quiz question generator. Return ONLY valid JSON. Generate educational, clear questions.',
          }
        );

        const q = response.data;
        const question = await prisma.question.create({
          data: {
            quizAttemptId: quizAttempt.id,
            conceptId: concept.conceptId,
            type: type as any,
            difficulty,
            prompt: q.prompt || `Question about ${concept.conceptName}`,
            choices: type === 'MCQ' ? q.choices : null,
            correctAnswer: q.correctAnswer || null,
            explanation: q.explanation || null,
          },
        });

        questions.push(question);
      } catch (error) {
        console.error(`Failed to generate question for ${concept.conceptName}:`, error);
        // Create a fallback question
        const question = await prisma.question.create({
          data: {
            quizAttemptId: quizAttempt.id,
            conceptId: concept.conceptId,
            type: 'OPEN',
            difficulty,
            prompt: `Explain the key aspects of ${concept.conceptName} and why it is important.`,
            correctAnswer: null,
            explanation: null,
          },
        });
        questions.push(question);
      }
    }

    // Emit learning event
    await prisma.learningEvent.create({
      data: {
        userId: user.id,
        projectId,
        type: 'quiz.started',
        payload: { quizAttemptId: quizAttempt.id, questionCount: questions.length },
        idempotencyKey: `quiz.started:${quizAttempt.id}`,
      },
    });

    return apiSuccess({
      quizAttemptId: quizAttempt.id,
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        difficulty: q.difficulty,
        prompt: q.prompt,
        choices: q.choices,
      })),
    }, 201);
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Project not found', 404);
    console.error('POST /api/quiz/start error:', error);
    return apiError('Failed to start quiz', 500);
  }
}

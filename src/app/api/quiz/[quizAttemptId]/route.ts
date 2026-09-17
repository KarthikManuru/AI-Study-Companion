import { NextRequest } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';
import { assertProjectOwnership } from '@/lib/db/ownership';

// GET /api/quiz/[quizAttemptId] — get full quiz attempt with questions and graded answers
export async function GET(
  req: NextRequest,
  { params }: { params: { quizAttemptId: string } }
) {
  try {
    const user = await requireAuth();
    const { quizAttemptId } = params;

    const quizAttempt = await prisma.quizAttempt.findUnique({
      where: { id: quizAttemptId },
      include: {
        questions: {
          include: {
            concept: true,
            answer: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!quizAttempt) {
      return apiError('Quiz attempt not found', 404);
    }

    await assertProjectOwnership(user.id, quizAttempt.projectId);

    return apiSuccess({
      quiz: {
        id: quizAttempt.id,
        projectId: quizAttempt.projectId,
        status: quizAttempt.status,
        totalScore: quizAttempt.totalScore,
        startedAt: quizAttempt.startedAt,
        completedAt: quizAttempt.completedAt,
        questions: quizAttempt.questions.map((q) => ({
          id: q.id,
          type: q.type,
          difficulty: q.difficulty,
          prompt: q.prompt,
          choices: q.choices,
          correctAnswer: quizAttempt.status === 'COMPLETED' ? q.correctAnswer : null,
          explanation: quizAttempt.status === 'COMPLETED' ? q.explanation : null,
          concept: q.concept ? { id: q.concept.id, name: q.concept.name } : null,
          answer: q.answer
            ? {
                userAnswer: q.answer.userAnswer,
                isCorrect: q.answer.isCorrect,
                score: q.answer.score,
                feedback: q.answer.feedback,
                missingConcepts: q.answer.missingConcepts,
              }
            : null,
        })),
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Not found', 404);
    console.error('GET /api/quiz/[quizAttemptId] error:', error);
    return apiError('Failed to fetch quiz', 500);
  }
}

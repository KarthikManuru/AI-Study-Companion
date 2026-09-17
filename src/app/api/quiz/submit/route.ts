import { NextRequest } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import { requireAuth, apiSuccess, apiError } from '@/lib/auth/helpers';
import { assertProjectOwnership } from '@/lib/db/ownership';
import { callLLMStructured } from '@/lib/ai';
import { addJob } from '@/lib/jobs/queue';

const submitQuizSchema = z.object({
  quizAttemptId: z.string(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
    })
  ).min(1),
});

interface OpenGradingResult {
  score: number; // 0 - 100
  isCorrect: boolean;
  feedback: string;
  missingConcepts?: string[];
}

// POST /api/quiz/submit — grade quiz answers and update mastery
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const validation = submitQuizSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
    }

    const { quizAttemptId, answers: submittedAnswers } = validation.data;

    const quizAttempt = await prisma.quizAttempt.findUnique({
      where: { id: quizAttemptId },
      include: {
        project: true,
        questions: {
          include: {
            concept: true,
          },
        },
      },
    });

    if (!quizAttempt) {
      return apiError('Quiz attempt not found', 404);
    }

    await assertProjectOwnership(user.id, quizAttempt.projectId);

    if (quizAttempt.status === 'COMPLETED') {
      return apiError('This quiz attempt has already been submitted', 400);
    }

    const questionMap = new Map(quizAttempt.questions.map((q) => [q.id, q]));
    const gradedResults = [];
    let totalScoreSum = 0;
    const conceptUpdates: Record<string, { totalScore: number; count: number; conceptId: string }> = {};

    for (const sub of submittedAnswers) {
      const question = questionMap.get(sub.questionId);
      if (!question) continue;

      let isCorrect = false;
      let score = 0;
      let feedback = '';
      let missingConcepts: string[] = [];

      if (question.type === 'MCQ') {
        // Deterministic MCQ grading
        const correctChoiceId = question.correctAnswer?.trim().toLowerCase();
        const userChoice = sub.answer.trim().toLowerCase();

        isCorrect = correctChoiceId === userChoice;
        score = isCorrect ? 100 : 0;
        feedback = isCorrect
          ? 'Correct! Well done.'
          : `Incorrect. The correct answer was ${question.correctAnswer?.toUpperCase()}.${
              question.explanation ? ' ' + question.explanation : ''
            }`;
      } else {
        // LLM grading for OPEN questions
        try {
          const gradingPrompt = `You are an expert academic evaluator. Grade the learner's response to the following question.

Question Prompt:
${question.prompt}

Expected / Model Answer:
${question.correctAnswer || 'Comprehensive explanation demonstrating concept grasp'}

Evaluation Guide:
${question.explanation || 'Assess accuracy, depth of understanding, and clear articulation.'}

Learner's Answer:
"""
${sub.answer}
"""

Evaluate the answer objectively on a scale of 0 to 100:
- 80-100: Fully correct or minor missing nuances.
- 50-79: Partially correct with notable omissions or inaccuracies.
- 0-49: Incorrect, completely off-topic, or missing core principles.

Return JSON with:
- "score": number between 0 and 100
- "isCorrect": boolean (true if score >= 65)
- "feedback": 2-3 sentences of constructive critique highlighting what was good and what was missed
- "missingConcepts": array of strings listing any key concepts or terms that were missing`;

          const evaluation = await callLLMStructured<OpenGradingResult>(
            'quiz_grading',
            [{ role: 'user', content: gradingPrompt }],
            null,
            {
              userId: user.id,
              projectId: quizAttempt.projectId,
              temperature: 0.2,
              maxTokens: 600,
              systemPrompt: 'You are an accurate, constructive academic grader. Return valid JSON only.',
            }
          );

          score = Math.max(0, Math.min(100, Math.round(evaluation.data.score || 0)));
          isCorrect = Boolean(evaluation.data.isCorrect ?? (score >= 65));
          feedback = evaluation.data.feedback || (isCorrect ? 'Good explanation.' : 'Incomplete explanation.');
          missingConcepts = evaluation.data.missingConcepts || [];
        } catch (gradingError) {
          console.error('LLM grading error, falling back to heuristic:', gradingError);
          // Graceful fallback if LLM times out
          score = sub.answer.trim().length > 30 ? 70 : 30;
          isCorrect = score >= 65;
          feedback = isCorrect
            ? 'Answer received and recorded. Demonstrated reasonable effort.'
            : 'Answer appears too brief or lacking necessary depth.';
        }
      }

      // Upsert Answer record
      const answerRecord = await prisma.answer.upsert({
        where: { questionId: question.id },
        update: {
          userAnswer: sub.answer,
          isCorrect,
          score,
          feedback,
          missingConcepts: missingConcepts.length > 0 ? missingConcepts : undefined,
        },
        create: {
          questionId: question.id,
          userAnswer: sub.answer,
          isCorrect,
          score,
          feedback,
          missingConcepts: missingConcepts.length > 0 ? missingConcepts : undefined,
        },
      });

      totalScoreSum += score;
      gradedResults.push({
        questionId: question.id,
        prompt: question.prompt,
        type: question.type,
        userAnswer: sub.answer,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        isCorrect,
        score,
        feedback,
        missingConcepts,
        concept: question.concept ? { id: question.concept.id, name: question.concept.name } : null,
      });

      // Track concept mastery delta
      if (question.conceptId) {
        if (!conceptUpdates[question.conceptId]) {
          conceptUpdates[question.conceptId] = { totalScore: 0, count: 0, conceptId: question.conceptId };
        }
        conceptUpdates[question.conceptId].totalScore += score;
        conceptUpdates[question.conceptId].count += 1;
      }
    }

    const questionCount = quizAttempt.questions.length;
    const finalTotalScore = questionCount > 0 ? Math.round(totalScoreSum / questionCount) : 0;

    // Update QuizAttempt
    await prisma.quizAttempt.update({
      where: { id: quizAttempt.id },
      data: {
        status: 'COMPLETED',
        totalScore: finalTotalScore,
        completedAt: new Date(),
      },
    });

    // Update ConceptMasteries with documented formula:
    // newMastery = (currentMastery * 0.7) + (quizAverageForConcept * 0.3)
    const masteryDeltas: { conceptId: string; oldScore: number; newScore: number; trend: string }[] = [];
    for (const conceptId of Object.keys(conceptUpdates)) {
      const { totalScore, count } = conceptUpdates[conceptId];
      const perfAvg = totalScore / count;

      const currentMastery = await prisma.conceptMastery.findUnique({
        where: {
          projectId_conceptId: {
            projectId: quizAttempt.projectId,
            conceptId,
          },
        },
      });

      if (currentMastery) {
        const oldScore = currentMastery.masteryScore;
        const newScore = Math.round(oldScore * 0.7 + perfAvg * 0.3);
        const history = Array.isArray(currentMastery.history) ? (currentMastery.history as number[]) : [];
        const updatedHistory = [...history, newScore].slice(-20);

        let trend: 'IMPROVING' | 'STABLE' | 'NEEDS_ATTENTION' = 'STABLE';
        if (newScore > oldScore + 4) trend = 'IMPROVING';
        else if (newScore < oldScore - 4 || newScore < 40) trend = 'NEEDS_ATTENTION';

        await prisma.conceptMastery.update({
          where: { id: currentMastery.id },
          data: {
            masteryScore: newScore,
            lastEvidenceAt: new Date(),
            trend,
            history: updatedHistory,
          },
        });

        masteryDeltas.push({
          conceptId,
          oldScore,
          newScore,
          trend,
        });
      }
    }

    // Emit learning event
    await prisma.learningEvent.create({
      data: {
        userId: user.id,
        projectId: quizAttempt.projectId,
        type: 'quiz.completed',
        payload: {
          quizAttemptId: quizAttempt.id,
          totalScore: finalTotalScore,
          questionCount,
          correctCount: gradedResults.filter((r) => r.isCorrect).length,
          masteryDeltas,
        },
        idempotencyKey: `quiz.completed:${quizAttempt.id}`,
      },
    });

    // Enqueue learning workflow background jobs (recalculate trends, generate fresh recommendations, detect repeated mistake patterns)
    try {
      await addJob('update-mastery', {
        projectId: quizAttempt.projectId,
        userId: user.id,
      });
      await addJob('generate-recommendation', {
        projectId: quizAttempt.projectId,
        userId: user.id,
      });
      await addJob('detect-patterns', {
        projectId: quizAttempt.projectId,
        userId: user.id,
      });
    } catch (jobErr) {
      console.warn('Could not enqueue learning background jobs (Redis may be offline):', jobErr);
    }

    return apiSuccess({
      quizAttemptId: quizAttempt.id,
      totalScore: finalTotalScore,
      questionsGraded: gradedResults.length,
      results: gradedResults,
      masteryDeltas,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401);
    if (error.message?.includes('not found')) return apiError('Project not found', 404);
    console.error('POST /api/quiz/submit error:', error);
    return apiError('Failed to submit quiz', 500);
  }
}

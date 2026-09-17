'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Choice {
  id: string;
  text: string;
  isCorrect?: boolean;
}

interface Question {
  id: string;
  type: 'MCQ' | 'OPEN';
  difficulty: number;
  prompt: string;
  choices?: Choice[] | null;
  concept?: { id: string; name: string } | null;
}

interface GradedResult {
  questionId: string;
  prompt: string;
  type: 'MCQ' | 'OPEN';
  userAnswer: string;
  correctAnswer?: string | null;
  explanation?: string | null;
  isCorrect: boolean;
  score: number;
  feedback: string;
  missingConcepts?: string[];
  concept?: { id: string; name: string } | null;
}

interface MasteryDelta {
  conceptId: string;
  oldScore: number;
  newScore: number;
  trend: string;
}

interface PastAttempt {
  id: string;
  status: string;
  totalScore: number | null;
  startedAt: string;
  completedAt: string | null;
  _count?: { questions: number };
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [mode, setMode] = useState<'SETUP' | 'ACTIVE' | 'REVIEW'>('SETUP');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quizAttemptId, setQuizAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});

  // Review State
  const [finalScore, setFinalScore] = useState<number>(0);
  const [gradedResults, setGradedResults] = useState<GradedResult[]>([]);
  const [masteryDeltas, setMasteryDeltas] = useState<MasteryDelta[]>([]);

  // Project data & past quizzes
  const [projectName, setProjectName] = useState('');
  const [pastAttempts, setPastAttempts] = useState<PastAttempt[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchProjectInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const json = await res.json();
        setProjectName(json.data.project.name);
        if (json.data.project.quizAttempts) {
          setPastAttempts(json.data.project.quizAttempts);
        }
      }
    } catch (err) {
      console.error('Failed to load project details:', err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectInfo();
  }, [fetchProjectInfo]);

  const handleStartQuiz = async () => {
    setIsStarting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/quiz/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, questionCount }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start quiz');
      }

      setQuizAttemptId(data.data.quizAttemptId);
      setQuestions(data.data.questions);
      setUserAnswers({});
      setCurrentIndex(0);
      setMode('ACTIVE');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error generating quiz. Ensure materials have finished processing.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSelectChoice = (questionId: string, choiceId: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: choiceId }));
  };

  const handleAnswerText = (questionId: string, text: string) => {
    setUserAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  const handleSubmitQuiz = async () => {
    if (!quizAttemptId) return;

    // Check if any question remains unanswered
    const unansweredCount = questions.filter((q) => !userAnswers[q.id]?.trim()).length;
    if (unansweredCount > 0) {
      const confirmSubmit = window.confirm(
        `You have ${unansweredCount} unanswered question(s). Are you sure you want to submit?`
      );
      if (!confirmSubmit) return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payloadAnswers = questions.map((q) => ({
        questionId: q.id,
        answer: userAnswers[q.id] || '',
      }));

      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizAttemptId,
          answers: payloadAnswers,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to grade quiz');
      }

      setFinalScore(data.data.totalScore);
      setGradedResults(data.data.results);
      setMasteryDeltas(data.data.masteryDeltas || []);
      setMode('REVIEW');
      fetchProjectInfo(); // Refresh past attempts list
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to grade quiz answers');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewPastQuiz = async (attemptId: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/quiz/${attemptId}`);
      if (!res.ok) throw new Error('Failed to load past attempt');
      const data = await res.json();
      const quiz = data.data.quiz;

      setQuizAttemptId(quiz.id);
      setFinalScore(quiz.totalScore || 0);
      setGradedResults(
        quiz.questions.map((q: any) => ({
          questionId: q.id,
          prompt: q.prompt,
          type: q.type,
          userAnswer: q.answer?.userAnswer || '(No answer)',
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          isCorrect: q.answer?.isCorrect || false,
          score: q.answer?.score || 0,
          feedback: q.answer?.feedback || '',
          missingConcepts: q.answer?.missingConcepts || [],
          concept: q.concept,
        }))
      );
      setMasteryDeltas([]);
      setMode('REVIEW');
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Link href="/dashboard/spaces" className="hover:underline">Spaces</Link>
            <span>/</span>
            <Link href={`/dashboard/projects/${projectId}`} className="hover:underline">
              {projectName || 'Project'}
            </Link>
            <span>/</span>
            <span className="text-foreground">Adaptive Quiz</span>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span>Adaptive Quiz & Assessment</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
              AI Grounded
            </span>
          </h1>
        </div>

        {mode !== 'SETUP' && (
          <button
            onClick={() => setMode('SETUP')}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition"
          >
            ← Back to Quiz Hub
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-xs font-semibold ml-4">Dismiss</button>
        </div>
      )}

      {/* MODE 1: SETUP & PAST QUIZZES */}
      {mode === 'SETUP' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Launcher Card */}
          <div className="md:col-span-2 p-6 rounded-2xl border border-border bg-card shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Start Adaptive Knowledge Check</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Our AI analyzes your concept mastery scores and past mistakes to select high-impact questions directly grounded in your project materials.
              </p>
            </div>

            {/* Question Count Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Question Count
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[3, 5, 10].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setQuestionCount(count)}
                    className={`py-3 px-4 rounded-xl text-sm font-semibold border transition text-center ${
                      questionCount === count
                        ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/20'
                        : 'border-border bg-background hover:bg-accent text-foreground'
                    }`}
                  >
                    {count} Questions
                    <div className="text-[11px] font-normal text-muted-foreground mt-0.5">
                      ~{count * 2} mins
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/50">
                <span className="text-primary font-bold">✓</span>
                <span>Deterministic Multiple Choice</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/50">
                <span className="text-primary font-bold">✓</span>
                <span>LLM Open-ended Reasoning</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/50">
                <span className="text-primary font-bold">✓</span>
                <span>Adaptive Difficulty Scaling</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/50">
                <span className="text-primary font-bold">✓</span>
                <span>Instant Mastery Updates</span>
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleStartQuiz}
              disabled={isStarting}
              className="w-full py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {isStarting ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Generating Adaptive Assessment...
                </>
              ) : (
                <>Launch Adaptive Quiz →</>
              )}
            </button>
          </div>

          {/* Past Attempts Sidebar */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Assessment History
            </h3>

            {pastAttempts.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No past quiz attempts yet. Complete your first quiz to track retention over time!
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {pastAttempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="p-3 rounded-xl border border-border bg-background hover:border-primary/40 transition flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-foreground">
                        {attempt.completedAt
                          ? new Date(attempt.completedAt).toLocaleDateString()
                          : new Date(attempt.startedAt).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Status: <span className="capitalize">{attempt.status.toLowerCase()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {attempt.totalScore !== null ? (
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                            attempt.totalScore >= 70
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          }`}
                        >
                          {attempt.totalScore}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Incomplete</span>
                      )}

                      {attempt.completedAt && (
                        <button
                          onClick={() => handleReviewPastQuiz(attempt.id)}
                          className="px-2 py-1 rounded bg-secondary text-secondary-foreground hover:bg-accent text-[11px]"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2: ACTIVE ASSESSMENT */}
      {mode === 'ACTIVE' && questions.length > 0 && (
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Progress Header */}
          <div className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="font-bold text-foreground">
                Question {currentIndex + 1} of {questions.length}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">
                {questions[currentIndex].type === 'MCQ' ? 'Multiple Choice' : 'Open Response'}
              </span>
              <span className="text-xs text-muted-foreground">
                Difficulty: {questions[currentIndex].difficulty}/5
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-6 h-2 rounded-full cursor-pointer transition-all flex-shrink-0 ${
                    idx === currentIndex
                      ? 'bg-primary w-8'
                      : userAnswers[q.id]?.trim()
                      ? 'bg-primary/40'
                      : 'bg-muted'
                  }`}
                  title={`Question ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Current Question Card */}
          {(() => {
            const currentQ = questions[currentIndex];
            const currentAns = userAnswers[currentQ.id] || '';

            return (
              <div className="p-6 md:p-8 rounded-2xl border border-border bg-card shadow-sm space-y-6">
                {currentQ.concept && (
                  <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Concept: {currentQ.concept.name}
                  </div>
                )}

                <p className="text-base md:text-lg font-medium leading-relaxed text-foreground">
                  {currentQ.prompt}
                </p>

                {/* MCQ Choices */}
                {currentQ.type === 'MCQ' && currentQ.choices && (
                  <div className="space-y-3 pt-2">
                    {currentQ.choices.map((choice) => {
                      const isSelected = currentAns.toLowerCase() === choice.id.toLowerCase();
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => handleSelectChoice(currentQ.id, choice.id)}
                          className={`w-full text-left p-4 rounded-xl border transition flex items-start gap-3.5 ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary'
                              : 'border-border bg-background hover:bg-accent text-foreground'
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {choice.id.toUpperCase()}
                          </span>
                          <span className="text-sm font-normal leading-relaxed">{choice.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Open-Ended Question Textarea */}
                {currentQ.type === 'OPEN' && (
                  <div className="space-y-2 pt-2">
                    <textarea
                      value={currentAns}
                      onChange={(e) => handleAnswerText(currentQ.id, e.target.value)}
                      placeholder="Type your thoughtful explanation here. Be specific and explain the underlying principles..."
                      rows={6}
                      className="w-full p-4 rounded-xl border border-white/20 bg-surface-overlay text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 resize-y shadow-inner"
                    />
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>LLM-evaluated on comprehension, completeness, and clarity</span>
                      <span>{currentAns.trim().split(/\s+/).filter(Boolean).length} words</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Navigation & Submit controls */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-accent disabled:opacity-40 transition"
            >
              ← Previous
            </button>

            <div className="flex items-center gap-3">
              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-accent transition"
                >
                  Next Question →
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleSubmitQuiz}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition shadow-md shadow-primary/20 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Grading Quiz...
                  </>
                ) : (
                  <>Submit Assessment ✓</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODE 3: REVIEW & MASTERY IMPACT */}
      {mode === 'REVIEW' && (
        <div className="space-y-6">
          {/* Score Header Banner */}
          <div className="p-6 md:p-8 rounded-2xl border border-border bg-card shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                Quiz Evaluation Complete
              </span>
              <h2 className="text-2xl md:text-3xl font-bold">
                {finalScore >= 80
                  ? 'Outstanding Performance! 🎉'
                  : finalScore >= 60
                  ? 'Good Progress! Keep Practicing 💪'
                  : 'Needs Focus & Review 📚'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Reviewed {gradedResults.length} questions across your study materials.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-2xl bg-primary/10 border-2 border-primary/30 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-primary">{finalScore}%</span>
                <span className="text-[10px] uppercase font-semibold text-muted-foreground">Overall</span>
              </div>
            </div>
          </div>

          {/* Mastery Deltas Card (if updated in this session) */}
          {masteryDeltas.length > 0 && (
            <div className="p-6 rounded-2xl border border-border bg-card space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Concept Mastery Updates
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {masteryDeltas.map((delta, i) => {
                  const isUp = delta.newScore >= delta.oldScore;
                  return (
                    <div key={i} className="p-3.5 rounded-xl border border-border bg-background space-y-1.5">
                      <div className="text-xs font-semibold text-foreground">
                        Concept Mastery Updated
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {delta.oldScore}% → <strong className="text-foreground">{delta.newScore}%</strong>
                        </span>
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            isUp
                              ? 'text-emerald-500 bg-emerald-500/10'
                              : 'text-amber-500 bg-amber-500/10'
                          }`}
                        >
                          {isUp ? `+${delta.newScore - delta.oldScore}%` : `${delta.newScore - delta.oldScore}%`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detailed Question Review List */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Detailed Question Breakdown
            </h3>

            {gradedResults.map((result, idx) => (
              <div
                key={result.questionId || idx}
                className={`p-6 rounded-2xl border transition space-y-4 bg-card ${
                  result.isCorrect ? 'border-emerald-500/30' : 'border-destructive/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                        result.isCorrect
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {result.isCorrect ? '✓ Correct' : '✕ Needs Work'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Question {idx + 1} ({result.type})
                    </span>
                    {result.concept && (
                      <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground">
                        {result.concept.name}
                      </span>
                    )}
                  </div>

                  <span className="text-sm font-bold text-foreground">
                    Score: {result.score}/100
                  </span>
                </div>

                <p className="text-sm font-medium text-foreground">{result.prompt}</p>

                {/* Learner response */}
                <div className="text-xs p-3 rounded-xl bg-accent/40 space-y-1">
                  <div className="font-semibold text-muted-foreground">Your Answer:</div>
                  <div className="text-foreground">{result.userAnswer || '(Left blank)'}</div>
                </div>

                {/* Explanation / Model Answer */}
                {result.explanation && (
                  <div className="text-xs p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
                    <div className="font-semibold text-primary">Explanation & Key Takeaways:</div>
                    <div className="text-foreground leading-relaxed">{result.explanation}</div>
                  </div>
                )}

                {/* Evaluator Feedback */}
                {result.feedback && (
                  <div className="text-xs text-muted-foreground">
                    <strong className="text-foreground">Feedback:</strong> {result.feedback}
                  </div>
                )}

                {/* Missing Concepts tag */}
                {result.missingConcepts && result.missingConcepts.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <span className="text-amber-500 font-semibold">Missing concepts:</span>
                    {result.missingConcepts.map((c, ci) => (
                      <span key={ci} className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Post-quiz Actions */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setMode('SETUP')}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-accent transition"
            >
              Take Another Quiz
            </button>

            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/projects/${projectId}/tutor`}
                className="px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-accent transition"
              >
                Discuss with AI Tutor →
              </Link>
              <Link
                href={`/dashboard/projects/${projectId}`}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
              >
                Return to Overview
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

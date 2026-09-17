import { describe, it, expect, vi, beforeEach } from 'vitest';

interface ProcessEventState {
  processedEvents: Set<string>;
  masteryScores: Map<string, number>;
}

/**
 * Event processor with strict idempotency key tracking
 */
function processLearningEvent(
  state: ProcessEventState,
  event: { idempotencyKey: string; conceptId: string; delta: number }
): { applied: boolean; currentScore: number } {
  if (state.processedEvents.has(event.idempotencyKey)) {
    // Idempotent no-op: already processed
    return {
      applied: false,
      currentScore: state.masteryScores.get(event.conceptId) || 50,
    };
  }

  // Mark as processed
  state.processedEvents.add(event.idempotencyKey);

  // Apply delta
  const current = state.masteryScores.get(event.conceptId) || 50;
  const newScore = Math.max(0, Math.min(100, current + event.delta));
  state.masteryScores.set(event.conceptId, newScore);

  return { applied: true, currentScore: newScore };
}

describe('Event & Workflow Idempotency', () => {
  let state: ProcessEventState;

  beforeEach(() => {
    state = {
      processedEvents: new Set<string>(),
      masteryScores: new Map<string, number>([['concept-ml', 50]]),
    };
  });

  it('applies score delta on first event delivery', () => {
    const event = {
      idempotencyKey: 'quiz.completed:quiz-attempt-101',
      conceptId: 'concept-ml',
      delta: 15,
    };

    const res = processLearningEvent(state, event);
    expect(res.applied).toBe(true);
    expect(res.currentScore).toBe(65);
    expect(state.masteryScores.get('concept-ml')).toBe(65);
  });

  it('rejects double-application and leaves mastery untouched when identical event fires twice', () => {
    const event = {
      idempotencyKey: 'quiz.completed:quiz-attempt-101',
      conceptId: 'concept-ml',
      delta: 15,
    };

    // First firing (e.g. worker process 1)
    const firstRun = processLearningEvent(state, event);
    expect(firstRun.applied).toBe(true);
    expect(firstRun.currentScore).toBe(65);

    // Second firing (e.g. queue retry / network replay)
    const secondRun = processLearningEvent(state, event);
    expect(secondRun.applied).toBe(false);
    expect(secondRun.currentScore).toBe(65); // not 80!
    expect(state.masteryScores.get('concept-ml')).toBe(65);
  });

  it('processes distinct events for the same concept independently', () => {
    const event1 = {
      idempotencyKey: 'quiz.completed:quiz-attempt-101',
      conceptId: 'concept-ml',
      delta: 10,
    };
    const event2 = {
      idempotencyKey: 'quiz.completed:quiz-attempt-102',
      conceptId: 'concept-ml',
      delta: 10,
    };

    processLearningEvent(state, event1);
    const res2 = processLearningEvent(state, event2);

    expect(res2.applied).toBe(true);
    expect(res2.currentScore).toBe(70);
  });
});

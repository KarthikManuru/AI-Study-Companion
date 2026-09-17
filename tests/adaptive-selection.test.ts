import { describe, it, expect } from 'vitest';

export interface ConceptMasteryCandidate {
  conceptId: string;
  conceptName: string;
  masteryScore: number;
  trend: 'IMPROVING' | 'STABLE' | 'NEEDS_ATTENTION';
}

export interface PastAnswer {
  conceptId: string;
  isCorrect: boolean;
}

/**
 * Adaptive question selection weighting algorithm used in /api/quiz/start
 */
export function calculateConceptWeights(
  masteries: ConceptMasteryCandidate[],
  recentAnswers: PastAnswer[]
) {
  return masteries.map((mastery) => {
    // 1. Base weight inversely proportional to mastery score (0-100)
    let weight = 100 - mastery.masteryScore;

    // 2. Weight boost for recent wrong answers (+10 per mistake)
    const recentWrong = recentAnswers.filter(
      (a) => a.conceptId === mastery.conceptId && !a.isCorrect
    ).length;
    weight += recentWrong * 10;

    // 3. Weight boost for concepts with active NEEDS_ATTENTION trend (+15)
    if (mastery.trend === 'NEEDS_ATTENTION') {
      weight += 15;
    }

    return {
      conceptId: mastery.conceptId,
      conceptName: mastery.conceptName,
      weight,
      masteryScore: mastery.masteryScore,
    };
  }).sort((a, b) => b.weight - a.weight);
}

describe('Adaptive Question Selection Algorithm', () => {
  const mockMasteries: ConceptMasteryCandidate[] = [
    { conceptId: 'c1', conceptName: 'Linear Algebra', masteryScore: 85, trend: 'STABLE' },
    { conceptId: 'c2', conceptName: 'Backpropagation', masteryScore: 30, trend: 'NEEDS_ATTENTION' },
    { conceptId: 'c3', conceptName: 'Loss Functions', masteryScore: 60, trend: 'STABLE' },
    { conceptId: 'c4', conceptName: 'Convolution', masteryScore: 50, trend: 'STABLE' },
  ];

  it('prioritizes low-mastery concepts over high-mastery concepts when no mistakes exist', () => {
    const scored = calculateConceptWeights(mockMasteries, []);

    // Backpropagation (30% + 15 attention = 85 weight) should be #1
    expect(scored[0].conceptId).toBe('c2');
    expect(scored[0].conceptName).toBe('Backpropagation');

    // Linear Algebra (85% -> 15 weight) should be last
    expect(scored[scored.length - 1].conceptId).toBe('c1');
    expect(scored[scored.length - 1].conceptName).toBe('Linear Algebra');
  });

  it('boosts a moderately-mastered concept to top priority if student made repeated recent mistakes', () => {
    // Student made 4 recent mistakes on Convolution (50% base -> 50 weight + 40 mistakes = 90 weight)
    const recentMistakes: PastAnswer[] = [
      { conceptId: 'c4', isCorrect: false },
      { conceptId: 'c4', isCorrect: false },
      { conceptId: 'c4', isCorrect: false },
      { conceptId: 'c4', isCorrect: false },
    ];

    const scored = calculateConceptWeights(mockMasteries, recentMistakes);

    // Convolution should surpass Backpropagation (90 vs 85)
    expect(scored[0].conceptId).toBe('c4');
    expect(scored[0].weight).toBe(90);
  });

  it('correct answers do not artificially inflate selection weight', () => {
    const correctAnswersOnly: PastAnswer[] = [
      { conceptId: 'c1', isCorrect: true },
      { conceptId: 'c1', isCorrect: true },
    ];

    const scored = calculateConceptWeights(mockMasteries, correctAnswersOnly);
    const c1Score = scored.find((s) => s.conceptId === 'c1');

    // Weight remains 100 - 85 = 15
    expect(c1Score?.weight).toBe(15);
  });

  it('correctly selects the top N highest priority concepts', () => {
    const scored = calculateConceptWeights(mockMasteries, []);
    const selected = scored.slice(0, 2);

    expect(selected).toHaveLength(2);
    expect(selected.map((s) => s.conceptId)).toEqual(['c2', 'c4']); // Backprop (85), Conv (50)
  });
});

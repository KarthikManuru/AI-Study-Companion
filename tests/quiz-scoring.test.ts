import { describe, it, expect } from 'vitest';

describe('Quiz & Mastery Scoring Mathematics', () => {
  // Documented formula: newMastery = (currentMastery * 0.7) + (quizScore * 0.3)
  function calculateMasteryUpdate(currentMastery: number, quizScore: number) {
    const raw = currentMastery * 0.7 + quizScore * 0.3;
    const clamped = Math.max(0, Math.min(100, Math.round(raw)));
    let trend: 'IMPROVING' | 'STABLE' | 'NEEDS_ATTENTION' = 'STABLE';

    if (clamped > currentMastery + 4) trend = 'IMPROVING';
    else if (clamped < currentMastery - 4) trend = 'NEEDS_ATTENTION';

    if (clamped < 40) trend = 'NEEDS_ATTENTION';

    return { newScore: clamped, trend };
  }

  describe('Edge Cases & Clamping', () => {
    it('clamps upper bound strictly at 100% even if theoretical score exceeds', () => {
      const { newScore } = calculateMasteryUpdate(100, 110);
      expect(newScore).toBe(100);
    });

    it('clamps lower bound strictly at 0% even if theoretical score is negative', () => {
      const { newScore, trend } = calculateMasteryUpdate(0, -20);
      expect(newScore).toBe(0);
      expect(trend).toBe('NEEDS_ATTENTION');
    });

    it('handles transition from 0 to positive score cleanly', () => {
      const { newScore, trend } = calculateMasteryUpdate(0, 50);
      // 0*0.7 + 50*0.3 = 15
      expect(newScore).toBe(15);
      expect(trend).toBe('NEEDS_ATTENTION'); // still below 40
    });

    it('handles perfect score from perfect mastery', () => {
      const { newScore, trend } = calculateMasteryUpdate(100, 100);
      expect(newScore).toBe(100);
      expect(trend).toBe('STABLE');
    });
  });

  describe('Trend Assignment Boundaries', () => {
    it('sets IMPROVING when delta is strictly greater than +4 points', () => {
      // old = 50, new needs to be >= 55. If quizScore = 70 -> 50*0.7 + 70*0.3 = 35 + 21 = 56 (+6)
      const res = calculateMasteryUpdate(50, 70);
      expect(res.newScore).toBe(56);
      expect(res.trend).toBe('IMPROVING');
    });

    it('sets STABLE when delta is exactly +4 points', () => {
      // old = 60, quiz = 73 -> 60*0.7 + 73*0.3 = 42 + 21.9 = 63.9 -> 64 (+4)
      const res = calculateMasteryUpdate(60, 73);
      expect(res.newScore).toBe(64);
      expect(res.trend).toBe('STABLE');
    });

    it('sets NEEDS_ATTENTION when delta drops by strictly more than 4 points', () => {
      // old = 70, quiz = 50 -> 70*0.7 + 50*0.3 = 49 + 15 = 64 (-6)
      const res = calculateMasteryUpdate(70, 50);
      expect(res.newScore).toBe(64);
      expect(res.trend).toBe('NEEDS_ATTENTION');
    });

    it('overrides trend to NEEDS_ATTENTION whenever final score is below 40% even if delta improved', () => {
      // old = 20, quiz = 50 -> 20*0.7 + 50*0.3 = 14 + 15 = 29 (+9 points, but 29 < 40)
      const res = calculateMasteryUpdate(20, 50);
      expect(res.newScore).toBe(29);
      expect(res.trend).toBe('NEEDS_ATTENTION');
    });
  });

  describe('Deterministic MCQ evaluation', () => {
    it('correctly matches case-insensitive answer IDs and trims spaces', () => {
      const isCorrect = (userAns: string, correctAns: string) =>
        userAns.trim().toLowerCase() === correctAns.trim().toLowerCase();

      expect(isCorrect('a', 'A')).toBe(true);
      expect(isCorrect('B ', 'b')).toBe(true);
      expect(isCorrect(' c ', 'C')).toBe(true);
      expect(isCorrect('C', 'd')).toBe(false);
    });
  });
});

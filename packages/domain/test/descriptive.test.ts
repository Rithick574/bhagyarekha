import { describe, expect, it } from 'vitest';
import { collisionPairs, computeDescriptiveStatistics, digitSum, hasAdjacentEqualDigits, hasConsecutiveRun, hasDuplicateDigits, isOdd } from '../src/index.js';

describe('digit predicates', () => {
  it('digit sums and parity use the final digit; zeros contribute zero', () => {
    expect(digitSum('001234')).toBe(10);
    expect(digitSum('000000')).toBe(0);
    expect(isOdd('001234')).toBe(false);
    expect(isOdd('000001')).toBe(true);
  });
  it('duplicate and adjacent-equal digits', () => {
    expect(hasDuplicateDigits('012345')).toBe(false);
    expect(hasDuplicateDigits('001234')).toBe(true);
    expect(hasAdjacentEqualDigits('010101')).toBe(false);
    expect(hasAdjacentEqualDigits('001234')).toBe(true);
  });
  it('consecutive runs need ≥3 monotone ±1 steps and never wrap 9→0', () => {
    expect(hasConsecutiveRun('001234')).toBe(true); // 1234
    expect(hasConsecutiveRun('987650')).toBe(true); // 9876
    expect(hasConsecutiveRun('121212')).toBe(false); // alternating never reaches 3 in one direction
    expect(hasConsecutiveRun('890123')).toBe(true); // 0123 counts; 9→0 does not
    expect(hasConsecutiveRun('790134')).toBe(false); // 9→0 is not a step; 0,1 is only 2 long; 1→3 breaks
    expect(hasConsecutiveRun('123', 3)).toBe(true);
    expect(hasConsecutiveRun('12', 3)).toBe(false);
  });
  it('collision pairs are c(c−1)/2 per group, not occurrences', () => {
    expect(collisionPairs([1, 1, 1])).toBe(0);
    expect(collisionPairs([2])).toBe(1);
    expect(collisionPairs([3, 2])).toBe(4);
  });
});

describe('computeDescriptiveStatistics (T21/T22)', () => {
  const obs = [
    { series: 'AA', number: '001234' },
    { series: 'AB', number: '001234' }, // same number, different ticket
    { series: 'AC', number: '100200' },
    { series: 'AA', number: '555000' },
    { series: 'AB', number: '045678' },
  ];
  const stats = computeDescriptiveStatistics(obs, 6);

  it('position totals each equal N and count the right digits', () => {
    expect(stats.observationCount).toBe(5);
    for (const row of stats.positionDigitCounts) expect(row.reduce((a, b) => a + b, 0)).toBe(5);
    expect(stats.positionDigitCounts[0]).toEqual([3, 1, 0, 0, 0, 1, 0, 0, 0, 0]); // leading zeros are digits too
    expect(stats.positionDigitCounts[5]?.[4]).toBe(2);
    expect(stats.positionDigitCounts[5]?.[0]).toBe(2);
    expect(stats.positionDigitCounts[5]?.[8]).toBe(1);
  });
  it('suffix counts are strings with historical shares', () => {
    expect(stats.lastTwo.top[0]).toEqual({ key: '00', count: 2, share: 0.4 }); // ties sort by key
    expect(stats.lastTwo.top.map((t) => t.key)).toEqual(['00', '34', '78']);
    expect(stats.lastThree.distinct).toBe(4);
    expect(stats.lastThree.top.find((t) => t.key === '000')?.count).toBe(1);
  });
  it('separates repeated numbers from repeated tickets and counts pairs correctly', () => {
    expect(stats.repeated).toMatchObject({ distinctNumbers: 4, distinctTickets: 5, numberCollisionPairs: 1, ticketCollisionPairs: 0 });
    expect(stats.repeated.repeatedNumbers).toEqual([{ key: '001234', count: 2, share: 0.4 }]);
  });
  it('parity, digit sums and in-number patterns', () => {
    expect(stats.parity).toEqual({ odd: 0, even: 5, oddShare: 0 });
    expect(stats.digitSum.min).toBe(3); // 100200
    expect(stats.digitSum.max).toBe(30); // 045678
    expect(stats.digitSum.distribution.map((d) => d.key)).toEqual(['3', '10', '15', '30']);
    expect(stats.digitSum.distribution.find((d) => d.key === '10')?.count).toBe(2);
    expect(stats.duplicateDigits.count).toBe(4); // all but 045678
    expect(stats.adjacentEqualDigits.count).toBe(4);
    expect(stats.consecutiveRuns.count).toBe(3); // 001234 ×2, 045678
    expect(stats.consecutiveRuns.share).toBeCloseTo(0.6);
  });
  it('empty sample: zero counts and null shares, never 0 %', () => {
    const empty = computeDescriptiveStatistics([], 6);
    expect(empty.observationCount).toBe(0);
    expect(empty.parity.oddShare).toBeNull();
    expect(empty.duplicateDigits.share).toBeNull();
    expect(empty.digitSum).toEqual({ min: null, max: null, mean: null, distribution: [] });
    expect(empty.positionDigitCounts).toHaveLength(6);
    expect(empty.positionDigitCounts.every((row) => row.every((c) => c === 0))).toBe(true);
  });
  it('refuses to mix number domains silently', () => {
    expect(() => computeDescriptiveStatistics([{ series: 'SB', number: '0123456' }], 6)).toThrow(/number length/);
  });
});

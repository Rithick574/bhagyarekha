/**
 * Descriptive statistics over fixed-length digit strings (LLD §8.2).
 * Pure, deterministic, and explicit about denominators. Nothing here is a
 * probability of anything future.
 */

export interface Observation {
  /** Fixed-length ASCII digit string. */
  number: string;
  /** '' when the category has no series. */
  series: string;
}

export interface CountShare {
  key: string;
  count: number;
  /** count / N, or null when N = 0. */
  share: number | null;
}

export interface DescriptiveStatistics {
  observationCount: number;
  numberLength: number;
  positionDigitCounts: number[][];
  lastTwo: { distinct: number; top: CountShare[] };
  lastThree: { distinct: number; top: CountShare[] };
  repeated: { distinctNumbers: number; distinctTickets: number; numberCollisionPairs: number; ticketCollisionPairs: number; repeatedNumbers: CountShare[] };
  parity: { odd: number; even: number; oddShare: number | null };
  digitSum: { min: number | null; max: number | null; mean: number | null; distribution: CountShare[] };
  duplicateDigits: { count: number; share: number | null };
  adjacentEqualDigits: { count: number; share: number | null };
  consecutiveRuns: { count: number; share: number | null };
}

const TOP_LIMIT = 50;

function share(count: number, n: number): number | null {
  return n === 0 ? null : count / n;
}

function tally(keys: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return counts;
}

function sortedCounts(counts: Map<string, number>, n: number, limit = TOP_LIMIT, minCount = 1): CountShare[] {
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count, share: share(count, n) }));
}

/** Pairs of observations sharing a key: Σ c(c−1)/2. Occurrences are not pairs. */
export function collisionPairs(counts: Iterable<number>): number {
  let pairs = 0;
  for (const c of counts) pairs += (c * (c - 1)) / 2;
  return pairs;
}

export function digitSum(number: string): number {
  let sum = 0;
  for (const ch of number) sum += ch.charCodeAt(0) - 48;
  return sum;
}

export function hasDuplicateDigits(number: string): boolean {
  return new Set(number).size < number.length;
}

export function hasAdjacentEqualDigits(number: string): boolean {
  for (let i = 1; i < number.length; i += 1) if (number[i] === number[i - 1]) return true;
  return false;
}

/**
 * True when the number contains a run of at least `minLength` adjacent digits
 * stepping +1 or −1 consistently (e.g. 345, 876). 9→0 and 0→9 are not steps.
 */
export function hasConsecutiveRun(number: string, minLength = 3): boolean {
  if (number.length < minLength) return false;
  let run = 1;
  let direction = 0;
  for (let i = 1; i < number.length; i += 1) {
    const step = (number.charCodeAt(i) - 48) - (number.charCodeAt(i - 1) - 48);
    if ((step === 1 || step === -1) && (direction === 0 || direction === step)) {
      run += 1;
      direction = step;
    } else if (step === 1 || step === -1) {
      run = 2;
      direction = step;
    } else {
      run = 1;
      direction = 0;
    }
    if (run >= minLength) return true;
  }
  return false;
}

export function isOdd(number: string): boolean {
  return (number.charCodeAt(number.length - 1) - 48) % 2 === 1;
}

/**
 * Computes every metric over observations that all share `numberLength`.
 * Callers must have selected eligible observations already (current, active,
 * complete, reviewed, compatible rule domain). Throws on a length mismatch
 * rather than silently mixing domains.
 */
export function computeDescriptiveStatistics(observations: readonly Observation[], numberLength: number): DescriptiveStatistics {
  const n = observations.length;
  for (const o of observations) {
    if (o.number.length !== numberLength || !/^[0-9]+$/.test(o.number)) throw new Error(`Observation ${JSON.stringify(o.number)} does not match number length ${numberLength}`);
  }
  const numbers = observations.map((o) => o.number);

  const positionDigitCounts: number[][] = Array.from({ length: numberLength }, () => Array.from({ length: 10 }, () => 0));
  for (const num of numbers) {
    for (let p = 0; p < numberLength; p += 1) {
      const digit = num.charCodeAt(p) - 48;
      (positionDigitCounts[p] as number[])[digit] = ((positionDigitCounts[p] as number[])[digit] as number) + 1;
    }
  }

  const lastTwoCounts = numberLength >= 2 ? tally(numbers.map((x) => x.slice(-2))) : new Map<string, number>();
  const lastThreeCounts = numberLength >= 3 ? tally(numbers.map((x) => x.slice(-3))) : new Map<string, number>();
  const numberCounts = tally(numbers);
  const ticketCounts = tally(observations.map((o) => `${o.series}|${o.number}`));
  const sums = numbers.map(digitSum);
  const sumCounts = tally(sums.map(String));

  const odd = numbers.filter(isOdd).length;
  const duplicate = numbers.filter(hasDuplicateDigits).length;
  const adjacent = numbers.filter(hasAdjacentEqualDigits).length;
  const runs = numbers.filter((x) => hasConsecutiveRun(x)).length;

  return {
    observationCount: n,
    numberLength,
    positionDigitCounts,
    lastTwo: { distinct: lastTwoCounts.size, top: sortedCounts(lastTwoCounts, n) },
    lastThree: { distinct: lastThreeCounts.size, top: sortedCounts(lastThreeCounts, n) },
    repeated: {
      distinctNumbers: numberCounts.size,
      distinctTickets: ticketCounts.size,
      numberCollisionPairs: collisionPairs(numberCounts.values()),
      ticketCollisionPairs: collisionPairs(ticketCounts.values()),
      repeatedNumbers: sortedCounts(numberCounts, n, TOP_LIMIT, 2),
    },
    parity: { odd, even: n - odd, oddShare: share(odd, n) },
    digitSum: {
      min: n ? Math.min(...sums) : null,
      max: n ? Math.max(...sums) : null,
      mean: n ? sums.reduce((a, b) => a + b, 0) / n : null,
      distribution: [...sumCounts.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([key, count]) => ({ key, count, share: share(count, n) })),
    },
    duplicateDigits: { count: duplicate, share: share(duplicate, n) },
    adjacentEqualDigits: { count: adjacent, share: share(adjacent, n) },
    consecutiveRuns: { count: runs, share: share(runs, n) },
  };
}

import { describe, expect, it } from 'vitest';
import {
  addDays,
  barPercent,
  buildQuery,
  defaultStatisticsWindow,
  formatCount,
  formatDecimal,
  formatShare,
  inclusiveSpanDays,
  isLocalDate,
  istToday,
  parseDrawCodeParam,
  parseLocalDateParam,
  parsePageParam,
  parseUuidParam,
  rangeProblem,
  totalPages,
} from './history-stats';

describe('IST calendar helpers', () => {
  it('istToday uses the Asia/Kolkata calendar day, not UTC', () => {
    // 18:30 UTC is midnight IST: the IST date has already rolled over.
    expect(istToday(new Date('2026-09-24T18:30:00.000Z'))).toBe('2026-09-25');
    expect(istToday(new Date('2026-09-24T18:29:59.000Z'))).toBe('2026-09-24');
    expect(istToday(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01-01');
    expect(istToday(new Date('2025-12-31T19:00:00.000Z'))).toBe('2026-01-01');
  });

  it('defaultStatisticsWindow covers exactly 366 inclusive days ending today', () => {
    const window = defaultStatisticsWindow('2026-09-25');
    expect(window).toEqual({ from: '2025-09-25', to: '2026-09-25' });
    expect(inclusiveSpanDays(window.from, window.to)).toBe(366);
    // Leap day inside the window still yields 366 days.
    const leap = defaultStatisticsWindow('2028-03-01');
    expect(inclusiveSpanDays(leap.from, leap.to)).toBe(366);
    expect(leap.from).toBe('2027-03-02');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
  });

  it('rangeProblem mirrors the API limits', () => {
    expect(rangeProblem('2026-09-01', '2026-09-30')).toBeNull();
    expect(rangeProblem(undefined, '2026-09-30')).toBeNull();
    expect(rangeProblem('2026-09-30', '2026-09-01')).toBe('FROM_AFTER_TO');
    expect(rangeProblem('2025-09-25', '2026-09-25')).toBeNull();
    expect(rangeProblem('2025-09-24', '2026-09-25')).toBe('RANGE_TOO_LONG');
  });
});

describe('URL parameter validation', () => {
  it('accepts only real calendar dates', () => {
    expect(isLocalDate('2026-09-24')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2024-02-29')).toBe(true);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-9-4')).toBe(false);
    expect(isLocalDate(undefined)).toBe(false);
    expect(parseLocalDateParam('24/09/2026')).toBeUndefined();
    expect(parseLocalDateParam('2026-09-24')).toBe('2026-09-24');
  });

  it('accepts only UUIDs for the lottery and rule parameters', () => {
    expect(parseUuidParam('A0000001-0000-4000-8000-000000000001')).toBe('a0000001-0000-4000-8000-000000000001');
    expect(parseUuidParam('nila')).toBeUndefined();
    expect(parseUuidParam(undefined)).toBeUndefined();
  });

  it('accepts draw codes within the contract pattern only', () => {
    expect(parseDrawCodeParam(' TH-037 ')).toBe('TH-037');
    expect(parseDrawCodeParam('SB-2026.01_x')).toBe('SB-2026.01_x');
    expect(parseDrawCodeParam('TH 037')).toBeUndefined();
    expect(parseDrawCodeParam('x'.repeat(33))).toBeUndefined();
    expect(parseDrawCodeParam('')).toBeUndefined();
  });

  it('falls back to page 1 for anything that is not a positive integer', () => {
    expect(parsePageParam('3')).toBe(3);
    expect(parsePageParam('0')).toBe(1);
    expect(parsePageParam('-2')).toBe(1);
    expect(parsePageParam('abc')).toBe(1);
    expect(parsePageParam(undefined)).toBe(1);
  });

  it('buildQuery skips empty values and encodes the rest', () => {
    expect(buildQuery({ lottery: 'abc', from: '', to: undefined, page: 2 })).toBe('?lottery=abc&page=2');
    expect(buildQuery({})).toBe('');
  });

  it('totalPages never returns zero', () => {
    expect(totalPages(0, 20)).toBe(1);
    expect(totalPages(21, 20)).toBe(2);
    expect(totalPages(40, 20)).toBe(2);
  });
});

describe('share and count formatting', () => {
  it('renders null shares as an em dash and never as 0%', () => {
    expect(formatShare(null, 'en')).toBe('—');
    expect(formatShare(undefined, 'en')).toBe('—');
    expect(formatShare(Number.NaN, 'en')).toBe('—');
  });
  it('renders shares as one-decimal percentages', () => {
    expect(formatShare(1 / 3, 'en')).toBe('33.3%');
    expect(formatShare(1, 'en')).toBe('100.0%');
    expect(formatShare(0, 'en')).toBe('0.0%');
  });
  it('formats counts and decimals', () => {
    expect(formatCount(1234567, 'en')).toBe('12,34,567');
    expect(formatDecimal(27.25, 'en')).toBe('27.3');
    expect(formatDecimal(null, 'en')).toBe('—');
  });
  it('bar percentages are bounded and safe for an empty sample', () => {
    expect(barPercent(0, 0)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
    expect(barPercent(2, 4)).toBe(50);
    expect(barPercent(4, 4)).toBe(100);
  });
});

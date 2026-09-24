import { describe, expect, it } from 'vitest';
import { DigitStringSchema, DrawListQuerySchema, LocalDateSchema, ResultQuerySchema, SeriesSchema, isValidLocalDate } from '../src/index.js';

describe('LocalDateSchema', () => {
  it('accepts real calendar dates', () => {
    expect(LocalDateSchema.parse('2026-09-24')).toBe('2026-09-24');
    expect(LocalDateSchema.parse('2028-02-29')).toBe('2028-02-29');
  });
  it('rejects impossible dates and other formats', () => {
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('2027-02-29')).toBe(false);
    expect(LocalDateSchema.safeParse('24-09-2026').success).toBe(false);
    expect(LocalDateSchema.safeParse('2026-9-4').success).toBe(false);
    expect(LocalDateSchema.safeParse('2026-09-24T00:00:00Z').success).toBe(false);
  });
});

describe('DigitStringSchema', () => {
  it('preserves leading zeros as a string', () => {
    const parsed = DigitStringSchema.parse('001234');
    expect(parsed).toBe('001234');
    expect(typeof parsed).toBe('string');
  });
  it('rejects non-ASCII digits, separators and whitespace', () => {
    for (const bad of ['12 34', '12-34', '१२३४', '', ' 1234', '1234567890123']) {
      expect(DigitStringSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('SeriesSchema', () => {
  it('accepts the empty sentinel and upper-case letters only', () => {
    expect(SeriesSchema.parse('')).toBe('');
    expect(SeriesSchema.parse('AB')).toBe('AB');
    expect(SeriesSchema.safeParse('ab').success).toBe(false);
    expect(SeriesSchema.safeParse('A1').success).toBe(false);
  });
});

describe('query schemas', () => {
  it('applies bounded pagination defaults from string input', () => {
    const q = DrawListQuerySchema.parse({});
    expect(q).toEqual({ page: 1, pageSize: 20 });
    expect(DrawListQuerySchema.parse({ page: '3', pageSize: '100' })).toMatchObject({ page: 3, pageSize: 100 });
    expect(DrawListQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    expect(DrawListQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
  it('rejects unknown keys and inverted ranges', () => {
    expect(DrawListQuerySchema.safeParse({ foo: 'bar' }).success).toBe(false);
    expect(DrawListQuerySchema.safeParse({ from: '2026-09-24', to: '2026-09-01' }).success).toBe(false);
    expect(DrawListQuerySchema.safeParse({ from: '2026-09-01', to: '2026-09-24' }).success).toBe(true);
  });
  it('validates result query', () => {
    expect(ResultQuerySchema.parse({ categoryCode: 'FIRST' })).toMatchObject({ categoryCode: 'FIRST', page: 1, pageSize: 20 });
    expect(ResultQuerySchema.safeParse({ categoryCode: 'first prize' }).success).toBe(false);
    expect(ResultQuerySchema.safeParse({ revisionId: 'not-a-uuid' }).success).toBe(false);
  });
});

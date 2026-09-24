import { describe, expect, it } from 'vitest';
import { istLocalToUtcIso, minorToRupeesInput, parseEntryLines, rupeesToMinor, utcIsoToIstDate, utcIsoToIstLocal } from './admin-time';

describe('IST ↔ UTC helpers', () => {
  it('converts an IST wall-clock time to UTC and back', () => {
    expect(istLocalToUtcIso('2026-10-08T15:00')).toBe('2026-10-08T09:30:00.000Z');
    expect(utcIsoToIstLocal('2026-10-08T09:30:00.000Z')).toBe('2026-10-08T15:00');
  });
  it('crosses midnight correctly (IST date differs from UTC date)', () => {
    expect(istLocalToUtcIso('2026-10-09T02:00')).toBe('2026-10-08T20:30:00.000Z');
    expect(utcIsoToIstDate('2026-10-08T20:30:00.000Z')).toBe('2026-10-09');
  });
  it('rejects malformed or impossible values', () => {
    expect(istLocalToUtcIso('2026-02-30T10:00')).toBeNull();
    expect(istLocalToUtcIso('10:00')).toBeNull();
    expect(utcIsoToIstLocal('not-a-date')).toBeNull();
  });
});

describe('rupeesToMinor / minorToRupeesInput', () => {
  it('converts Indian-formatted rupees to paise strings without floating point', () => {
    expect(rupeesToMinor('1,00,000')).toBe('10000000');
    expect(rupeesToMinor('₹ 5,000')).toBe('500000');
    expect(rupeesToMinor('1000.5')).toBe('100050');
    expect(rupeesToMinor('0.05')).toBe('5');
    expect(rupeesToMinor('0')).toBe('0');
  });
  it('rejects non-amounts', () => {
    expect(rupeesToMinor('abc')).toBeNull();
    expect(rupeesToMinor('1.234')).toBeNull();
    expect(rupeesToMinor('-5')).toBeNull();
  });
  it('round-trips for input fields', () => {
    expect(minorToRupeesInput('10000000')).toBe('100000');
    expect(minorToRupeesInput('100050')).toBe('1000.50');
    expect(minorToRupeesInput(null)).toBe('');
  });
});

describe('parseEntryLines', () => {
  it('keeps leading zeros and upper-cases the series', () => {
    expect(parseEntryLines('ac 000322\n0321\n\n  7777 ')).toEqual({ entries: [{ series: 'AC', number: '000322' }, { series: '', number: '0321' }, { series: '', number: '7777' }], badLines: [] });
  });
  it('reports unparseable lines by 1-based number instead of cleaning them', () => {
    expect(parseEntryLines('AC 00-0322\nAC 1234\nX Y Z').badLines).toEqual([1, 3]);
  });
});

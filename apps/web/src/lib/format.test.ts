import { describe, expect, it } from 'vitest';
import { formatInstant, formatLocalDate, formatLocalDateShort, formatMinorAmount, formatTicket, spokenDigits } from './format';

describe('formatLocalDate', () => {
  it('formats explicit long dates without UTC drift', () => {
    expect(formatLocalDate('2026-09-24', 'en')).toBe('24 September 2026');
    expect(formatLocalDate('2026-01-01', 'en')).toBe('1 January 2026');
    expect(formatLocalDate('2026-12-31', 'en')).toBe('31 December 2026');
  });
  it('formats Malayalam dates with the right day number', () => {
    const ml = formatLocalDate('2026-09-24', 'ml');
    expect(ml).toContain('24');
    expect(ml).toContain('2026');
  });
  it('returns malformed input unchanged rather than guessing', () => {
    expect(formatLocalDate('not-a-date', 'en')).toBe('not-a-date');
  });
  it('short form keeps the day', () => {
    expect(formatLocalDateShort('2026-09-24', 'en')).toMatch(/24 Sep(t)? 2026/);
  });
});

describe('formatInstant', () => {
  it('renders in Asia/Kolkata with an explicit date', () => {
    // 2026-09-24T18:30:00Z is 2026-09-25 00:00 IST
    const out = formatInstant('2026-09-24T18:30:00.000Z', 'en');
    expect(out).toContain('25 September 2026');
    expect(out).toContain('IST');
    expect(out.toLowerCase()).toContain('12:00');
  });
});

describe('formatMinorAmount', () => {
  it('formats paise into rupees with Indian grouping', () => {
    expect(formatMinorAmount('10000000000', 'en')).toBe('₹10,00,00,000');
    expect(formatMinorAmount('500000', 'en')).toBe('₹5,000');
    expect(formatMinorAmount('123', 'en')).toBe('₹1.23');
    expect(formatMinorAmount('5', 'en')).toBe('₹0.05');
  });
});

describe('ticket rendering', () => {
  it('preserves leading zeros and series', () => {
    expect(formatTicket('AB', '001234')).toBe('AB 001234');
    expect(formatTicket('', '0042')).toBe('0042');
    expect(spokenDigits('001234')).toBe('0 0 1 2 3 4');
  });
});

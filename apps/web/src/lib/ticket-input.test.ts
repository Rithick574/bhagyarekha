import { describe, expect, it } from 'vitest';
import { normalizeTicketInput, validateTicketInput } from './ticket-input';

const format = { numberLength: 6, allowedSeries: ['AA', 'AB', 'AC'] };

describe('normalizeTicketInput', () => {
  it('trims outer whitespace and upper-cases the series only', () => {
    expect(normalizeTicketInput({ series: ' ab ', number: ' 001234 ' })).toEqual({ series: 'AB', number: '001234' });
  });
  it('never strips internal characters or pads', () => {
    expect(normalizeTicketInput({ series: 'a b', number: '12 34' })).toEqual({ series: 'A B', number: '12 34' });
    expect(normalizeTicketInput({ series: 'AA', number: '1234' }).number).toBe('1234');
  });
});

describe('validateTicketInput', () => {
  it('accepts a well-formed ticket and preserves leading zeros', () => {
    const result = validateTicketInput({ series: 'aa', number: '001234' }, format);
    expect(result).toEqual({ ok: true, value: { series: 'AA', number: '001234' } });
  });
  it('rejects wrong length without padding or truncating', () => {
    expect(validateTicketInput({ series: 'AA', number: '1234' }, format)).toEqual({ ok: false, errors: [{ path: 'number', code: 'WRONG_LENGTH' }] });
    expect(validateTicketInput({ series: 'AA', number: '0001234' }, format)).toEqual({ ok: false, errors: [{ path: 'number', code: 'WRONG_LENGTH' }] });
  });
  it('rejects non-ASCII digits, internal spaces and separators', () => {
    expect(validateTicketInput({ series: 'AA', number: '00 1234' }, format)).toEqual({ ok: false, errors: [{ path: 'number', code: 'INTERNAL_WHITESPACE' }] });
    expect(validateTicketInput({ series: 'AA', number: '00-1234' }, format)).toEqual({ ok: false, errors: [{ path: 'number', code: 'DIGITS_REQUIRED' }] });
    expect(validateTicketInput({ series: 'AA', number: '൦൦൧൨൩൪' }, format)).toEqual({ ok: false, errors: [{ path: 'number', code: 'DIGITS_REQUIRED' }] });
    expect(validateTicketInput({ series: 'AA', number: '' }, format)).toEqual({ ok: false, errors: [{ path: 'number', code: 'EMPTY' }] });
  });
  it('validates the series against the allowed set when known', () => {
    expect(validateTicketInput({ series: 'ZZ', number: '001234' }, format)).toEqual({ ok: false, errors: [{ path: 'series', code: 'SERIES_NOT_ALLOWED' }] });
    expect(validateTicketInput({ series: '', number: '001234' }, format)).toEqual({ ok: false, errors: [{ path: 'series', code: 'SERIES_REQUIRED' }] });
    expect(validateTicketInput({ series: 'AA', number: '001234' }, { numberLength: 6, allowedSeries: [] })).toEqual({ ok: false, errors: [{ path: 'series', code: 'SERIES_NOT_ALLOWED' }] });
  });
  it('falls back to syntax-only checks when the format is unknown', () => {
    expect(validateTicketInput({ series: 'ab', number: '001234' }, null)).toEqual({ ok: true, value: { series: 'AB', number: '001234' } });
    expect(validateTicketInput({ series: 'A1', number: '001234' }, null)).toEqual({ ok: false, errors: [{ path: 'series', code: 'LETTERS_REQUIRED' }] });
    expect(validateTicketInput({ series: 'ABCDEFGHI', number: '001234' }, null)).toEqual({ ok: false, errors: [{ path: 'series', code: 'TOO_LONG' }] });
    expect(validateTicketInput({ series: 'AA', number: '1'.repeat(13) }, null)).toEqual({ ok: false, errors: [{ path: 'number', code: 'TOO_LONG' }] });
  });
  it('reports both fields when both are wrong', () => {
    const result = validateTicketInput({ series: 'ZZ', number: '12' }, format);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.path)).toEqual(['series', 'number']);
  });
});

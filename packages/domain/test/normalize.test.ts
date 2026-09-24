import { describe, expect, it } from 'vitest';
import { normalizeTicketInput } from '../src/index.js';

describe('normalizeTicketInput (T01/T02/T20)', () => {
  it('trims outer whitespace and upper-cases the series, nothing else', () => {
    expect(normalizeTicketInput({ series: '  ab ', number: ' 001234\t' })).toEqual({ ok: true, ticket: { series: 'AB', number: '001234' } });
  });
  it('preserves leading zeros and never coerces to a number', () => {
    const r = normalizeTicketInput({ series: 'AA', number: '000000' });
    expect(r.ok && r.ticket.number).toBe('000000');
  });
  it('allows an empty series (rules without series) but never an empty number', () => {
    expect(normalizeTicketInput({ series: '', number: '1234' })).toEqual({ ok: true, ticket: { series: '', number: '1234' } });
    expect(normalizeTicketInput({ series: 'AA', number: '   ' })).toEqual({ ok: false, errors: [{ path: 'number', code: 'EMPTY' }] });
  });
  it('rejects internal whitespace, separators, non-ASCII digits and digits in the series', () => {
    expect(normalizeTicketInput({ series: 'AA', number: '00 1234' })).toEqual({ ok: false, errors: [{ path: 'number', code: 'INTERNAL_WHITESPACE' }] });
    expect(normalizeTicketInput({ series: 'AA', number: '00-1234' })).toEqual({ ok: false, errors: [{ path: 'number', code: 'DIGITS_REQUIRED' }] });
    expect(normalizeTicketInput({ series: 'AA', number: '००१२३४' })).toEqual({ ok: false, errors: [{ path: 'number', code: 'DIGITS_REQUIRED' }] });
    expect(normalizeTicketInput({ series: 'A1', number: '001234' })).toEqual({ ok: false, errors: [{ path: 'series', code: 'LETTERS_REQUIRED' }] });
    expect(normalizeTicketInput({ series: 'A B', number: '001234' })).toEqual({ ok: false, errors: [{ path: 'series', code: 'INTERNAL_WHITESPACE' }] });
  });
  it('bounds lengths without truncating', () => {
    expect(normalizeTicketInput({ series: 'ABCDEFGHI', number: '1' })).toEqual({ ok: false, errors: [{ path: 'series', code: 'TOO_LONG' }] });
    expect(normalizeTicketInput({ series: 'AA', number: '1234567890123' })).toEqual({ ok: false, errors: [{ path: 'number', code: 'TOO_LONG' }] });
  });
  it('reports both fields when both are wrong', () => {
    const r = normalizeTicketInput({ series: '12', number: 'abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => e.path).sort()).toEqual(['number', 'series']);
  });
});

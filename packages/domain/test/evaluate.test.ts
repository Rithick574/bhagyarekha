import { describe, expect, it } from 'vitest';
import type { RuleSetV1 } from '@bhagyarekha/contracts';
import { candidateNumbers, compileRuleSet, evaluateTicket, validateTicketDomain, type CompiledRuleSet, type ResultSnapshot, type SnapshotCategory } from '../src/index.js';

const ruleSet: RuleSetV1 = {
  schemaVersion: 1,
  engineVersion: 'v1',
  lotteryCode: 'DEMO',
  ruleVersion: 1,
  numberLength: 6,
  allowedFirstDigits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  allowedSeries: ['AA', 'AB', 'AC'],
  awardPolicy: 'SINGLE_BY_PRIORITY',
  categories: [
    { code: 'FIRST', labels: { en: 'First prize', ml: 'ഒന്നാം സമ്മാനം' }, metricRole: 'FIRST_PRIZE', priority: 1, match: { kind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY' }, excludedBy: [], expectedEntryCount: 1 },
    { code: 'CONSOLATION', labels: { en: 'Consolation', ml: 'സമാശ്വാസം' }, metricRole: 'OTHER', priority: 2, match: { kind: 'FULL_NUMBER', seriesPolicy: 'EXCEPT_ENTRY' }, excludedBy: ['FIRST'], expectedEntryCount: 1 },
    { code: 'LAST4', labels: { en: 'Last four', ml: 'അവസാന നാല്' }, metricRole: 'OTHER', priority: 3, match: { kind: 'SUFFIX', seriesPolicy: 'ANY_ALLOWED', suffixLength: 4 }, excludedBy: ['FIRST', 'CONSOLATION'], expectedEntryCount: null },
  ],
};
const compiled = (() => {
  const r = compileRuleSet(ruleSet);
  if (!r.ok) throw new Error('fixture rule set must compile');
  return r.compiled;
})() as CompiledRuleSet;

function cat(code: string, entries: SnapshotCategory['entries'], state: SnapshotCategory['state'] = 'COMPLETE', amountMinor: string | null = '100000'): SnapshotCategory {
  return { code, state, amountMinor, entries };
}
const complete: ResultSnapshot = {
  completeness: 'COMPLETE',
  categories: [cat('FIRST', [{ series: 'AA', number: '001234' }], 'COMPLETE', '10000000'), cat('CONSOLATION', [{ series: 'AA', number: '001234' }], 'COMPLETE', '500000'), cat('LAST4', [{ series: '', number: '1234' }, { series: '', number: '0042' }], 'COMPLETE', '100000')],
};
const t = (series: string, number: string) => ({ series, number });

describe('validateTicketDomain (T04/T20)', () => {
  it('rejects unknown series before any matching, including for EXCEPT_ENTRY', () => {
    expect(validateTicketDomain(compiled, t('ZZ', '001234'))).toEqual({ ok: false, errors: [{ path: 'series', code: 'SERIES_NOT_ALLOWED' }] });
    expect(validateTicketDomain(compiled, t('', '001234'))).toEqual({ ok: false, errors: [{ path: 'series', code: 'SERIES_REQUIRED' }] });
  });
  it('rejects wrong lengths without padding or truncating', () => {
    expect(validateTicketDomain(compiled, t('AA', '1234'))).toEqual({ ok: false, errors: [{ path: 'number', code: 'WRONG_LENGTH' }] });
    expect(validateTicketDomain(compiled, t('AA', '0001234'))).toEqual({ ok: false, errors: [{ path: 'number', code: 'WRONG_LENGTH' }] });
  });
  it('rejects a disallowed first digit', () => {
    const r = compileRuleSet({ ...ruleSet, allowedFirstDigits: ['1', '2'] });
    if (!r.ok) throw new Error();
    expect(validateTicketDomain(r.compiled, t('AA', '001234'))).toEqual({ ok: false, errors: [{ path: 'number', code: 'FIRST_DIGIT_NOT_ALLOWED' }] });
  });
  it('accepts a valid ticket', () => {
    expect(validateTicketDomain(compiled, t('AB', '001234'))).toEqual({ ok: true });
  });
});

describe('evaluateTicket — complete synthetic draw (LLD §4.3, T03/T05)', () => {
  const run = (series: string, number: string) => {
    const r = evaluateTicket(compiled, complete, t(series, number));
    if (!r.ok) throw new Error(r.integrity);
    return r.evaluation;
  };
  it('AA/001234 → MATCH FIRST only; the suffix is not also awarded and amounts are not summed', () => {
    const e = run('AA', '001234');
    expect(e.outcome).toBe('MATCH');
    expect(e.matches).toEqual([{ categoryCode: 'FIRST', awardConfirmed: true, amountMinor: '10000000' }]);
    expect(e.rawMatchCategoryCodes).toEqual(['FIRST', 'LAST4']);
    expect(e.unresolvedCategoryCodes).toEqual([]);
  });
  it('AB/001234 → MATCH CONSOLATION under EXCEPT_ENTRY (LAST4 raw match excluded)', () => {
    const e = run('AB', '001234');
    expect(e.matches).toEqual([{ categoryCode: 'CONSOLATION', awardConfirmed: true, amountMinor: '500000' }]);
    expect(e.rawMatchCategoryCodes).toEqual(['CONSOLATION', 'LAST4']);
  });
  it('AB/991234 → MATCH LAST4', () => {
    expect(run('AB', '991234').matches).toEqual([{ categoryCode: 'LAST4', awardConfirmed: true, amountMinor: '100000' }]);
  });
  it('AA/990042 → MATCH LAST4 with a leading-zero suffix; AA/999942 does not (suffix compares full fixed length)', () => {
    expect(run('AA', '990042').outcome).toBe('MATCH');
    expect(run('AA', '999942').outcome).toBe('NO_MATCH');
  });
  it('AB/994321 → NO_MATCH only because every category is complete', () => {
    const e = run('AB', '994321');
    expect(e.outcome).toBe('NO_MATCH');
    expect(e.matches).toEqual([]);
    expect(e.checkedCategoryCodes).toEqual(['FIRST', 'CONSOLATION', 'LAST4']);
  });
  it('a full-number entry never matches as a suffix and vice versa', () => {
    const snapshot: ResultSnapshot = { ...complete, categories: [cat('FIRST', [{ series: 'AA', number: '001234' }]), cat('CONSOLATION', []), cat('LAST4', [{ series: '', number: '001234' }])] };
    const r = evaluateTicket(compiled, snapshot, t('AB', '001234'));
    expect(r.ok && r.evaluation.rawMatchCategoryCodes).toEqual([]); // LAST4 entry has the wrong length for a 4-digit suffix; FIRST needs AA
  });
});

describe('evaluateTicket — incomplete data (T06/T07, INV-08/09)', () => {
  const partial = (overrides: Partial<Record<'FIRST' | 'CONSOLATION' | 'LAST4', SnapshotCategory>>): ResultSnapshot => ({
    completeness: 'PARTIAL',
    categories: [
      overrides.FIRST ?? cat('FIRST', [{ series: 'AA', number: '001234' }], 'COMPLETE', '10000000'),
      overrides.CONSOLATION ?? cat('CONSOLATION', [{ series: 'AA', number: '001234' }], 'COMPLETE', '500000'),
      overrides.LAST4 ?? cat('LAST4', [{ series: '', number: '1234' }], 'COMPLETE', '100000'),
    ],
  });
  it('AB/991234 with FIRST missing → PARTIAL_MATCH, award unresolved, amount null', () => {
    const r = evaluateTicket(compiled, partial({ FIRST: cat('FIRST', [], 'MISSING', null) }), t('AB', '991234'));
    expect(r.ok && r.evaluation).toMatchObject({ outcome: 'PARTIAL_MATCH', matches: [{ categoryCode: 'LAST4', awardConfirmed: false, amountMinor: null }], unresolvedCategoryCodes: ['FIRST'], checkedCategoryCodes: ['CONSOLATION', 'LAST4'] });
  });
  it('AB/994321 with any category incomplete → RESULT_INCOMPLETE, never NO_MATCH', () => {
    for (const snapshot of [partial({ FIRST: cat('FIRST', [], 'MISSING', null) }), partial({ LAST4: cat('LAST4', [{ series: '', number: '1234' }], 'PARTIAL') }), partial({ CONSOLATION: cat('CONSOLATION', [], 'MISSING', null) })]) {
      const r = evaluateTicket(compiled, snapshot, t('AB', '994321'));
      expect(r.ok && r.evaluation.outcome).toBe('RESULT_INCOMPLETE');
      expect(r.ok && r.evaluation.matches).toEqual([]);
    }
  });
  it('a confirmed FIRST match in partial data stays provisional (a correction could still change it)', () => {
    const r = evaluateTicket(compiled, partial({ LAST4: cat('LAST4', [], 'MISSING', null) }), t('AA', '001234'));
    expect(r.ok && r.evaluation).toMatchObject({ outcome: 'PARTIAL_MATCH', matches: [{ categoryCode: 'FIRST', awardConfirmed: false, amountMinor: null }] });
  });
  it('a revision labelled COMPLETE with a non-complete category is an integrity failure, not a verdict', () => {
    const r = evaluateTicket(compiled, { completeness: 'COMPLETE', categories: [cat('FIRST', []), cat('CONSOLATION', [], 'PARTIAL'), cat('LAST4', [])] }, t('AB', '994321'));
    expect(r.ok).toBe(false);
    const missing = evaluateTicket(compiled, { completeness: 'COMPLETE', categories: [cat('FIRST', []), cat('LAST4', [])] }, t('AB', '994321'));
    expect(missing.ok).toBe(false);
  });
});

describe('candidateNumbers', () => {
  it('returns the full number plus each configured suffix', () => {
    expect(candidateNumbers(compiled, t('AA', '990042')).sort()).toEqual(['0042', '990042']);
  });
});

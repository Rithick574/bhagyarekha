import { describe, expect, it } from 'vitest';
import type { RuleSetV1 } from '@bhagyarekha/contracts';
import { compileRuleSet } from '../src/index.js';

function ruleSet(overrides: Partial<RuleSetV1> = {}): RuleSetV1 {
  return {
    schemaVersion: 1,
    engineVersion: 'v1',
    lotteryCode: 'DEMO_A',
    ruleVersion: 1,
    numberLength: 6,
    allowedFirstDigits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    allowedSeries: ['AA', 'AB', 'AC'],
    awardPolicy: 'SINGLE_BY_PRIORITY',
    categories: [
      { code: 'FIRST', labels: { en: 'First prize', ml: 'ഒന്നാം സമ്മാനം' }, metricRole: 'FIRST_PRIZE', priority: 1, match: { kind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY' }, excludedBy: [], expectedEntryCount: 1 },
      { code: 'CONSOLATION', labels: { en: 'Consolation', ml: 'സമാശ്വാസ സമ്മാനം' }, metricRole: 'OTHER', priority: 2, match: { kind: 'FULL_NUMBER', seriesPolicy: 'EXCEPT_ENTRY' }, excludedBy: ['FIRST'], expectedEntryCount: 1 },
      { code: 'LAST4', labels: { en: 'Last four digits', ml: 'അവസാന നാല് അക്കങ്ങൾ' }, metricRole: 'OTHER', priority: 3, match: { kind: 'SUFFIX', seriesPolicy: 'ANY_ALLOWED', suffixLength: 4 }, excludedBy: ['FIRST', 'CONSOLATION'], expectedEntryCount: null },
    ],
    ...overrides,
  };
}

describe('compileRuleSet', () => {
  it('compiles the synthetic demo rule set and orders categories by priority', () => {
    const result = compileRuleSet(ruleSet());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.compiled.categoriesByPriority.map((c) => c.spec.code)).toEqual(['FIRST', 'CONSOLATION', 'LAST4']);
    expect(result.compiled.firstPrizeCategoryCodes).toEqual(['FIRST']);
    expect(result.compiled.allowedSeries.has('AB')).toBe(true);
    expect(result.compiled.allowedSeries.has('ZZ')).toBe(false);
  });

  it('rejects duplicate codes and duplicate priorities', () => {
    const rs = ruleSet();
    const dup = { ...rs.categories[0]!, priority: 9 };
    const result = compileRuleSet(ruleSet({ categories: [...rs.categories, dup] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.code)).toContain('DUPLICATE_CATEGORY_CODE');

    const samePriority = ruleSet({ categories: [rs.categories[0]!, { ...rs.categories[1]!, priority: 1 }] });
    const r2 = compileRuleSet(samePriority);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.map((e) => e.code)).toContain('DUPLICATE_PRIORITY');
  });

  it('rejects exclusions that point to unknown, self, or lower-priority categories', () => {
    const rs = ruleSet();
    const unknown = compileRuleSet(ruleSet({ categories: [{ ...rs.categories[0]!, excludedBy: ['NOPE'] }] }));
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.errors[0]?.code).toBe('UNKNOWN_EXCLUSION_TARGET');

    const self = compileRuleSet(ruleSet({ categories: [{ ...rs.categories[0]!, excludedBy: ['FIRST'] }] }));
    expect(self.ok).toBe(false);
    if (!self.ok) expect(self.errors[0]?.code).toBe('SELF_EXCLUSION');

    const lower = compileRuleSet(ruleSet({ categories: [{ ...rs.categories[0]!, excludedBy: ['LAST4'] }, rs.categories[1]!, rs.categories[2]!] }));
    expect(lower.ok).toBe(false);
    if (!lower.ok) expect(lower.errors.map((e) => e.code)).toContain('EXCLUSION_NOT_HIGHER_PRIORITY');
  });

  it('rejects a suffix longer than the number', () => {
    const rs = ruleSet();
    const result = compileRuleSet(ruleSet({ numberLength: 3, categories: rs.categories }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.code)).toContain('SUFFIX_LONGER_THAN_NUMBER');
  });

  it('rejects duplicated series or first-digit domains', () => {
    const result = compileRuleSet(ruleSet({ allowedSeries: ['AA', 'AA'] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('DUPLICATE_ALLOWED_SERIES');
  });
});

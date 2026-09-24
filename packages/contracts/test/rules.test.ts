import { describe, expect, it } from 'vitest';
import { RuleSetV1Schema } from '../src/index.js';

const base = {
  schemaVersion: 1,
  engineVersion: 'v1',
  lotteryCode: 'DEMO_A',
  ruleVersion: 1,
  numberLength: 6,
  allowedFirstDigits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
  allowedSeries: ['AA', 'AB', 'AC'],
  awardPolicy: 'SINGLE_BY_PRIORITY',
  categories: [
    {
      code: 'FIRST',
      labels: { en: 'First prize', ml: 'ഒന്നാം സമ്മാനം' },
      metricRole: 'FIRST_PRIZE',
      priority: 1,
      match: { kind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY' },
      excludedBy: [],
      expectedEntryCount: 1,
    },
  ],
} as const;

describe('RuleSetV1Schema', () => {
  it('accepts a well-formed v1 rule set', () => {
    expect(RuleSetV1Schema.safeParse(base).success).toBe(true);
  });
  it('rejects unknown match kinds, executable fields and extra keys (closed language)', () => {
    expect(RuleSetV1Schema.safeParse({ ...base, categories: [{ ...base.categories[0], match: { kind: 'REGEX', pattern: '.*' } }] }).success).toBe(false);
    expect(RuleSetV1Schema.safeParse({ ...base, script: 'return true' }).success).toBe(false);
    expect(RuleSetV1Schema.safeParse({ ...base, awardPolicy: 'STACK_ALL' }).success).toBe(false);
    expect(RuleSetV1Schema.safeParse({ ...base, engineVersion: 'v2' }).success).toBe(false);
  });
  it('requires suffix categories to declare ANY_ALLOWED and a length', () => {
    const suffix = { ...base.categories[0], code: 'LAST4', priority: 2, metricRole: 'OTHER', match: { kind: 'SUFFIX', seriesPolicy: 'MATCH_ENTRY', suffixLength: 4 } };
    expect(RuleSetV1Schema.safeParse({ ...base, categories: [base.categories[0], suffix] }).success).toBe(false);
  });
});

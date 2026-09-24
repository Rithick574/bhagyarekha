import { describe, expect, it } from 'vitest';
import { RuleSetV1Schema } from '@bhagyarekha/contracts';
import { compileRuleSet } from '@bhagyarekha/domain';
import { demoFixtures } from '../../src/fixtures/demo-fixtures.js';

describe('demo fixtures', () => {
  it('are deterministic, self-consistent and compile', () => {
    for (const rule of demoFixtures.ruleVersions) {
      expect(RuleSetV1Schema.safeParse(rule.ruleSet).success).toBe(true);
      expect(compileRuleSet(rule.ruleSet).ok).toBe(true);
    }
    const drawIds = new Set(demoFixtures.draws.map((d) => d.id));
    const ruleIds = new Set(demoFixtures.ruleVersions.map((r) => r.id));
    for (const rev of demoFixtures.revisions) {
      expect(drawIds.has(rev.drawId)).toBe(true);
      expect(ruleIds.has(rev.ruleVersionId)).toBe(true);
      const rule = demoFixtures.ruleVersions.find((r) => r.id === rev.ruleVersionId)!;
      const codes = new Set(rule.ruleSet.categories.map((c) => c.code));
      expect(new Set(rev.categories.map((c) => c.code))).toEqual(codes);
      for (const cat of rev.categories) {
        const spec = rule.ruleSet.categories.find((c) => c.code === cat.code)!;
        for (const e of cat.entries) {
          expect(e.number).toMatch(/^[0-9]+$/);
          if (spec.match.kind === 'SUFFIX') {
            expect(e.number.length).toBe(spec.match.suffixLength);
            expect(e.series).toBe('');
          } else {
            expect(e.number.length).toBe(rule.ruleSet.numberLength);
            expect(rule.ruleSet.allowedSeries).toContain(e.series);
          }
        }
        if (cat.state === 'COMPLETE' && spec.expectedEntryCount !== null) expect(cat.entries.length).toBe(spec.expectedEntryCount);
      }
      if (rev.publicationKind === 'CORRECTION') expect(rev.correctionReason).toBeTruthy();
      if (rev.publicationKind === 'INITIAL') expect(rev.basedOnRevisionId).toBeNull();
    }
  });

  it('never name a real scheme and only cite synthetic evidence', () => {
    for (const l of demoFixtures.lotteries) expect(l.nameEn.toLowerCase()).toContain('sample');
    for (const e of demoFixtures.evidence) expect(e.title.toLowerCase()).toContain('synthetic');
  });

  it('include the edge cases Stage 1 must render', () => {
    const statuses = demoFixtures.draws.map((d) => `${d.phase}/${d.visibility}`);
    expect(statuses).toContain('CANCELLED/ACTIVE');
    expect(statuses).toContain('HELD/SUSPENDED');
    expect(statuses).toContain('POSTPONED/ACTIVE');
    expect(statuses).toContain('SCHEDULED/ACTIVE');
    expect(demoFixtures.revisions.some((r) => r.completeness === 'PARTIAL')).toBe(true);
    expect(demoFixtures.revisions.some((r) => r.publicationKind === 'CORRECTION')).toBe(true);
    // Two draws on the same calendar date (T19).
    const dates = demoFixtures.draws.map((d) => d.actualDate ?? d.scheduledDate);
    expect(dates.length).toBeGreaterThan(new Set(dates).size);
    // Leading-zero numbers (T01/AC-05).
    expect(demoFixtures.revisions.flatMap((r) => r.categories.flatMap((c) => c.entries.map((e) => e.number))).some((n) => n.startsWith('0'))).toBe(true);
  });
});

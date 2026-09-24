import { describe, expect, it } from 'vitest';
import type { DrawEntity, LotteryEntity, ResultRevisionEntity, RevisionCategoryEntity, RuleCategoryEntity, RuleVersionEntity, WinningEntryEntity } from '../../src/database/entities/index.js';
import { deriveCheckingCapability, derivePublicationStatus, toDrawSummary, toMatchSpec, toSourceReference } from '../../src/modules/results/mapping.js';

const lottery: LotteryEntity = {
  id: 'a0000001-0000-4000-8000-000000000001', code: 'DEMO_NILA', slug: 'nila-weekly-sample', nameEn: 'Nila Weekly (Sample)', nameMl: 'നില', active: true,
  datasetVersion: '4', archiveCoverage: 'UNKNOWN', createdAt: new Date(), updatedAt: new Date(), editVersion: 1,
};

function draw(overrides: Partial<DrawEntity> = {}): DrawEntity {
  return {
    id: 'd0000001-0000-4000-8000-000000000039', lotteryId: lottery.id, drawCode: 'NL-039', scheduledDate: '2026-09-24', actualDate: '2026-09-24',
    scheduledAt: new Date('2026-09-24T09:30:00Z'), actualAt: new Date('2026-09-24T09:30:00Z'), phase: 'HELD', visibility: 'ACTIVE', suspensionReason: null,
    currentRevisionId: 'c0000001-0000-4000-8000-000000000391', nextRevisionNo: 2, createdAt: new Date(), updatedAt: new Date(), editVersion: 2, ...overrides,
  };
}

function revision(overrides: Partial<ResultRevisionEntity> = {}): ResultRevisionEntity {
  return {
    id: 'c0000001-0000-4000-8000-000000000391', drawId: draw().id, lotteryId: lottery.id, ruleVersionId: 'b0000001-0000-4000-8000-000000000001', revisionNo: 1,
    drawSnapshot: { drawCode: 'NL-039', scheduledDate: '2026-09-24', actualDate: '2026-09-24', scheduledAt: '2026-09-24T09:30:00.000Z', actualAt: '2026-09-24T09:30:00.000Z' },
    basedOnRevisionId: null, workflowState: 'PUBLISHED', publicationKind: 'INITIAL', completeness: 'COMPLETE', contentHash: 'x', reviewedHash: 'x', reviewedBy: null,
    reviewedAt: new Date('2026-09-24T11:00:00Z'), publishedBy: null, publishedAt: new Date('2026-09-24T11:05:00Z'), correctionReason: null, createdAt: new Date(), updatedAt: new Date(), editVersion: 2, ...overrides,
  };
}

const ruleCategory: RuleCategoryEntity = {
  ruleVersionId: 'b0000001-0000-4000-8000-000000000001', code: 'FIRST', labelEn: 'First prize', labelMl: 'ഒന്നാം സമ്മാനം', priority: 1, metricRole: 'FIRST_PRIZE',
  matchKind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY', suffixLength: null, excludedBy: [], expectedEntryCount: 1,
};
const revisionCategory: RevisionCategoryEntity = { revisionId: revision().id, categoryCode: 'FIRST', ruleVersionId: ruleCategory.ruleVersionId, state: 'COMPLETE', amountMinor: '10000000', sourceReviewedBy: null, sourceReviewedAt: null, sourceReviewNote: null };
const entry: WinningEntryEntity = { id: '1', revisionId: revision().id, categoryCode: 'FIRST', series: 'AA', number: '001234', sourceRow: 1 };

describe('derivePublicationStatus', () => {
  it('orders cancellation, suspension, absence and completeness correctly', () => {
    expect(derivePublicationStatus({ phase: 'CANCELLED', visibility: 'ACTIVE' }, revision())).toBe('CANCELLED');
    expect(derivePublicationStatus({ phase: 'HELD', visibility: 'SUSPENDED' }, revision())).toBe('SUSPENDED');
    expect(derivePublicationStatus({ phase: 'SCHEDULED', visibility: 'ACTIVE' }, null)).toBe('NOT_PUBLISHED');
    expect(derivePublicationStatus({ phase: 'HELD', visibility: 'ACTIVE' }, null)).toBe('NOT_PUBLISHED');
    expect(derivePublicationStatus({ phase: 'HELD', visibility: 'ACTIVE' }, revision({ completeness: 'PARTIAL' }))).toBe('PARTIAL');
    expect(derivePublicationStatus({ phase: 'HELD', visibility: 'ACTIVE' }, revision())).toBe('COMPLETE');
  });
});

describe('toDrawSummary', () => {
  it('preserves leading zeros and uses the reviewed snapshot for published labels', () => {
    const summary = toDrawSummary({
      draw: draw({ drawCode: 'RENAMED-LATER', scheduledDate: '2026-09-25', actualDate: '2026-09-25' }),
      lottery,
      currentRevision: revision(),
      firstPrize: { ruleCategory, revisionCategory, entries: [entry] },
      supersededRevisionCount: 0,
    });
    expect(summary.firstPrize?.entries[0]).toEqual({ series: 'AA', number: '001234' });
    expect(summary.drawCode).toBe('NL-039');
    expect(summary.displayDate).toBe('2026-09-24');
    expect(summary.publicationStatus).toBe('COMPLETE');
    expect(summary.currentRevision?.publishedAt).toBe('2026-09-24T11:05:00.000Z');
  });

  it('withholds the payload of a suspended draw', () => {
    const summary = toDrawSummary({ draw: draw({ visibility: 'SUSPENDED', suspensionReason: 'review' }), lottery, currentRevision: revision(), firstPrize: { ruleCategory, revisionCategory, entries: [entry] }, supersededRevisionCount: 0 });
    expect(summary.publicationStatus).toBe('SUSPENDED');
    expect(summary.currentRevision).toBeNull();
    expect(summary.firstPrize).toBeNull();
  });

  it('marks corrections and counts superseded revisions', () => {
    const summary = toDrawSummary({ draw: draw(), lottery, currentRevision: revision({ publicationKind: 'CORRECTION', correctionReason: 'transposed digits', revisionNo: 2, basedOnRevisionId: 'c0000001-0000-4000-8000-000000000390' }), firstPrize: null, supersededRevisionCount: 1 });
    expect(summary.currentRevision).toMatchObject({ isCorrection: true, correctionReason: 'transposed digits', supersededRevisionCount: 1, revisionNo: 2 });
  });

  it('uses scheduling dates for an unpublished draw and never invents a time', () => {
    const summary = toDrawSummary({ draw: draw({ currentRevisionId: null, phase: 'SCHEDULED', scheduledDate: '2026-10-01', actualDate: null, scheduledAt: null, actualAt: null }), lottery, currentRevision: null, firstPrize: null, supersededRevisionCount: 0 });
    expect(summary).toMatchObject({ displayDate: '2026-10-01', actualDate: null, scheduledAt: null, actualAt: null, publicationStatus: 'NOT_PUBLISHED', currentRevision: null, firstPrize: null });
  });
});

describe('deriveCheckingCapability', () => {
  const rule = (state: RuleVersionEntity['state']): Pick<RuleVersionEntity, 'id' | 'state'> => ({ id: 'b0000001-0000-4000-8000-000000000001', state });
  it('fails closed for every non-supported situation', () => {
    expect(deriveCheckingCapability({ phase: 'CANCELLED', visibility: 'ACTIVE' }, revision(), rule('APPROVED'), true).reasonCode).toBe('DRAW_CANCELLED');
    expect(deriveCheckingCapability({ phase: 'HELD', visibility: 'SUSPENDED' }, revision(), rule('APPROVED'), true).reasonCode).toBe('RESULT_SUSPENDED');
    expect(deriveCheckingCapability({ phase: 'HELD', visibility: 'ACTIVE' }, null, rule('APPROVED'), true).reasonCode).toBe('NO_PUBLISHED_RESULT');
    expect(deriveCheckingCapability({ phase: 'HELD', visibility: 'ACTIVE' }, revision(), rule('REVOKED'), true)).toMatchObject({ capability: 'UNSUPPORTED', reasonCode: 'RULE_REVOKED' });
    expect(deriveCheckingCapability({ phase: 'HELD', visibility: 'ACTIVE' }, revision(), rule('DRAFT'), true).reasonCode).toBe('RULE_NOT_APPROVED');
    expect(deriveCheckingCapability({ phase: 'HELD', visibility: 'ACTIVE' }, revision(), rule('APPROVED'), false).reasonCode).toBe('RULE_NOT_COMPILABLE');
  });
  it('reports SUPPORTED only for a published, active draw with an approved compilable rule', () => {
    expect(deriveCheckingCapability({ phase: 'HELD', visibility: 'ACTIVE' }, revision(), rule('APPROVED'), true)).toEqual({ capability: 'SUPPORTED', ruleVersionId: 'b0000001-0000-4000-8000-000000000001', reasonCode: null });
  });
});

describe('toMatchSpec / toSourceReference', () => {
  it('round-trips a suffix category and strips URLs from synthetic evidence', () => {
    expect(toMatchSpec({ ...ruleCategory, matchKind: 'SUFFIX', seriesPolicy: 'ANY_ALLOWED', suffixLength: 4 })).toEqual({ kind: 'SUFFIX', seriesPolicy: 'ANY_ALLOWED', suffixLength: 4 });
    expect(toSourceReference({ id: 'e', kind: 'SYNTHETIC_FIXTURE', url: 'https://example.org/should-not-leak', title: 'Synthetic', documentHash: null, reviewedBy: null, reviewedAt: null, reviewNote: null, acquiredAt: null, createdAt: new Date() }).url).toBeNull();
  });
});

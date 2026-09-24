import type { RuleSetV1 } from '@bhagyarekha/contracts';

/**
 * SYNTHETIC DEMO FIXTURES — every lottery name, draw, number, amount and rule
 * here is invented to exercise the implementation. Nothing describes a real
 * Kerala lottery scheme or result. The seed refuses to write these into a
 * live-marked database.
 */

export interface FixtureLottery {
  id: string;
  code: string;
  slug: string;
  nameEn: string;
  nameMl: string;
  active: boolean;
}

export interface FixtureEvidence {
  id: string;
  title: string;
  reviewNote: string;
  reviewedAt: string;
}

export interface FixtureRuleVersion {
  id: string;
  lotteryId: string;
  ruleSet: RuleSetV1;
  state: 'APPROVED' | 'REVOKED';
  approvedAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  evidenceId: string;
}

export interface FixtureDraw {
  id: string;
  lotteryId: string;
  drawCode: string;
  scheduledDate: string | null;
  actualDate: string | null;
  scheduledAt: string | null;
  actualAt: string | null;
  phase: 'SCHEDULED' | 'POSTPONED' | 'HELD' | 'CANCELLED';
  visibility: 'ACTIVE' | 'SUSPENDED';
  suspensionReason: string | null;
}

export interface FixtureCategory {
  code: string;
  state: 'MISSING' | 'PARTIAL' | 'COMPLETE';
  amountMinor: string | null;
  sourceReviewedAt: string | null;
  entries: { series: string; number: string }[];
}

export interface FixtureRevision {
  id: string;
  drawId: string;
  lotteryId: string;
  ruleVersionId: string;
  revisionNo: number;
  publicationKind: 'INITIAL' | 'UPDATE' | 'CORRECTION';
  completeness: 'PARTIAL' | 'COMPLETE';
  basedOnRevisionId: string | null;
  correctionReason: string | null;
  publishedAt: string;
  categories: FixtureCategory[];
  evidenceId: string;
}

export interface DemoFixtures {
  lotteries: FixtureLottery[];
  evidence: FixtureEvidence[];
  ruleVersions: FixtureRuleVersion[];
  draws: FixtureDraw[];
  /** Ordered: earlier revisions of the same draw come first. */
  revisions: FixtureRevision[];
}

const ALL_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Stable identifiers (RFC 4122 shaped) so the seed is idempotent.
export const IDS = {
  lotteryNila: 'a0000001-0000-4000-8000-000000000001',
  lotteryThira: 'a0000001-0000-4000-8000-000000000002',
  lotteryBumper: 'a0000001-0000-4000-8000-000000000003',
  evidenceRules: 'e0000001-0000-4000-8000-000000000001',
  evidenceResults: 'e0000001-0000-4000-8000-000000000002',
  ruleNila1: 'b0000001-0000-4000-8000-000000000001',
  ruleThira1: 'b0000001-0000-4000-8000-000000000002',
  ruleBumper1: 'b0000001-0000-4000-8000-000000000003',
  drawNila036: 'd0000001-0000-4000-8000-000000000036',
  drawNila037: 'd0000001-0000-4000-8000-000000000037',
  drawNila038: 'd0000001-0000-4000-8000-000000000038',
  drawNila039: 'd0000001-0000-4000-8000-000000000039',
  drawNila040: 'd0000001-0000-4000-8000-000000000040',
  drawThira036: 'd0000002-0000-4000-8000-000000000036',
  drawThira037: 'd0000002-0000-4000-8000-000000000037',
  drawThira038: 'd0000002-0000-4000-8000-000000000038',
  drawThira039: 'd0000002-0000-4000-8000-000000000039',
  drawBumper01: 'd0000003-0000-4000-8000-000000000001',
  drawBumper02: 'd0000003-0000-4000-8000-000000000002',
  revNila036r1: 'c0000001-0000-4000-8000-000000000361',
  revNila037r1: 'c0000001-0000-4000-8000-000000000371',
  revNila038r1: 'c0000001-0000-4000-8000-000000000381',
  revNila039r1: 'c0000001-0000-4000-8000-000000000391',
  revThira036r1: 'c0000002-0000-4000-8000-000000000361',
  revThira037r1: 'c0000002-0000-4000-8000-000000000371',
  revThira037r2: 'c0000002-0000-4000-8000-000000000372',
  revThira038r1: 'c0000002-0000-4000-8000-000000000381',
  revBumper01r1: 'c0000003-0000-4000-8000-000000000011',
} as const;

const nilaRuleSet: RuleSetV1 = {
  schemaVersion: 1,
  engineVersion: 'v1',
  lotteryCode: 'DEMO_NILA',
  ruleVersion: 1,
  numberLength: 6,
  allowedFirstDigits: ALL_DIGITS,
  allowedSeries: ['AA', 'AB', 'AC'],
  awardPolicy: 'SINGLE_BY_PRIORITY',
  categories: [
    { code: 'FIRST', labels: { en: 'First prize', ml: 'ഒന്നാം സമ്മാനം' }, metricRole: 'FIRST_PRIZE', priority: 1, match: { kind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY' }, excludedBy: [], expectedEntryCount: 1 },
    { code: 'CONSOLATION', labels: { en: 'Consolation prize', ml: 'സമാശ്വാസ സമ്മാനം' }, metricRole: 'OTHER', priority: 2, match: { kind: 'FULL_NUMBER', seriesPolicy: 'EXCEPT_ENTRY' }, excludedBy: ['FIRST'], expectedEntryCount: 1 },
    { code: 'LAST4', labels: { en: 'Last four digits', ml: 'അവസാന നാല് അക്കങ്ങൾ' }, metricRole: 'OTHER', priority: 3, match: { kind: 'SUFFIX', seriesPolicy: 'ANY_ALLOWED', suffixLength: 4 }, excludedBy: ['FIRST', 'CONSOLATION'], expectedEntryCount: null },
  ],
};

const thiraRuleSet: RuleSetV1 = {
  schemaVersion: 1,
  engineVersion: 'v1',
  lotteryCode: 'DEMO_THIRA',
  ruleVersion: 1,
  numberLength: 6,
  allowedFirstDigits: ALL_DIGITS,
  allowedSeries: ['BA', 'BB', 'BC'],
  awardPolicy: 'SINGLE_BY_PRIORITY',
  categories: [
    { code: 'FIRST', labels: { en: 'First prize', ml: 'ഒന്നാം സമ്മാനം' }, metricRole: 'FIRST_PRIZE', priority: 1, match: { kind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY' }, excludedBy: [], expectedEntryCount: 1 },
    { code: 'SECOND', labels: { en: 'Second prize', ml: 'രണ്ടാം സമ്മാനം' }, metricRole: 'OTHER', priority: 2, match: { kind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY' }, excludedBy: ['FIRST'], expectedEntryCount: 1 },
    { code: 'LAST3', labels: { en: 'Last three digits', ml: 'അവസാന മൂന്ന് അക്കങ്ങൾ' }, metricRole: 'OTHER', priority: 3, match: { kind: 'SUFFIX', seriesPolicy: 'ANY_ALLOWED', suffixLength: 3 }, excludedBy: ['FIRST', 'SECOND'], expectedEntryCount: 10 },
  ],
};

const bumperRuleSet: RuleSetV1 = {
  schemaVersion: 1,
  engineVersion: 'v1',
  lotteryCode: 'DEMO_BUMPER',
  ruleVersion: 1,
  numberLength: 7,
  allowedFirstDigits: ALL_DIGITS,
  allowedSeries: ['SA', 'SB'],
  awardPolicy: 'SINGLE_BY_PRIORITY',
  categories: [
    { code: 'FIRST', labels: { en: 'First prize', ml: 'ഒന്നാം സമ്മാനം' }, metricRole: 'FIRST_PRIZE', priority: 1, match: { kind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY' }, excludedBy: [], expectedEntryCount: 1 },
    { code: 'LAST5', labels: { en: 'Last five digits', ml: 'അവസാന അഞ്ച് അക്കങ്ങൾ' }, metricRole: 'OTHER', priority: 2, match: { kind: 'SUFFIX', seriesPolicy: 'ANY_ALLOWED', suffixLength: 5 }, excludedBy: ['FIRST'], expectedEntryCount: null },
  ],
};

const REVIEWED = '2026-09-01T04:30:00.000Z';

export const demoFixtures: DemoFixtures = {
  lotteries: [
    { id: IDS.lotteryNila, code: 'DEMO_NILA', slug: 'nila-weekly-sample', nameEn: 'Nila Weekly (Sample)', nameMl: 'നില വീക്ക്‌ലി (സാമ്പിൾ)', active: true },
    { id: IDS.lotteryThira, code: 'DEMO_THIRA', slug: 'thira-weekly-sample', nameEn: 'Thira Weekly (Sample)', nameMl: 'തിര വീക്ക്‌ലി (സാമ്പിൾ)', active: true },
    { id: IDS.lotteryBumper, code: 'DEMO_BUMPER', slug: 'sample-bumper', nameEn: 'Sample Bumper', nameMl: 'സാമ്പിൾ ബമ്പർ', active: true },
  ],
  evidence: [
    { id: IDS.evidenceRules, title: 'Synthetic demo rule fixture — not an official scheme document', reviewNote: 'Invented rules used only to exercise the implementation.', reviewedAt: REVIEWED },
    { id: IDS.evidenceResults, title: 'Synthetic demo result fixture — not an official result', reviewNote: 'Invented numbers used only to exercise the implementation.', reviewedAt: REVIEWED },
  ],
  ruleVersions: [
    { id: IDS.ruleNila1, lotteryId: IDS.lotteryNila, ruleSet: nilaRuleSet, state: 'APPROVED', approvedAt: REVIEWED, revokedAt: null, revocationReason: null, evidenceId: IDS.evidenceRules },
    { id: IDS.ruleThira1, lotteryId: IDS.lotteryThira, ruleSet: thiraRuleSet, state: 'APPROVED', approvedAt: REVIEWED, revokedAt: null, revocationReason: null, evidenceId: IDS.evidenceRules },
    {
      id: IDS.ruleBumper1,
      lotteryId: IDS.lotteryBumper,
      ruleSet: bumperRuleSet,
      state: 'REVOKED',
      approvedAt: REVIEWED,
      revokedAt: '2026-09-18T06:00:00.000Z',
      revocationReason: 'Synthetic example: rule version withdrawn for review, so automatic checking is unsupported while the numbers stay viewable.',
      evidenceId: IDS.evidenceRules,
    },
  ],
  draws: [
    // Nila Weekly (Sample) — 6-digit, series AA/AB/AC
    { id: IDS.drawNila036, lotteryId: IDS.lotteryNila, drawCode: 'NL-036', scheduledDate: '2026-09-03', actualDate: '2026-09-03', scheduledAt: '2026-09-03T09:30:00.000Z', actualAt: '2026-09-03T09:30:00.000Z', phase: 'HELD', visibility: 'ACTIVE', suspensionReason: null },
    { id: IDS.drawNila037, lotteryId: IDS.lotteryNila, drawCode: 'NL-037', scheduledDate: '2026-09-10', actualDate: '2026-09-10', scheduledAt: '2026-09-10T09:30:00.000Z', actualAt: '2026-09-10T09:30:00.000Z', phase: 'HELD', visibility: 'SUSPENDED', suspensionReason: 'Synthetic example: result withheld while a source discrepancy is reviewed.' },
    { id: IDS.drawNila038, lotteryId: IDS.lotteryNila, drawCode: 'NL-038', scheduledDate: '2026-09-17', actualDate: '2026-09-17', scheduledAt: '2026-09-17T09:30:00.000Z', actualAt: '2026-09-17T09:30:00.000Z', phase: 'HELD', visibility: 'ACTIVE', suspensionReason: null },
    { id: IDS.drawNila039, lotteryId: IDS.lotteryNila, drawCode: 'NL-039', scheduledDate: '2026-09-24', actualDate: '2026-09-24', scheduledAt: '2026-09-24T09:30:00.000Z', actualAt: '2026-09-24T09:30:00.000Z', phase: 'HELD', visibility: 'ACTIVE', suspensionReason: null },
    { id: IDS.drawNila040, lotteryId: IDS.lotteryNila, drawCode: 'NL-040', scheduledDate: '2026-10-01', actualDate: null, scheduledAt: '2026-10-01T09:30:00.000Z', actualAt: null, phase: 'SCHEDULED', visibility: 'ACTIVE', suspensionReason: null },
    // Thira Weekly (Sample) — 6-digit, series BA/BB/BC
    { id: IDS.drawThira036, lotteryId: IDS.lotteryThira, drawCode: 'TH-036', scheduledDate: '2026-09-08', actualDate: '2026-09-08', scheduledAt: '2026-09-08T09:30:00.000Z', actualAt: '2026-09-08T09:30:00.000Z', phase: 'HELD', visibility: 'ACTIVE', suspensionReason: null },
    // Postponed by one day: scheduled and actual dates differ.
    { id: IDS.drawThira037, lotteryId: IDS.lotteryThira, drawCode: 'TH-037', scheduledDate: '2026-09-15', actualDate: '2026-09-16', scheduledAt: '2026-09-15T09:30:00.000Z', actualAt: '2026-09-16T09:30:00.000Z', phase: 'POSTPONED', visibility: 'ACTIVE', suspensionReason: null },
    { id: IDS.drawThira038, lotteryId: IDS.lotteryThira, drawCode: 'TH-038', scheduledDate: '2026-09-22', actualDate: '2026-09-22', scheduledAt: '2026-09-22T09:30:00.000Z', actualAt: '2026-09-22T09:30:00.000Z', phase: 'HELD', visibility: 'ACTIVE', suspensionReason: null },
    // Held yesterday, no result published yet: "awaiting result".
    { id: IDS.drawThira039, lotteryId: IDS.lotteryThira, drawCode: 'TH-039', scheduledDate: '2026-09-23', actualDate: '2026-09-23', scheduledAt: '2026-09-23T09:30:00.000Z', actualAt: '2026-09-23T09:30:00.000Z', phase: 'HELD', visibility: 'ACTIVE', suspensionReason: null },
    // Sample Bumper — 7-digit, same date as NL-038 (two draws on one date)
    { id: IDS.drawBumper01, lotteryId: IDS.lotteryBumper, drawCode: 'SB-2026-01', scheduledDate: '2026-09-17', actualDate: '2026-09-17', scheduledAt: '2026-09-17T08:30:00.000Z', actualAt: '2026-09-17T08:30:00.000Z', phase: 'HELD', visibility: 'ACTIVE', suspensionReason: null },
    { id: IDS.drawBumper02, lotteryId: IDS.lotteryBumper, drawCode: 'SB-2026-02', scheduledDate: '2026-09-30', actualDate: null, scheduledAt: null, actualAt: null, phase: 'CANCELLED', visibility: 'ACTIVE', suspensionReason: null },
  ],
  revisions: [
    {
      id: IDS.revNila036r1, drawId: IDS.drawNila036, lotteryId: IDS.lotteryNila, ruleVersionId: IDS.ruleNila1, revisionNo: 1, publicationKind: 'INITIAL', completeness: 'COMPLETE', basedOnRevisionId: null, correctionReason: null, publishedAt: '2026-09-03T11:00:00.000Z', evidenceId: IDS.evidenceResults,
      categories: [
        { code: 'FIRST', state: 'COMPLETE', amountMinor: '10000000', sourceReviewedAt: '2026-09-03T10:50:00.000Z', entries: [{ series: 'AC', number: '100200' }] },
        { code: 'CONSOLATION', state: 'COMPLETE', amountMinor: '500000', sourceReviewedAt: '2026-09-03T10:50:00.000Z', entries: [{ series: 'AC', number: '100200' }] },
        { code: 'LAST4', state: 'COMPLETE', amountMinor: '100000', sourceReviewedAt: '2026-09-03T10:50:00.000Z', entries: [{ series: '', number: '0200' }, { series: '', number: '3311' }, { series: '', number: '7777' }] },
      ],
    },
    {
      id: IDS.revNila037r1, drawId: IDS.drawNila037, lotteryId: IDS.lotteryNila, ruleVersionId: IDS.ruleNila1, revisionNo: 1, publicationKind: 'INITIAL', completeness: 'COMPLETE', basedOnRevisionId: null, correctionReason: null, publishedAt: '2026-09-10T11:00:00.000Z', evidenceId: IDS.evidenceResults,
      categories: [
        { code: 'FIRST', state: 'COMPLETE', amountMinor: '10000000', sourceReviewedAt: '2026-09-10T10:50:00.000Z', entries: [{ series: 'AA', number: '555000' }] },
        { code: 'CONSOLATION', state: 'COMPLETE', amountMinor: '500000', sourceReviewedAt: '2026-09-10T10:50:00.000Z', entries: [{ series: 'AA', number: '555000' }] },
        { code: 'LAST4', state: 'COMPLETE', amountMinor: '100000', sourceReviewedAt: '2026-09-10T10:50:00.000Z', entries: [{ series: '', number: '5000' }, { series: '', number: '0001' }] },
      ],
    },
    {
      id: IDS.revNila038r1, drawId: IDS.drawNila038, lotteryId: IDS.lotteryNila, ruleVersionId: IDS.ruleNila1, revisionNo: 1, publicationKind: 'INITIAL', completeness: 'COMPLETE', basedOnRevisionId: null, correctionReason: null, publishedAt: '2026-09-17T11:00:00.000Z', evidenceId: IDS.evidenceResults,
      categories: [
        { code: 'FIRST', state: 'COMPLETE', amountMinor: '10000000', sourceReviewedAt: '2026-09-17T10:50:00.000Z', entries: [{ series: 'AB', number: '045678' }] },
        { code: 'CONSOLATION', state: 'COMPLETE', amountMinor: '500000', sourceReviewedAt: '2026-09-17T10:50:00.000Z', entries: [{ series: 'AB', number: '045678' }] },
        { code: 'LAST4', state: 'COMPLETE', amountMinor: '100000', sourceReviewedAt: '2026-09-17T10:50:00.000Z', entries: [{ series: '', number: '5678' }, { series: '', number: '0099' }, { series: '', number: '4242' }, { series: '', number: '8080' }] },
      ],
    },
    {
      // The latest published draw. Uses the LLD's synthetic example numbers.
      id: IDS.revNila039r1, drawId: IDS.drawNila039, lotteryId: IDS.lotteryNila, ruleVersionId: IDS.ruleNila1, revisionNo: 1, publicationKind: 'INITIAL', completeness: 'COMPLETE', basedOnRevisionId: null, correctionReason: null, publishedAt: '2026-09-24T11:05:00.000Z', evidenceId: IDS.evidenceResults,
      categories: [
        { code: 'FIRST', state: 'COMPLETE', amountMinor: '10000000', sourceReviewedAt: '2026-09-24T10:55:00.000Z', entries: [{ series: 'AA', number: '001234' }] },
        { code: 'CONSOLATION', state: 'COMPLETE', amountMinor: '500000', sourceReviewedAt: '2026-09-24T10:55:00.000Z', entries: [{ series: 'AA', number: '001234' }] },
        { code: 'LAST4', state: 'COMPLETE', amountMinor: '100000', sourceReviewedAt: '2026-09-24T10:55:00.000Z', entries: [{ series: '', number: '1234' }, { series: '', number: '0042' }, { series: '', number: '9876' }, { series: '', number: '2468' }, { series: '', number: '1357' }] },
      ],
    },
    {
      id: IDS.revThira036r1, drawId: IDS.drawThira036, lotteryId: IDS.lotteryThira, ruleVersionId: IDS.ruleThira1, revisionNo: 1, publicationKind: 'INITIAL', completeness: 'COMPLETE', basedOnRevisionId: null, correctionReason: null, publishedAt: '2026-09-08T11:00:00.000Z', evidenceId: IDS.evidenceResults,
      categories: [
        { code: 'FIRST', state: 'COMPLETE', amountMinor: '7500000', sourceReviewedAt: '2026-09-08T10:50:00.000Z', entries: [{ series: 'BC', number: '654321' }] },
        { code: 'SECOND', state: 'COMPLETE', amountMinor: '1000000', sourceReviewedAt: '2026-09-08T10:50:00.000Z', entries: [{ series: 'BA', number: '112233' }] },
        { code: 'LAST3', state: 'COMPLETE', amountMinor: '50000', sourceReviewedAt: '2026-09-08T10:50:00.000Z', entries: ['321', '005', '118', '240', '377', '486', '590', '644', '721', '899'].map((n) => ({ series: '', number: n })) },
      ],
    },
    {
      // Revision 1, later corrected by revision 2 (transposed digits).
      id: IDS.revThira037r1, drawId: IDS.drawThira037, lotteryId: IDS.lotteryThira, ruleVersionId: IDS.ruleThira1, revisionNo: 1, publicationKind: 'INITIAL', completeness: 'COMPLETE', basedOnRevisionId: null, correctionReason: null, publishedAt: '2026-09-16T11:00:00.000Z', evidenceId: IDS.evidenceResults,
      categories: [
        { code: 'FIRST', state: 'COMPLETE', amountMinor: '7500000', sourceReviewedAt: '2026-09-16T10:50:00.000Z', entries: [{ series: 'BA', number: '123456' }] },
        { code: 'SECOND', state: 'COMPLETE', amountMinor: '1000000', sourceReviewedAt: '2026-09-16T10:50:00.000Z', entries: [{ series: 'BB', number: '778899' }] },
        { code: 'LAST3', state: 'COMPLETE', amountMinor: '50000', sourceReviewedAt: '2026-09-16T10:50:00.000Z', entries: ['456', '012', '133', '299', '305', '470', '561', '688', '702', '954'].map((n) => ({ series: '', number: n })) },
      ],
    },
    {
      id: IDS.revThira037r2, drawId: IDS.drawThira037, lotteryId: IDS.lotteryThira, ruleVersionId: IDS.ruleThira1, revisionNo: 2, publicationKind: 'CORRECTION', completeness: 'COMPLETE', basedOnRevisionId: IDS.revThira037r1, correctionReason: 'Synthetic correction example: two digits of the first-prize number were transposed in the earlier revision.', publishedAt: '2026-09-17T05:30:00.000Z', evidenceId: IDS.evidenceResults,
      categories: [
        { code: 'FIRST', state: 'COMPLETE', amountMinor: '7500000', sourceReviewedAt: '2026-09-17T05:20:00.000Z', entries: [{ series: 'BA', number: '123465' }] },
        { code: 'SECOND', state: 'COMPLETE', amountMinor: '1000000', sourceReviewedAt: '2026-09-17T05:20:00.000Z', entries: [{ series: 'BB', number: '778899' }] },
        { code: 'LAST3', state: 'COMPLETE', amountMinor: '50000', sourceReviewedAt: '2026-09-17T05:20:00.000Z', entries: ['465', '012', '133', '299', '305', '470', '561', '688', '702', '954'].map((n) => ({ series: '', number: n })) },
      ],
    },
    {
      // Partially published: first prize reviewed, second prize missing, suffix list partial.
      id: IDS.revThira038r1, drawId: IDS.drawThira038, lotteryId: IDS.lotteryThira, ruleVersionId: IDS.ruleThira1, revisionNo: 1, publicationKind: 'INITIAL', completeness: 'PARTIAL', basedOnRevisionId: null, correctionReason: null, publishedAt: '2026-09-22T10:40:00.000Z', evidenceId: IDS.evidenceResults,
      categories: [
        { code: 'FIRST', state: 'COMPLETE', amountMinor: '7500000', sourceReviewedAt: '2026-09-22T10:35:00.000Z', entries: [{ series: 'BB', number: '000077' }] },
        { code: 'SECOND', state: 'MISSING', amountMinor: null, sourceReviewedAt: null, entries: [] },
        { code: 'LAST3', state: 'PARTIAL', amountMinor: '50000', sourceReviewedAt: null, entries: [{ series: '', number: '077' }, { series: '', number: '900' }] },
      ],
    },
    {
      // Complete result whose rule version was later revoked: viewable, not checkable.
      id: IDS.revBumper01r1, drawId: IDS.drawBumper01, lotteryId: IDS.lotteryBumper, ruleVersionId: IDS.ruleBumper1, revisionNo: 1, publicationKind: 'INITIAL', completeness: 'COMPLETE', basedOnRevisionId: null, correctionReason: null, publishedAt: '2026-09-17T10:30:00.000Z', evidenceId: IDS.evidenceResults,
      categories: [
        { code: 'FIRST', state: 'COMPLETE', amountMinor: '50000000', sourceReviewedAt: '2026-09-17T10:20:00.000Z', entries: [{ series: 'SB', number: '0123456' }] },
        { code: 'LAST5', state: 'COMPLETE', amountMinor: '200000', sourceReviewedAt: '2026-09-17T10:20:00.000Z', entries: [{ series: '', number: '23456' }, { series: '', number: '00001' }] },
      ],
    },
  ],
};

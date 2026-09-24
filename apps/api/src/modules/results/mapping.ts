import type {
  CategoryResult,
  CheckingCapability,
  DrawSummary,
  FirstPrizeSummary,
  LotterySummary,
  MatchSpec,
  PublicationStatus,
  RevisionSummary,
  SourceReference,
  WinningEntry,
} from '@bhagyarekha/contracts';
import type {
  DrawEntity,
  LotteryEntity,
  ResultRevisionEntity,
  RevisionCategoryEntity,
  RuleCategoryEntity,
  RuleVersionEntity,
  SourceEvidenceEntity,
  WinningEntryEntity,
} from '../../database/entities/index.js';

/** Pure mapping from persistence rows to public transport shapes. No I/O. */

export interface FirstPrizeRows {
  ruleCategory: RuleCategoryEntity;
  revisionCategory: RevisionCategoryEntity;
  entries: WinningEntryEntity[];
}

export interface DrawSummaryRows {
  draw: DrawEntity;
  lottery: LotteryEntity;
  /** The current revision when one exists — regardless of visibility; the mapper withholds it when suspended. */
  currentRevision: ResultRevisionEntity | null;
  firstPrize: FirstPrizeRows | null;
  supersededRevisionCount: number;
}

export function derivePublicationStatus(draw: Pick<DrawEntity, 'phase' | 'visibility'>, revision: Pick<ResultRevisionEntity, 'completeness'> | null): PublicationStatus {
  if (draw.phase === 'CANCELLED') return 'CANCELLED';
  if (draw.visibility === 'SUSPENDED') return 'SUSPENDED';
  if (!revision) return 'NOT_PUBLISHED';
  return revision.completeness === 'COMPLETE' ? 'COMPLETE' : 'PARTIAL';
}

/** Whether the public read side may expose the current revision's payload. */
export function payloadVisible(draw: Pick<DrawEntity, 'phase' | 'visibility'>, revision: ResultRevisionEntity | null): revision is ResultRevisionEntity {
  return revision !== null && draw.visibility === 'ACTIVE' && draw.phase !== 'CANCELLED' && revision.workflowState === 'PUBLISHED';
}

export function toIso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toRevisionSummary(revision: ResultRevisionEntity, supersededRevisionCount: number): RevisionSummary {
  if (!revision.publishedAt) throw new Error(`Revision ${revision.id} is exposed without a publication time`);
  return {
    id: revision.id,
    revisionNo: revision.revisionNo,
    publicationKind: revision.publicationKind,
    completeness: revision.completeness,
    publishedAt: toIso(revision.publishedAt) as string,
    isCorrection: revision.publicationKind === 'CORRECTION',
    correctionReason: revision.publicationKind === 'CORRECTION' ? revision.correctionReason : null,
    supersededRevisionCount,
  };
}

export function toWinningEntry(entry: Pick<WinningEntryEntity, 'series' | 'number'>): WinningEntry {
  return { series: entry.series, number: entry.number };
}

export function toFirstPrizeSummary(rows: FirstPrizeRows): FirstPrizeSummary {
  return {
    categoryCode: rows.ruleCategory.code,
    label: { en: rows.ruleCategory.labelEn, ml: rows.ruleCategory.labelMl },
    state: rows.revisionCategory.state,
    amountMinor: rows.revisionCategory.amountMinor,
    currency: 'INR',
    entries: rows.entries.map(toWinningEntry),
  };
}

export function toLotterySummary(lottery: LotteryEntity): LotterySummary {
  return {
    id: lottery.id,
    code: lottery.code,
    slug: lottery.slug,
    name: { en: lottery.nameEn, ml: lottery.nameMl },
    active: lottery.active,
    archiveCoverage: lottery.archiveCoverage,
  };
}

/**
 * Published labels come from the revision's reviewed snapshot (LLD §6); an
 * unpublished draw uses its scheduling row. Dates stay `YYYY-MM-DD` strings.
 */
export function toDrawSummary(rows: DrawSummaryRows): DrawSummary {
  const { draw, lottery, currentRevision } = rows;
  const visible = payloadVisible(draw, currentRevision);
  const dates = visible
    ? currentRevision.drawSnapshot
    : { drawCode: draw.drawCode, scheduledDate: draw.scheduledDate, actualDate: draw.actualDate, scheduledAt: toIso(draw.scheduledAt), actualAt: toIso(draw.actualAt) };
  const displayDate = dates.actualDate ?? dates.scheduledDate;
  if (!displayDate) throw new Error(`Draw ${draw.id} has neither an actual nor a scheduled date`);
  return {
    id: draw.id,
    lotteryId: lottery.id,
    lotteryCode: lottery.code,
    lotterySlug: lottery.slug,
    lotteryName: { en: lottery.nameEn, ml: lottery.nameMl },
    drawCode: dates.drawCode,
    scheduledDate: dates.scheduledDate,
    actualDate: dates.actualDate,
    displayDate,
    scheduledAt: dates.scheduledAt ? toIso(dates.scheduledAt) : null,
    actualAt: dates.actualAt ? toIso(dates.actualAt) : null,
    phase: draw.phase,
    visibility: draw.visibility,
    publicationStatus: derivePublicationStatus(draw, currentRevision),
    currentRevision: visible ? toRevisionSummary(currentRevision, rows.supersededRevisionCount) : null,
    firstPrize: visible && rows.firstPrize ? toFirstPrizeSummary(rows.firstPrize) : null,
  };
}

export function deriveCheckingCapability(
  draw: Pick<DrawEntity, 'phase' | 'visibility'>,
  revision: ResultRevisionEntity | null,
  ruleVersion: Pick<RuleVersionEntity, 'id' | 'state'> | null,
  ruleCompiles: boolean,
): CheckingCapability {
  if (draw.phase === 'CANCELLED') return { capability: 'NOT_APPLICABLE', ruleVersionId: null, reasonCode: 'DRAW_CANCELLED' };
  if (draw.visibility === 'SUSPENDED') return { capability: 'NOT_APPLICABLE', ruleVersionId: null, reasonCode: 'RESULT_SUSPENDED' };
  if (!revision || revision.workflowState !== 'PUBLISHED') return { capability: 'NOT_APPLICABLE', ruleVersionId: null, reasonCode: 'NO_PUBLISHED_RESULT' };
  if (!ruleVersion) return { capability: 'UNSUPPORTED', ruleVersionId: null, reasonCode: 'RULE_NOT_APPROVED' };
  if (ruleVersion.state === 'REVOKED') return { capability: 'UNSUPPORTED', ruleVersionId: ruleVersion.id, reasonCode: 'RULE_REVOKED' };
  if (ruleVersion.state !== 'APPROVED') return { capability: 'UNSUPPORTED', ruleVersionId: ruleVersion.id, reasonCode: 'RULE_NOT_APPROVED' };
  if (!ruleCompiles) return { capability: 'UNSUPPORTED', ruleVersionId: ruleVersion.id, reasonCode: 'RULE_NOT_COMPILABLE' };
  return { capability: 'SUPPORTED', ruleVersionId: ruleVersion.id, reasonCode: null };
}

export function toMatchSpec(category: RuleCategoryEntity): MatchSpec {
  if (category.matchKind === 'SUFFIX') {
    return { kind: 'SUFFIX', seriesPolicy: 'ANY_ALLOWED', suffixLength: category.suffixLength ?? 0 };
  }
  return { kind: 'FULL_NUMBER', seriesPolicy: category.seriesPolicy };
}

export function toCategoryResult(ruleCategory: RuleCategoryEntity, revisionCategory: RevisionCategoryEntity, entryCount: number): CategoryResult {
  return {
    code: ruleCategory.code,
    label: { en: ruleCategory.labelEn, ml: ruleCategory.labelMl },
    priority: ruleCategory.priority,
    metricRole: ruleCategory.metricRole,
    state: revisionCategory.state,
    amountMinor: revisionCategory.amountMinor,
    currency: 'INR',
    match: toMatchSpec(ruleCategory),
    expectedEntryCount: ruleCategory.expectedEntryCount,
    entryCount,
    sourceReviewedAt: toIso(revisionCategory.sourceReviewedAt),
  };
}

export function toSourceReference(evidence: SourceEvidenceEntity): SourceReference {
  return {
    kind: evidence.kind,
    title: evidence.title,
    // Synthetic fixtures never carry a URL (also enforced by a DB constraint).
    url: evidence.kind === 'SYNTHETIC_FIXTURE' ? null : evidence.url,
    reviewedAt: toIso(evidence.reviewedAt),
  };
}

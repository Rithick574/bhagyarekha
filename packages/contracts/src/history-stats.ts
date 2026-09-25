import { z } from 'zod';
import { CategoryCodeSchema, DigitStringSchema, InstantSchema, LocalDateSchema, LocalizedTextSchema, PageSchema, PageSizeSchema, SeriesSchema, UuidSchema } from './common.js';
import { ArchiveCoverageSchema, DataModeSchema, PublicationStatusSchema } from './enums.js';

// ---------------------------------------------------------------------------
// History search (POST — the searched number never enters a URL or log)
// ---------------------------------------------------------------------------

export const HistorySearchTypeSchema = z.enum(['FULL', 'SUFFIX']);

export const HistorySearchRequestSchema = z
  .strictObject({
    lotteryId: UuidSchema.optional(),
    /** Inclusive IST dates. Defaults to the last 366 days when omitted; the span may not exceed 366 days. */
    from: LocalDateSchema.optional(),
    to: LocalDateSchema.optional(),
    searchType: HistorySearchTypeSchema,
    /** Digits as printed. FULL compares whole numbers; SUFFIX compares the ending (and suffix-category entries of that exact length). */
    number: DigitStringSchema,
    page: PageSchema,
    pageSize: PageSizeSchema,
  })
  .refine((q) => !(q.from && q.to) || q.from <= q.to, { message: 'from must not be after to', path: ['from'] });
export type HistorySearchRequest = z.infer<typeof HistorySearchRequestSchema>;

export const HistorySearchItemSchema = z.object({
  drawId: UuidSchema,
  drawCode: z.string(),
  lotteryId: UuidSchema,
  lotteryName: LocalizedTextSchema,
  displayDate: LocalDateSchema,
  publicationStatus: PublicationStatusSchema,
  revisionNo: z.number().int(),
  categoryCode: CategoryCodeSchema,
  categoryLabel: LocalizedTextSchema,
  series: SeriesSchema,
  number: DigitStringSchema,
});
export type HistorySearchItem = z.infer<typeof HistorySearchItemSchema>;

export const HistorySearchResponseSchema = z.object({
  dataMode: DataModeSchema,
  /** The effective inclusive range actually searched. */
  from: LocalDateSchema,
  to: LocalDateSchema,
  searchType: HistorySearchTypeSchema,
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  items: z.array(HistorySearchItemSchema),
  /** Draws in range that could not be searched (no current visible revision). "Not found" never means "did not win" for these. */
  unsearchableDrawCount: z.number().int(),
});
export type HistorySearchResponse = z.infer<typeof HistorySearchResponseSchema>;

// ---------------------------------------------------------------------------
// Descriptive statistics
// ---------------------------------------------------------------------------

export const StatisticsQuerySchema = z
  .strictObject({
    lotteryId: UuidSchema,
    from: LocalDateSchema,
    to: LocalDateSchema,
    metric: z.literal('FIRST_PRIZE').default('FIRST_PRIZE'),
    /** Required when the range mixes rule versions with different number lengths. */
    ruleVersionId: UuidSchema.optional(),
  })
  .refine((q) => q.from <= q.to, { message: 'from must not be after to', path: ['from'] })
  .refine((q) => spanDays(q.from, q.to) <= 366, { message: 'Range may not exceed 366 days', path: ['to'] });
export type StatisticsQuery = z.infer<typeof StatisticsQuerySchema>;

export function spanDays(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000) + 1;
}

export const ExclusionReasonSchema = z.enum(['NOT_PUBLISHED', 'SUSPENDED', 'CANCELLED', 'FIRST_PRIZE_INCOMPLETE', 'RULE_UNSUPPORTED', 'INCOMPATIBLE_RULE_VERSION']);

export const StatisticsScopeSchema = z.object({
  lotteryId: UuidSchema,
  lotteryName: LocalizedTextSchema,
  from: LocalDateSchema,
  to: LocalDateSchema,
  metric: z.literal('FIRST_PRIZE'),
  observationUnit: z.literal('FIRST_PRIZE_ENTRY'),
  /** Category codes whose entries were counted (metricRole FIRST_PRIZE). */
  categoryCodes: z.array(CategoryCodeSchema),
  numberLength: z.number().int().nullable(),
  /** Draws that contributed at least one observation. */
  drawCount: z.number().int(),
  /** Distinct eligible first-prize entries (draw + category + series + number). */
  observationCount: z.number().int(),
  /** Draws recorded in the range, eligible or not. Not "every draw that happened". */
  knownDrawCount: z.number().int(),
  excludedDrawCounts: z.record(ExclusionReasonSchema, z.number().int()),
  ruleVersionIds: z.array(UuidSchema),
  /** Rule versions present in the range but excluded because their number domain differs. */
  incompatibleRuleVersionIds: z.array(UuidSchema),
  calendarCoverage: ArchiveCoverageSchema,
  datasetVersion: z.string(),
  computedAt: InstantSchema,
  dataMode: DataModeSchema,
});
export type StatisticsScope = z.infer<typeof StatisticsScopeSchema>;

const Share = z.number().min(0).max(1).nullable();

export const CountShareSchema = z.object({ key: z.string(), count: z.number().int(), share: Share });

export const StatisticsResponseSchema = z.object({
  scope: StatisticsScopeSchema,
  /** counts[position][digit]; each position sums to observationCount. Position 0 is the leftmost digit. */
  positionDigitCounts: z.array(z.array(z.number().int())),
  /** Last two / last three digits as strings with historical share count/N. Sorted by count desc, then key. Bounded to the top 50. */
  lastTwo: z.object({ distinct: z.number().int(), top: z.array(CountShareSchema) }),
  lastThree: z.object({ distinct: z.number().int(), top: z.array(CountShareSchema) }),
  repeated: z.object({
    distinctNumbers: z.number().int(),
    distinctTickets: z.number().int(),
    /** Sum over groups of c*(c-1)/2 — pairs of observations sharing the same full number string. */
    numberCollisionPairs: z.number().int(),
    ticketCollisionPairs: z.number().int(),
    repeatedNumbers: z.array(CountShareSchema),
  }),
  parity: z.object({ odd: z.number().int(), even: z.number().int(), oddShare: Share }),
  digitSum: z.object({ min: z.number().int().nullable(), max: z.number().int().nullable(), mean: z.number().nullable(), distribution: z.array(CountShareSchema) }),
  duplicateDigits: z.object({ count: z.number().int(), share: Share }),
  adjacentEqualDigits: z.object({ count: z.number().int(), share: Share }),
  /** Numbers containing at least one run of ≥3 adjacent digits stepping +1 or −1, no 9→0 wraparound. Counted once per number. */
  consecutiveRuns: z.object({ count: z.number().int(), share: Share }),
  /** Plain-language notes the UI must show verbatim (definitions, exclusions, non-predictive statement). */
  notes: z.array(z.string()),
});
export type StatisticsResponse = z.infer<typeof StatisticsResponseSchema>;

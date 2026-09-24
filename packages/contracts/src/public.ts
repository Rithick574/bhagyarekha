import { z } from 'zod';
import {
  CategoryCodeSchema,
  CurrencySchema,
  DigitStringSchema,
  InstantSchema,
  LocalDateSchema,
  LocalizedTextSchema,
  MinorAmountSchema,
  PageSchema,
  PageSizeSchema,
  SeriesSchema,
  UuidSchema,
} from './common.js';
import {
  ArchiveCoverageSchema,
  CategoryStateSchema,
  CheckCapabilitySchema,
  CompletenessSchema,
  DataModeSchema,
  DrawPhaseSchema,
  EvidenceKindSchema,
  MetricRoleSchema,
  PublicationKindSchema,
  PublicationStatusSchema,
  RuleStateSchema,
  VisibilitySchema,
} from './enums.js';
import { MatchSpecSchema } from './rules.js';

// ---------------------------------------------------------------------------
// Shared fragments
// ---------------------------------------------------------------------------

export const SourceReferenceSchema = z.object({
  kind: EvidenceKindSchema,
  title: z.string().min(1),
  /** HTTPS link supplied by an operator, or null. The server never fetches it. */
  url: z.url({ protocol: /^https$/ }).nullable(),
  /** When this application's operator reviewed the source. Not an official certification. */
  reviewedAt: InstantSchema.nullable(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

export const LotterySummarySchema = z.object({
  id: UuidSchema,
  code: z.string().min(1),
  slug: z.string().min(1),
  name: LocalizedTextSchema,
  active: z.boolean(),
  archiveCoverage: ArchiveCoverageSchema,
});
export type LotterySummary = z.infer<typeof LotterySummarySchema>;

export const RevisionSummarySchema = z.object({
  id: UuidSchema,
  revisionNo: z.number().int().min(1),
  publicationKind: PublicationKindSchema,
  completeness: CompletenessSchema,
  publishedAt: InstantSchema,
  /** True when this revision was published as a CORRECTION of an earlier one. */
  isCorrection: z.boolean(),
  correctionReason: z.string().nullable(),
  /** Number of earlier published revisions that this one supersedes. */
  supersededRevisionCount: z.number().int().min(0),
});
export type RevisionSummary = z.infer<typeof RevisionSummarySchema>;

export const WinningEntrySchema = z.object({
  /** Empty string when the category does not use a series. */
  series: SeriesSchema,
  number: DigitStringSchema,
});
export type WinningEntry = z.infer<typeof WinningEntrySchema>;

export const FirstPrizeSummarySchema = z.object({
  categoryCode: CategoryCodeSchema,
  label: LocalizedTextSchema,
  state: CategoryStateSchema,
  amountMinor: MinorAmountSchema.nullable(),
  currency: CurrencySchema,
  entries: z.array(WinningEntrySchema),
});
export type FirstPrizeSummary = z.infer<typeof FirstPrizeSummarySchema>;

export const DrawSummarySchema = z.object({
  id: UuidSchema,
  lotteryId: UuidSchema,
  lotteryCode: z.string().min(1),
  lotterySlug: z.string().min(1),
  lotteryName: LocalizedTextSchema,
  drawCode: z.string().min(1),
  scheduledDate: LocalDateSchema.nullable(),
  actualDate: LocalDateSchema.nullable(),
  /** actualDate when known, otherwise scheduledDate. Used for ordering and headings. */
  displayDate: LocalDateSchema,
  scheduledAt: InstantSchema.nullable(),
  actualAt: InstantSchema.nullable(),
  phase: DrawPhaseSchema,
  visibility: VisibilitySchema,
  publicationStatus: PublicationStatusSchema,
  /** Null when nothing is published or when visibility is SUSPENDED (payload withheld). */
  currentRevision: RevisionSummarySchema.nullable(),
  /** Null when nothing is published, withheld, or the rule has no FIRST_PRIZE category. */
  firstPrize: FirstPrizeSummarySchema.nullable(),
});
export type DrawSummary = z.infer<typeof DrawSummarySchema>;

export const CheckingCapabilitySchema = z.object({
  capability: CheckCapabilitySchema,
  ruleVersionId: UuidSchema.nullable(),
  /** Machine-readable reason when capability is not SUPPORTED. */
  reasonCode: z
    .enum(['NO_PUBLISHED_RESULT', 'RESULT_SUSPENDED', 'DRAW_CANCELLED', 'RULE_NOT_APPROVED', 'RULE_REVOKED', 'RULE_NOT_COMPILABLE', 'CHECKER_NOT_AVAILABLE'])
    .nullable(),
});
export type CheckingCapability = z.infer<typeof CheckingCapabilitySchema>;

/** Form hint only: the server re-validates against the checked revision's rule. */
export const TicketFormatSchema = z.object({
  ruleVersionId: UuidSchema,
  numberLength: z.number().int().min(1).max(12),
  /** Empty array means the configured rules use no series. */
  allowedSeries: z.array(z.string()),
});
export type TicketFormat = z.infer<typeof TicketFormatSchema>;

export const DrawDetailSchema = DrawSummarySchema.extend({
  dataMode: DataModeSchema,
  checking: CheckingCapabilitySchema,
  sources: z.array(SourceReferenceSchema),
  /** From the current visible revision's rule, else the lottery's latest approved rule, else null. */
  ticketFormat: TicketFormatSchema.nullable(),
});
export type DrawDetail = z.infer<typeof DrawDetailSchema>;

export const CategoryResultSchema = z.object({
  code: CategoryCodeSchema,
  label: LocalizedTextSchema,
  priority: z.number().int().min(1),
  metricRole: MetricRoleSchema,
  state: CategoryStateSchema,
  amountMinor: MinorAmountSchema.nullable(),
  currency: CurrencySchema,
  match: MatchSpecSchema,
  expectedEntryCount: z.number().int().min(0).nullable(),
  entryCount: z.number().int().min(0),
  sourceReviewedAt: InstantSchema.nullable(),
});
export type CategoryResult = z.infer<typeof CategoryResultSchema>;

export const CategoryEntriesPageSchema = z.object({
  categoryCode: CategoryCodeSchema,
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  items: z.array(WinningEntrySchema),
});
export type CategoryEntriesPage = z.infer<typeof CategoryEntriesPageSchema>;

export const ResultRuleSummarySchema = z.object({
  ruleVersionId: UuidSchema,
  ruleVersion: z.number().int().min(1),
  state: RuleStateSchema,
  numberLength: z.number().int().min(1).max(12),
  allowedSeries: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export const LotteryListQuerySchema = z.strictObject({
  active: z.enum(['true', 'false']).optional(),
});
export type LotteryListQuery = z.infer<typeof LotteryListQuerySchema>;

export const DrawListQuerySchema = z
  .strictObject({
    lotteryId: UuidSchema.optional(),
    from: LocalDateSchema.optional(),
    to: LocalDateSchema.optional(),
    page: PageSchema,
    pageSize: PageSizeSchema,
  })
  .refine((q) => !(q.from && q.to) || q.from <= q.to, { message: 'from must not be after to', path: ['from'] });
export type DrawListQuery = z.infer<typeof DrawListQuerySchema>;

export const LatestQuerySchema = z.strictObject({
  lotteryId: UuidSchema.optional(),
});
export type LatestQuery = z.infer<typeof LatestQuerySchema>;

export const DrawIdParamsSchema = z.strictObject({
  drawId: UuidSchema,
});
export type DrawIdParams = z.infer<typeof DrawIdParamsSchema>;

export const ResultQuerySchema = z.strictObject({
  categoryCode: CategoryCodeSchema.optional(),
  page: PageSchema,
  pageSize: PageSizeSchema,
  /** When supplied and no longer current, the API answers 409 RESULT_CHANGED. */
  revisionId: UuidSchema.optional(),
});
export type ResultQuery = z.infer<typeof ResultQuerySchema>;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

export const LotteryListResponseSchema = z.object({
  dataMode: DataModeSchema,
  items: z.array(LotterySummarySchema),
});
export type LotteryListResponse = z.infer<typeof LotteryListResponseSchema>;

export const DrawListResponseSchema = z.object({
  dataMode: DataModeSchema,
  items: z.array(DrawSummarySchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
});
export type DrawListResponse = z.infer<typeof DrawListResponseSchema>;

export const LatestResponseSchema = z.object({
  dataMode: DataModeSchema,
  /** Most recent draw (by display date) with an ACTIVE published revision, or null. */
  latestPublished: DrawSummarySchema.nullable(),
  /** Earliest known upcoming or awaiting draw without a published result, or null. Never a countdown. */
  pendingDraw: DrawSummarySchema.nullable(),
  /** IST calendar date the server used to decide what counts as pending. */
  asOfDate: LocalDateSchema,
});
export type LatestResponse = z.infer<typeof LatestResponseSchema>;

export const ResultResponseSchema = z.object({
  dataMode: DataModeSchema,
  draw: DrawSummarySchema,
  revision: RevisionSummarySchema,
  rule: ResultRuleSummarySchema,
  checking: CheckingCapabilitySchema,
  sources: z.array(SourceReferenceSchema),
  /** Every configured category, in priority order, with completeness. */
  categories: z.array(CategoryResultSchema),
  /** Page 1 for every category when categoryCode is omitted; exactly one page otherwise. */
  entries: z.array(CategoryEntriesPageSchema),
});
export type ResultResponse = z.infer<typeof ResultResponseSchema>;

export const HealthLiveResponseSchema = z.object({
  status: z.literal('ok'),
});
export type HealthLiveResponse = z.infer<typeof HealthLiveResponseSchema>;

export const HealthReadyResponseSchema = z.object({
  status: z.enum(['ok', 'fail']),
  dataMode: DataModeSchema.nullable(),
  checks: z.object({
    database: z.enum(['ok', 'fail']),
    migrations: z.enum(['ok', 'pending', 'fail']),
    dataMode: z.enum(['ok', 'mismatch', 'uninitialized', 'fail']),
  }),
});
export type HealthReadyResponse = z.infer<typeof HealthReadyResponseSchema>;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export const ErrorCodeSchema = z.enum([
  'INVALID_INPUT',
  'INVALID_SERIES',
  'INVALID_NUMBER_LENGTH',
  'DRAW_MISMATCH',
  'DRAW_NOT_FOUND',
  'LOTTERY_NOT_FOUND',
  'CATEGORY_NOT_FOUND',
  'RESULT_NOT_PUBLISHED',
  'RESULT_SUSPENDED',
  'RESULT_CHANGED',
  'REVISION_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'CSRF_FAILED',
  'IMPORT_TOO_LARGE',
  'RATE_LIMITED',
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'RESULT_UNAVAILABLE',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const FieldErrorSchema = z.object({
  /** Dot-separated path within body/query/params. Never contains the submitted value. */
  path: z.string(),
  code: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    /** English developer-facing message. The web maps `code` to localized text. */
    message: z.string(),
    fields: z.array(FieldErrorSchema).optional(),
  }),
  requestId: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

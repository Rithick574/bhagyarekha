import { z } from 'zod';
import {
  CategoryCodeSchema,
  DigitStringSchema,
  InstantSchema,
  LocalDateSchema,
  LocalizedTextSchema,
  MinorAmountSchema,
  PageSchema,
  SeriesSchema,
  UuidSchema,
} from './common.js';
import {
  CategoryStateSchema,
  CompletenessSchema,
  DataModeSchema,
  DrawPhaseSchema,
  EvidenceKindSchema,
  PublicationKindSchema,
  RevisionStateSchema,
  RuleStateSchema,
  VisibilitySchema,
} from './enums.js';
import { RuleSetV1Schema } from './rules.js';

// ---------------------------------------------------------------------------
// Auth & sessions
// ---------------------------------------------------------------------------

export const AdminRoleSchema = z.enum(['EDITOR', 'PUBLISHER']);
export type AdminRole = z.infer<typeof AdminRoleSchema>;

export const LoginRequestSchema = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(1024),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AdminUserSummarySchema = z.object({
  id: UuidSchema,
  email: z.string(),
  role: AdminRoleSchema,
});

/** Returned by login and GET /auth/session. The CSRF token is held in memory by the web, never stored. */
export const SessionResponseSchema = z.object({
  user: AdminUserSummarySchema,
  csrfToken: z.string().min(16),
  idleExpiresAt: InstantSchema,
  absoluteExpiresAt: InstantSchema,
  dataMode: DataModeSchema,
  allowSelfReview: z.boolean(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

export const CSRF_HEADER = 'x-csrf-token';
export const IDEMPOTENCY_HEADER = 'idempotency-key';
export const IF_MATCH_HEADER = 'if-match';

// ---------------------------------------------------------------------------
// Catalog administration
// ---------------------------------------------------------------------------

export const CreateLotteryRequestSchema = z.strictObject({
  code: z.string().regex(/^[A-Z0-9_]{1,32}$/),
  slug: z.string().regex(/^[a-z0-9-]{1,64}$/),
  name: LocalizedTextSchema,
  active: z.boolean().default(true),
});
export type CreateLotteryRequest = z.infer<typeof CreateLotteryRequestSchema>;

export const PatchLotteryRequestSchema = z.strictObject({
  name: LocalizedTextSchema.optional(),
  active: z.boolean().optional(),
  slug: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),
});
export type PatchLotteryRequest = z.infer<typeof PatchLotteryRequestSchema>;

export const AdminLotterySchema = z.object({
  id: UuidSchema,
  code: z.string(),
  slug: z.string(),
  name: LocalizedTextSchema,
  active: z.boolean(),
  datasetVersion: z.string(),
  editVersion: z.number().int(),
});
export type AdminLottery = z.infer<typeof AdminLotterySchema>;

const DrawDatesSchema = z.strictObject({
  scheduledDate: LocalDateSchema.nullable(),
  actualDate: LocalDateSchema.nullable(),
  /** Instants must agree with their local date in Asia/Kolkata (database-enforced). Never synthesise midnight. */
  scheduledAt: InstantSchema.nullable(),
  actualAt: InstantSchema.nullable(),
});

export const CreateDrawRequestSchema = z
  .strictObject({
    lotteryId: UuidSchema,
    drawCode: z.string().regex(/^[A-Za-z0-9_.-]{1,32}$/),
    phase: DrawPhaseSchema.default('SCHEDULED'),
  })
  .extend(DrawDatesSchema.shape)
  .refine((d) => d.scheduledDate !== null || d.actualDate !== null, { message: 'At least one local date is required', path: ['scheduledDate'] });
export type CreateDrawRequest = z.infer<typeof CreateDrawRequestSchema>;

/** Identity (lottery, drawCode) is never patched; once published, dates change only via a correction snapshot. */
export const PatchDrawRequestSchema = z
  .strictObject({ phase: DrawPhaseSchema.optional() })
  .extend(DrawDatesSchema.partial().shape);
export type PatchDrawRequest = z.infer<typeof PatchDrawRequestSchema>;

export const AdminDrawSchema = z.object({
  id: UuidSchema,
  lotteryId: UuidSchema,
  lotteryCode: z.string(),
  drawCode: z.string(),
  scheduledDate: LocalDateSchema.nullable(),
  actualDate: LocalDateSchema.nullable(),
  scheduledAt: InstantSchema.nullable(),
  actualAt: InstantSchema.nullable(),
  phase: DrawPhaseSchema,
  visibility: VisibilitySchema,
  suspensionReason: z.string().nullable(),
  currentRevisionId: UuidSchema.nullable(),
  nextRevisionNo: z.number().int(),
  editVersion: z.number().int(),
});
export type AdminDraw = z.infer<typeof AdminDrawSchema>;

export const SourceInputSchema = z.strictObject({
  kind: EvidenceKindSchema,
  title: z.string().trim().min(1).max(200),
  /** HTTPS only, no credentials. The server never fetches it. */
  url: z.url({ protocol: /^https$/ }).max(2048).nullable().default(null),
  documentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable().default(null),
  acquiredAt: InstantSchema.nullable().default(null),
  note: z.string().trim().max(1000).nullable().default(null),
});
export type SourceInput = z.infer<typeof SourceInputSchema>;

export const CreateRuleVersionRequestSchema = z.strictObject({
  ruleSet: RuleSetV1Schema,
  source: SourceInputSchema,
});
export type CreateRuleVersionRequest = z.infer<typeof CreateRuleVersionRequestSchema>;

export const ApproveRuleRequestSchema = z.strictObject({
  note: z.string().trim().min(1).max(1000),
});
export const RevokeRuleRequestSchema = z.strictObject({
  reason: z.string().trim().min(1).max(1000),
});

export const AdminRuleVersionSchema = z.object({
  id: UuidSchema,
  lotteryId: UuidSchema,
  version: z.number().int(),
  state: RuleStateSchema,
  numberLength: z.number().int(),
  allowedSeries: z.array(z.string()),
  contentHash: z.string(),
  compiles: z.boolean(),
  compileErrors: z.array(z.object({ code: z.string(), path: z.string(), message: z.string() })),
  ruleSet: RuleSetV1Schema.nullable(),
  approvedAt: InstantSchema.nullable(),
  revokedAt: InstantSchema.nullable(),
  revocationReason: z.string().nullable(),
  editVersion: z.number().int(),
});
export type AdminRuleVersion = z.infer<typeof AdminRuleVersionSchema>;

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

export const ImportCategoryManifestSchema = z.strictObject({
  code: CategoryCodeSchema,
  state: CategoryStateSchema,
  amountMinor: MinorAmountSchema.nullable(),
});

/**
 * Every import states its intent explicitly. Completeness is never inferred
 * from row counts; business codes are resolved to existing catalog rows and
 * can never create or rename them.
 */
export const ImportManifestSchema = z
  .strictObject({
    lotteryCode: z.string().regex(/^[A-Z0-9_]{1,32}$/),
    drawCode: z.string().regex(/^[A-Za-z0-9_.-]{1,32}$/),
    ruleVersion: z.number().int().min(1),
    publicationKind: PublicationKindSchema,
    correctionReason: z.string().trim().min(1).max(1000).nullable().default(null),
    completeness: CompletenessSchema,
    categories: z.array(ImportCategoryManifestSchema).min(1),
    source: SourceInputSchema,
  })
  .refine((m) => m.publicationKind !== 'CORRECTION' || m.correctionReason !== null, { message: 'A correction requires a reason', path: ['correctionReason'] })
  .refine((m) => new Set(m.categories.map((c) => c.code)).size === m.categories.length, { message: 'Duplicate category code in manifest', path: ['categories'] });
export type ImportManifest = z.infer<typeof ImportManifestSchema>;

export const ImportEntrySchema = z.strictObject({
  categoryCode: CategoryCodeSchema,
  series: SeriesSchema,
  number: DigitStringSchema,
});
export type ImportEntry = z.infer<typeof ImportEntrySchema>;

/**
 * JSON envelope for both formats. `csv` carries the raw file text (header
 * `categoryCode,series,number`) so no multipart parser is needed; the byte
 * limit applies to the whole envelope. Rows are always strings.
 */
export const ImportRequestSchema = z.discriminatedUnion('format', [
  z.strictObject({ format: z.literal('json'), manifest: ImportManifestSchema, entries: z.array(z.unknown()).max(20_000) }),
  z.strictObject({ format: z.literal('csv'), manifest: ImportManifestSchema, csv: z.string().max(2 * 1024 * 1024) }),
]);
export type ImportRequest = z.infer<typeof ImportRequestSchema>;

export const ImportStatusSchema = z.enum(['VALIDATION_FAILED', 'PREVIEW_READY', 'DRAFT_CREATED']);

export const ImportRowErrorSchema = z.object({
  /** 1-based source row (CSV line or JSON array index + 1); 0 for manifest-level errors. */
  row: z.number().int().min(0),
  path: z.string(),
  code: z.string(),
  message: z.string(),
});
export type ImportRowError = z.infer<typeof ImportRowErrorSchema>;

export const ImportPreviewRowSchema = z.object({
  row: z.number().int().min(1),
  categoryCode: z.string(),
  series: z.string(),
  number: z.string(),
});

export const ImportPreviewSchema = z.object({
  id: UuidSchema,
  status: ImportStatusSchema,
  dataMode: DataModeSchema,
  drawId: UuidSchema.nullable(),
  ruleVersionId: UuidSchema.nullable(),
  manifest: ImportManifestSchema,
  uploadSha256: z.string(),
  createdAt: InstantSchema,
  createdRevisionId: UuidSchema.nullable(),
  summary: z.object({
    totalRows: z.number().int(),
    validRows: z.number().int(),
    errorCount: z.number().int(),
    rowsPerCategory: z.record(z.string(), z.number().int()),
  }),
  errors: z.object({ page: z.number().int(), pageSize: z.number().int(), total: z.number().int(), items: z.array(ImportRowErrorSchema) }),
  rows: z.object({ page: z.number().int(), pageSize: z.number().int(), total: z.number().int(), items: z.array(ImportPreviewRowSchema) }),
});
export type ImportPreview = z.infer<typeof ImportPreviewSchema>;

export const ImportPreviewQuerySchema = z.strictObject({
  errorsPage: PageSchema,
  rowsPage: PageSchema,
});

// ---------------------------------------------------------------------------
// Revisions, review, publication
// ---------------------------------------------------------------------------

export const AdminRevisionCategorySchema = z.object({
  code: CategoryCodeSchema,
  label: LocalizedTextSchema,
  priority: z.number().int(),
  state: CategoryStateSchema,
  amountMinor: MinorAmountSchema.nullable(),
  expectedEntryCount: z.number().int().nullable(),
  entryCount: z.number().int(),
  sourceReviewedAt: InstantSchema.nullable(),
});

export const AdminEvidenceSchema = z.object({
  id: UuidSchema,
  kind: EvidenceKindSchema,
  title: z.string(),
  url: z.string().nullable(),
  documentHash: z.string().nullable(),
  reviewedAt: InstantSchema.nullable(),
  reviewedBy: UuidSchema.nullable(),
  note: z.string().nullable(),
});

export const AdminRevisionSchema = z.object({
  id: UuidSchema,
  drawId: UuidSchema,
  lotteryId: UuidSchema,
  lotteryCode: z.string(),
  drawCode: z.string(),
  ruleVersionId: UuidSchema,
  ruleState: RuleStateSchema,
  revisionNo: z.number().int(),
  workflowState: RevisionStateSchema,
  publicationKind: PublicationKindSchema,
  completeness: CompletenessSchema,
  basedOnRevisionId: UuidSchema.nullable(),
  correctionReason: z.string().nullable(),
  drawSnapshot: z.object({
    drawCode: z.string(),
    scheduledDate: LocalDateSchema.nullable(),
    actualDate: LocalDateSchema.nullable(),
    scheduledAt: InstantSchema.nullable(),
    actualAt: InstantSchema.nullable(),
  }),
  contentHash: z.string(),
  reviewedHash: z.string().nullable(),
  reviewedAt: InstantSchema.nullable(),
  reviewedBy: UuidSchema.nullable(),
  publishedAt: InstantSchema.nullable(),
  publishedBy: UuidSchema.nullable(),
  createdBy: UuidSchema.nullable(),
  editVersion: z.number().int(),
  isCurrent: z.boolean(),
  drawCurrentRevisionId: UuidSchema.nullable(),
  drawEditVersion: z.number().int(),
  drawVisibility: VisibilitySchema,
  categories: z.array(AdminRevisionCategorySchema),
  evidence: z.array(AdminEvidenceSchema),
  dataMode: DataModeSchema,
});
export type AdminRevision = z.infer<typeof AdminRevisionSchema>;

export const AdminRevisionEntriesQuerySchema = z.strictObject({
  categoryCode: CategoryCodeSchema,
  page: PageSchema,
});
export const AdminRevisionEntriesSchema = z.object({
  categoryCode: CategoryCodeSchema,
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  items: z.array(z.object({ series: SeriesSchema, number: DigitStringSchema, sourceRow: z.number().int().nullable() })),
});

/** DRAFT-only edits, guarded by If-Match: <editVersion>. Any edit clears review metadata. */
export const PatchRevisionRequestSchema = z
  .strictObject({
    completeness: CompletenessSchema.optional(),
    correctionReason: z.string().trim().min(1).max(1000).optional(),
    categories: z.array(ImportCategoryManifestSchema).optional(),
    /** Replaces ALL entries of the listed categories. Rows are strings; nothing is inferred. */
    replaceEntries: z.array(z.strictObject({ categoryCode: CategoryCodeSchema, entries: z.array(ImportEntrySchema.omit({ categoryCode: true })).max(20_000) })).optional(),
    drawSnapshot: DrawDatesSchema.partial().optional(),
  })
  .refine((p) => Object.keys(p).length > 0, { message: 'Nothing to change' });
export type PatchRevisionRequest = z.infer<typeof PatchRevisionRequestSchema>;

export const ReviewRevisionRequestSchema = z.strictObject({
  /** Required when the reviewer is also the latest editor and ALLOW_SELF_REVIEW is enabled. */
  confirmSelfReview: z.boolean().default(false),
  note: z.string().trim().max(1000).nullable().default(null),
});
export type ReviewRevisionRequest = z.infer<typeof ReviewRevisionRequestSchema>;

export const PublishRevisionRequestSchema = z.strictObject({
  expectedEditVersion: z.number().int().min(1),
  /** What the publisher believes is current. Null when publishing the first revision. */
  expectedCurrentRevisionId: UuidSchema.nullable(),
  /** Reactivate a suspended draw as part of publishing (explicit, audited). */
  reactivate: z.boolean().default(false),
});
export type PublishRevisionRequest = z.infer<typeof PublishRevisionRequestSchema>;

export const PublishResultSchema = z.object({
  publicationId: z.string(),
  revisionId: UuidSchema,
  drawId: UuidSchema,
  supersededRevisionId: UuidSchema.nullable(),
  datasetVersion: z.string(),
  publishedAt: InstantSchema,
  /** True when this response is an idempotent replay of an earlier publication. */
  replayed: z.boolean(),
  isStillCurrent: z.boolean(),
});
export type PublishResult = z.infer<typeof PublishResultSchema>;

export const SuspendDrawRequestSchema = z.strictObject({
  reason: z.string().trim().min(1).max(1000),
  expectedEditVersion: z.number().int().min(1),
});
export const ResumeDrawRequestSchema = SuspendDrawRequestSchema;

export const CreateCorrectionRequestSchema = z.strictObject({
  reason: z.string().trim().min(1).max(1000),
  source: SourceInputSchema,
});
export type CreateCorrectionRequest = z.infer<typeof CreateCorrectionRequestSchema>;

export const AdminDrawListQuerySchema = z.strictObject({
  lotteryId: UuidSchema.optional(),
  page: PageSchema,
});

export const AuditEventSchema = z.object({
  id: z.string(),
  actorId: UuidSchema.nullable(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  createdAt: InstantSchema,
  beforeHash: z.string().nullable(),
  afterHash: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  requestId: z.string().nullable(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const AuditListSchema = z.object({ items: z.array(AuditEventSchema) });

export const AdminRevisionListItemSchema = z.object({
  id: UuidSchema,
  drawId: UuidSchema,
  drawCode: z.string(),
  lotteryCode: z.string(),
  revisionNo: z.number().int(),
  workflowState: RevisionStateSchema,
  publicationKind: PublicationKindSchema,
  completeness: CompletenessSchema,
  updatedAt: InstantSchema,
  isCurrent: z.boolean(),
});
export const AdminRevisionListSchema = z.object({ items: z.array(AdminRevisionListItemSchema) });
export const AdminRevisionListQuerySchema = z.strictObject({
  state: RevisionStateSchema.optional(),
  drawId: UuidSchema.optional(),
  page: PageSchema,
});

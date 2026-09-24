import { z } from 'zod';
import {
  AdminDrawListQuerySchema,
  AdminDrawSchema,
  AdminLotterySchema,
  AdminRevisionEntriesQuerySchema,
  AdminRevisionEntriesSchema,
  AdminRevisionListQuerySchema,
  AdminRevisionListSchema,
  AdminRevisionSchema,
  AdminRuleVersionSchema,
  ApproveRuleRequestSchema,
  AuditListSchema,
  CreateCorrectionRequestSchema,
  CreateDrawRequestSchema,
  CreateLotteryRequestSchema,
  CreateRuleVersionRequestSchema,
  ImportPreviewQuerySchema,
  ImportPreviewSchema,
  ImportRequestSchema,
  LoginRequestSchema,
  PatchDrawRequestSchema,
  PatchLotteryRequestSchema,
  PatchRevisionRequestSchema,
  PublishResultSchema,
  PublishRevisionRequestSchema,
  ResumeDrawRequestSchema,
  ReviewRevisionRequestSchema,
  RevokeRuleRequestSchema,
  SessionResponseSchema,
  SuspendDrawRequestSchema,
} from './admin.js';
import { UuidSchema } from './common.js';
import type { RouteContract } from './routes.js';

const IdParams = z.strictObject({ id: UuidSchema });
const Empty = z.object({});

export interface AdminRouteContract extends RouteContract {
  method: 'GET' | 'POST' | 'PATCH';
  /** Minimum role. Session cookie + CSRF/Origin are required on every unsafe request. */
  role: 'EDITOR' | 'PUBLISHER' | 'NONE' | 'SESSION';
  headers?: ('If-Match' | 'Idempotency-Key')[];
}

/** Private admin API. Same error envelope as the public API; never cached. */
export const adminRoutes = {
  login: { method: 'POST', path: '/auth/login', summary: 'Open an admin session (sets HttpOnly cookie)', body: LoginRequestSchema, response: SessionResponseSchema, errorStatuses: [400, 401, 403, 429], cache: 'no-store', role: 'NONE' },
  session: { method: 'GET', path: '/auth/session', summary: 'Current session and CSRF token', response: SessionResponseSchema, errorStatuses: [401], cache: 'no-store', role: 'SESSION' },
  logout: { method: 'POST', path: '/auth/logout', summary: 'Revoke the session', response: Empty, errorStatuses: [401, 403], cache: 'no-store', role: 'SESSION' },
  listLotteries: { method: 'GET', path: '/admin/lotteries', summary: 'List lotteries', response: z.object({ items: z.array(AdminLotterySchema) }), errorStatuses: [401], cache: 'no-store', role: 'EDITOR' },
  createLottery: { method: 'POST', path: '/admin/lotteries', summary: 'Create a lottery', body: CreateLotteryRequestSchema, response: AdminLotterySchema, errorStatuses: [400, 401, 403, 409], cache: 'no-store', role: 'PUBLISHER' },
  patchLottery: { method: 'PATCH', path: '/admin/lotteries/:id', summary: 'Update a lottery', params: IdParams, body: PatchLotteryRequestSchema, response: AdminLotterySchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'PUBLISHER', headers: ['If-Match'] },
  listDraws: { method: 'GET', path: '/admin/draws', summary: 'List draws', query: AdminDrawListQuerySchema, response: z.object({ items: z.array(AdminDrawSchema), page: z.number(), pageSize: z.number(), total: z.number() }), errorStatuses: [400, 401], cache: 'no-store', role: 'EDITOR' },
  createDraw: { method: 'POST', path: '/admin/draws', summary: 'Create a draw', body: CreateDrawRequestSchema, response: AdminDrawSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'EDITOR' },
  getDraw: { method: 'GET', path: '/admin/draws/:id', summary: 'Draw detail', params: IdParams, response: AdminDrawSchema, errorStatuses: [401, 404], cache: 'no-store', role: 'EDITOR' },
  patchDraw: { method: 'PATCH', path: '/admin/draws/:id', summary: 'Update draw schedule/phase (identity immutable)', params: IdParams, body: PatchDrawRequestSchema, response: AdminDrawSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'EDITOR', headers: ['If-Match'] },
  drawAudit: { method: 'GET', path: '/admin/draws/:id/audit', summary: 'Audit events for a draw', params: IdParams, response: AuditListSchema, errorStatuses: [401, 404], cache: 'no-store', role: 'EDITOR' },
  suspendDraw: { method: 'POST', path: '/admin/draws/:id/suspend', summary: 'Withhold the current result', params: IdParams, body: SuspendDrawRequestSchema, response: AdminDrawSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'PUBLISHER', headers: ['Idempotency-Key'] },
  resumeDraw: { method: 'POST', path: '/admin/draws/:id/resume', summary: 'Restore visibility', params: IdParams, body: ResumeDrawRequestSchema, response: AdminDrawSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'PUBLISHER', headers: ['Idempotency-Key'] },
  createCorrection: { method: 'POST', path: '/admin/draws/:id/corrections', summary: 'Clone the current revision into a CORRECTION draft', params: IdParams, body: CreateCorrectionRequestSchema, response: AdminRevisionSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'EDITOR' },
  listRules: { method: 'GET', path: '/admin/lotteries/:id/rules', summary: 'Rule versions of a lottery', params: IdParams, response: z.object({ items: z.array(AdminRuleVersionSchema) }), errorStatuses: [401, 404], cache: 'no-store', role: 'EDITOR' },
  createRule: { method: 'POST', path: '/admin/lotteries/:id/rules', summary: 'Create a DRAFT rule version', params: IdParams, body: CreateRuleVersionRequestSchema, response: AdminRuleVersionSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'EDITOR' },
  getRule: { method: 'GET', path: '/admin/rules/:id', summary: 'Rule version detail', params: IdParams, response: AdminRuleVersionSchema, errorStatuses: [401, 404], cache: 'no-store', role: 'EDITOR' },
  approveRule: { method: 'POST', path: '/admin/rules/:id/approve', summary: 'Approve a compilable DRAFT rule version', params: IdParams, body: ApproveRuleRequestSchema, response: AdminRuleVersionSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'PUBLISHER', headers: ['Idempotency-Key'] },
  revokeRule: { method: 'POST', path: '/admin/rules/:id/revoke', summary: 'Revoke an APPROVED rule version', params: IdParams, body: RevokeRuleRequestSchema, response: AdminRuleVersionSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'PUBLISHER', headers: ['Idempotency-Key'] },
  previewImport: { method: 'POST', path: '/admin/imports', summary: 'Validate a bounded CSV/JSON import (nothing published)', body: ImportRequestSchema, response: ImportPreviewSchema, errorStatuses: [400, 401, 403, 413, 503], cache: 'no-store', role: 'EDITOR' },
  getImport: { method: 'GET', path: '/admin/imports/:id', summary: 'Import preview with paginated rows and errors', params: IdParams, query: ImportPreviewQuerySchema, response: ImportPreviewSchema, errorStatuses: [400, 401, 404], cache: 'no-store', role: 'EDITOR' },
  createDraft: { method: 'POST', path: '/admin/imports/:id/create-draft', summary: 'Create the DRAFT revision from a PREVIEW_READY import', params: IdParams, response: AdminRevisionSchema, errorStatuses: [401, 403, 404, 409], cache: 'no-store', role: 'EDITOR' },
  listRevisions: { method: 'GET', path: '/admin/revisions', summary: 'List revisions', query: AdminRevisionListQuerySchema, response: AdminRevisionListSchema, errorStatuses: [400, 401], cache: 'no-store', role: 'EDITOR' },
  getRevision: { method: 'GET', path: '/admin/revisions/:id', summary: 'Revision detail', params: IdParams, response: AdminRevisionSchema, errorStatuses: [401, 404], cache: 'no-store', role: 'EDITOR' },
  revisionEntries: { method: 'GET', path: '/admin/revisions/:id/entries', summary: 'Paginated entries of one category', params: IdParams, query: AdminRevisionEntriesQuerySchema, response: AdminRevisionEntriesSchema, errorStatuses: [400, 401, 404], cache: 'no-store', role: 'EDITOR' },
  revisionAudit: { method: 'GET', path: '/admin/revisions/:id/audit', summary: 'Audit events for a revision', params: IdParams, response: AuditListSchema, errorStatuses: [401, 404], cache: 'no-store', role: 'EDITOR' },
  patchRevision: { method: 'PATCH', path: '/admin/revisions/:id', summary: 'Edit a DRAFT revision (clears review)', params: IdParams, body: PatchRevisionRequestSchema, response: AdminRevisionSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'EDITOR', headers: ['If-Match'] },
  reopenRevision: { method: 'POST', path: '/admin/revisions/:id/reopen', summary: 'READY → DRAFT', params: IdParams, response: AdminRevisionSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'EDITOR', headers: ['If-Match'] },
  reviewRevision: { method: 'POST', path: '/admin/revisions/:id/review', summary: 'Mark a DRAFT reviewed (READY)', params: IdParams, body: ReviewRevisionRequestSchema, response: AdminRevisionSchema, errorStatuses: [400, 401, 403, 404, 409, 503], cache: 'no-store', role: 'PUBLISHER', headers: ['If-Match'] },
  publishRevision: { method: 'POST', path: '/admin/revisions/:id/publish', summary: 'Atomically publish a READY revision', params: IdParams, body: PublishRevisionRequestSchema, response: PublishResultSchema, errorStatuses: [400, 401, 403, 404, 409], cache: 'no-store', role: 'PUBLISHER', headers: ['Idempotency-Key'] },
} satisfies Record<string, AdminRouteContract>;

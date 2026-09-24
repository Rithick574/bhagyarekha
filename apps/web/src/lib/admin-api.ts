'use client';

import { z, type ZodType } from 'zod';
import {
  API_PREFIX,
  AdminDrawSchema,
  AdminLotterySchema,
  AdminRevisionEntriesSchema,
  AdminRevisionListSchema,
  AdminRevisionSchema,
  AdminRuleVersionSchema,
  AuditListSchema,
  CSRF_HEADER,
  ErrorResponseSchema,
  IDEMPOTENCY_HEADER,
  IF_MATCH_HEADER,
  ImportPreviewSchema,
  PublishResultSchema,
  SessionResponseSchema,
} from '@bhagyarekha/contracts';
import type {
  AdminDraw,
  AdminLottery,
  AdminRevision,
  AdminRuleVersion,
  CreateCorrectionRequest,
  CreateDrawRequest,
  CreateLotteryRequest,
  CreateRuleVersionRequest,
  ImportPreview,
  ImportRequest,
  LoginRequest,
  PatchDrawRequest,
  PatchLotteryRequest,
  PatchRevisionRequest,
  PublishResult,
  PublishRevisionRequest,
  ReviewRevisionRequest,
  SessionResponse,
} from '@bhagyarekha/contracts';

/**
 * Browser-side admin API access through the same-origin `/api/v1` rewrite.
 * The session cookie travels with `credentials: 'include'`; the CSRF token is
 * held in React memory and attached to every unsafe request. Nothing here
 * logs, stores or echoes a request body.
 */
export type AdminFailure =
  | { ok: false; kind: 'network' }
  | { ok: false; kind: 'invalid-response' }
  | { ok: false; kind: 'http'; status: number; code: string | null; message: string | null; fields: { path: string; code: string }[] };
export type AdminResult<T> = { ok: true; data: T } | AdminFailure;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  csrfToken?: string | null;
  ifMatch?: number;
  idempotencyKey?: string;
}

export async function adminRequest<T>(path: string, schema: ZodType<T> | null, options: RequestOptions = {}): Promise<AdminResult<T>> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { accept: 'application/json' };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET' && options.csrfToken) headers[CSRF_HEADER] = options.csrfToken;
  if (options.ifMatch !== undefined) headers[IF_MATCH_HEADER] = String(options.ifMatch);
  if (options.idempotencyKey) headers[IDEMPOTENCY_HEADER] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: 'no-store',
      credentials: 'include',
    });
  } catch {
    return { ok: false, kind: 'network' };
  }
  if (response.status === 204) {
    return schema === null ? { ok: true, data: undefined as T } : { ok: false, kind: 'invalid-response' };
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const parsed = ErrorResponseSchema.safeParse(body);
    return {
      ok: false,
      kind: 'http',
      status: response.status,
      code: parsed.success ? parsed.data.error.code : null,
      message: parsed.success ? parsed.data.error.message : null,
      fields: parsed.success ? (parsed.data.error.fields ?? []) : [],
    };
  }
  if (schema === null) return { ok: true, data: undefined as T };
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, kind: 'invalid-response' };
  return { ok: true, data: parsed.data };
}

const LotteryListSchema = z.object({ items: z.array(AdminLotterySchema) });
const DrawListSchema = z.object({ items: z.array(AdminDrawSchema), page: z.number().int(), pageSize: z.number().int(), total: z.number().int() });
const RuleListSchema = z.object({ items: z.array(AdminRuleVersionSchema) });

export type AdminDrawList = z.infer<typeof DrawListSchema>;
export type AdminRevisionList = z.infer<typeof AdminRevisionListSchema>;
export type AdminRevisionEntries = z.infer<typeof AdminRevisionEntriesSchema>;
export type AuditList = z.infer<typeof AuditListSchema>;

type Csrf = { csrfToken: string | null };

const q = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') search.set(key, String(value));
  const s = search.toString();
  return s ? `?${s}` : '';
};

// ---- auth ----
export const getSession = () => adminRequest('/auth/session', SessionResponseSchema);
export const login = (body: LoginRequest) => adminRequest('/auth/login', SessionResponseSchema, { method: 'POST', body });
export const logout = (c: Csrf) => adminRequest<void>('/auth/logout', null, { method: 'POST', csrfToken: c.csrfToken });

// ---- lotteries & rules ----
export const listAdminLotteries = () => adminRequest('/admin/lotteries', LotteryListSchema);
export const createLottery = (c: Csrf, body: CreateLotteryRequest) => adminRequest<AdminLottery>('/admin/lotteries', AdminLotterySchema, { method: 'POST', body, csrfToken: c.csrfToken });
export const patchLottery = (c: Csrf, id: string, editVersion: number, body: PatchLotteryRequest) =>
  adminRequest<AdminLottery>(`/admin/lotteries/${encodeURIComponent(id)}`, AdminLotterySchema, { method: 'PATCH', body, csrfToken: c.csrfToken, ifMatch: editVersion });
export const listRules = (lotteryId: string) => adminRequest(`/admin/lotteries/${encodeURIComponent(lotteryId)}/rules`, RuleListSchema);
export const createRule = (c: Csrf, lotteryId: string, body: CreateRuleVersionRequest) =>
  adminRequest<AdminRuleVersion>(`/admin/lotteries/${encodeURIComponent(lotteryId)}/rules`, AdminRuleVersionSchema, { method: 'POST', body, csrfToken: c.csrfToken });
export const approveRule = (c: Csrf, id: string, note: string, idempotencyKey: string) =>
  adminRequest<AdminRuleVersion>(`/admin/rules/${encodeURIComponent(id)}/approve`, AdminRuleVersionSchema, { method: 'POST', body: { note }, csrfToken: c.csrfToken, idempotencyKey });
export const revokeRule = (c: Csrf, id: string, reason: string, idempotencyKey: string) =>
  adminRequest<AdminRuleVersion>(`/admin/rules/${encodeURIComponent(id)}/revoke`, AdminRuleVersionSchema, { method: 'POST', body: { reason }, csrfToken: c.csrfToken, idempotencyKey });

// ---- draws ----
export const listAdminDraws = (params: { lotteryId?: string; page?: number } = {}) => adminRequest(`/admin/draws${q(params)}`, DrawListSchema);
export const createDraw = (c: Csrf, body: CreateDrawRequest) => adminRequest<AdminDraw>('/admin/draws', AdminDrawSchema, { method: 'POST', body, csrfToken: c.csrfToken });
export const patchDraw = (c: Csrf, id: string, editVersion: number, body: PatchDrawRequest) =>
  adminRequest<AdminDraw>(`/admin/draws/${encodeURIComponent(id)}`, AdminDrawSchema, { method: 'PATCH', body, csrfToken: c.csrfToken, ifMatch: editVersion });
export const suspendDraw = (c: Csrf, id: string, body: { reason: string; expectedEditVersion: number }, idempotencyKey: string) =>
  adminRequest<AdminDraw>(`/admin/draws/${encodeURIComponent(id)}/suspend`, AdminDrawSchema, { method: 'POST', body, csrfToken: c.csrfToken, idempotencyKey });
export const resumeDraw = (c: Csrf, id: string, body: { reason: string; expectedEditVersion: number }, idempotencyKey: string) =>
  adminRequest<AdminDraw>(`/admin/draws/${encodeURIComponent(id)}/resume`, AdminDrawSchema, { method: 'POST', body, csrfToken: c.csrfToken, idempotencyKey });
export const createCorrection = (c: Csrf, drawId: string, body: CreateCorrectionRequest) =>
  adminRequest<AdminRevision>(`/admin/draws/${encodeURIComponent(drawId)}/corrections`, AdminRevisionSchema, { method: 'POST', body, csrfToken: c.csrfToken });
export const drawAudit = (drawId: string) => adminRequest(`/admin/draws/${encodeURIComponent(drawId)}/audit`, AuditListSchema);

// ---- imports ----
export const createImport = (c: Csrf, body: ImportRequest) => adminRequest<ImportPreview>('/admin/imports', ImportPreviewSchema, { method: 'POST', body, csrfToken: c.csrfToken });
export const getImport = (id: string, params: { errorsPage?: number; rowsPage?: number } = {}) => adminRequest<ImportPreview>(`/admin/imports/${encodeURIComponent(id)}${q(params)}`, ImportPreviewSchema);
export const createDraft = (c: Csrf, importId: string) => adminRequest<AdminRevision>(`/admin/imports/${encodeURIComponent(importId)}/create-draft`, AdminRevisionSchema, { method: 'POST', csrfToken: c.csrfToken });

// ---- revisions ----
export const listRevisions = (params: { state?: string; drawId?: string; page?: number } = {}) => adminRequest(`/admin/revisions${q(params)}`, AdminRevisionListSchema);
export const getRevision = (id: string) => adminRequest<AdminRevision>(`/admin/revisions/${encodeURIComponent(id)}`, AdminRevisionSchema);
export const revisionEntries = (id: string, categoryCode: string, page = 1) =>
  adminRequest(`/admin/revisions/${encodeURIComponent(id)}/entries${q({ categoryCode, page })}`, AdminRevisionEntriesSchema);
export const patchRevision = (c: Csrf, id: string, editVersion: number, body: PatchRevisionRequest) =>
  adminRequest<AdminRevision>(`/admin/revisions/${encodeURIComponent(id)}`, AdminRevisionSchema, { method: 'PATCH', body, csrfToken: c.csrfToken, ifMatch: editVersion });
export const reopenRevision = (c: Csrf, id: string, editVersion: number) =>
  adminRequest<AdminRevision>(`/admin/revisions/${encodeURIComponent(id)}/reopen`, AdminRevisionSchema, { method: 'POST', csrfToken: c.csrfToken, ifMatch: editVersion });
export const reviewRevision = (c: Csrf, id: string, editVersion: number, body: ReviewRevisionRequest) =>
  adminRequest<AdminRevision>(`/admin/revisions/${encodeURIComponent(id)}/review`, AdminRevisionSchema, { method: 'POST', body, csrfToken: c.csrfToken, ifMatch: editVersion });
export const publishRevision = (c: Csrf, id: string, body: PublishRevisionRequest, idempotencyKey: string) =>
  adminRequest<PublishResult>(`/admin/revisions/${encodeURIComponent(id)}/publish`, PublishResultSchema, { method: 'POST', body, csrfToken: c.csrfToken, idempotencyKey });
export const revisionAudit = (id: string) => adminRequest(`/admin/revisions/${encodeURIComponent(id)}/audit`, AuditListSchema);

export type { SessionResponse, AdminRevision, AdminDraw, AdminLottery, AdminRuleVersion, ImportPreview, PublishResult };

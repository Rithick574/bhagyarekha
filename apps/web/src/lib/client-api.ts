'use client';

import type { ZodType } from 'zod';
import { API_PREFIX, DrawDetailSchema, DrawListResponseSchema, ErrorResponseSchema, HistorySearchResponseSchema, TicketCheckResponseSchema } from '@bhagyarekha/contracts';
import type { DrawDetail, DrawListResponse, HistorySearchRequest, HistorySearchResponse, TicketCheckRequest, TicketCheckResponse } from '@bhagyarekha/contracts';

/**
 * Browser-side API access through the same-origin `/api/v1` rewrite. Responses
 * are parsed with the shared contracts. Nothing here logs, stores or echoes a
 * request body.
 */
export type ClientFailure =
  | { ok: false; kind: 'network' }
  | { ok: false; kind: 'aborted' }
  | { ok: false; kind: 'invalid-response' }
  | { ok: false; kind: 'http'; status: number; code: string | null; fields: { path: string; code: string }[] };
export type ClientResult<T> = { ok: true; data: T } | ClientFailure;

async function clientRequest<T>(path: string, schema: ZodType<T>, init: RequestInit, signal?: AbortSignal): Promise<ClientResult<T>> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, { ...init, cache: 'no-store', credentials: 'omit', signal, headers: { accept: 'application/json', ...(init.headers ?? {}) } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { ok: false, kind: 'aborted' };
    return { ok: false, kind: 'network' };
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
      fields: parsed.success ? (parsed.data.error.fields ?? []) : [],
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, kind: 'invalid-response' };
  return { ok: true, data: parsed.data };
}

export function checkTicket(body: TicketCheckRequest, signal?: AbortSignal): Promise<ClientResult<TicketCheckResponse>> {
  return clientRequest('/ticket-check', TicketCheckResponseSchema, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, signal);
}

/** POST so the searched digits never enter a URL, browser history entry or access log. */
export function searchHistory(body: HistorySearchRequest, signal?: AbortSignal): Promise<ClientResult<HistorySearchResponse>> {
  return clientRequest('/history/search', HistorySearchResponseSchema, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, signal);
}

export function fetchLotteryDraws(lotteryId: string, signal?: AbortSignal): Promise<ClientResult<DrawListResponse>> {
  return clientRequest(`/draws?lotteryId=${encodeURIComponent(lotteryId)}&pageSize=50`, DrawListResponseSchema, { method: 'GET' }, signal);
}

export function fetchDrawDetail(drawId: string, signal?: AbortSignal): Promise<ClientResult<DrawDetail>> {
  return clientRequest(`/draws/${encodeURIComponent(drawId)}`, DrawDetailSchema, { method: 'GET' }, signal);
}

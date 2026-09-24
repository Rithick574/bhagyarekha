import type { ZodType } from 'zod';
import {
  API_PREFIX,
  DrawDetailSchema,
  DrawListResponseSchema,
  ErrorResponseSchema,
  HealthReadyResponseSchema,
  LatestResponseSchema,
  LotteryListResponseSchema,
  ResultResponseSchema,
} from '@bhagyarekha/contracts';
import type { DrawDetail, DrawListResponse, HealthReadyResponse, LatestResponse, LotteryListResponse, ResultResponse } from '@bhagyarekha/contracts';

export type ApiFailure =
  | { ok: false; kind: 'network' }
  | { ok: false; kind: 'http'; status: number; code: string | null }
  | { ok: false; kind: 'invalid-response' };
export type ApiResult<T> = { ok: true; data: T } | ApiFailure;

function baseUrl(): string {
  return (process.env.INTERNAL_API_BASE_URL ?? 'http://localhost:3001').replace(/\/$/, '') + API_PREFIX;
}

const REQUEST_TIMEOUT_MS = 8000;

async function request<T>(path: string, schema: ZodType<T>, query?: Record<string, string | number | undefined>): Promise<ApiResult<T>> {
  const url = new URL(baseUrl() + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, kind: 'network' };
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const parsedError = ErrorResponseSchema.safeParse(body);
    return { ok: false, kind: 'http', status: response.status, code: parsedError.success ? parsedError.data.error.code : null };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, kind: 'invalid-response' };
  return { ok: true, data: parsed.data };
}

export function listLotteries(params: { active?: boolean } = {}): Promise<ApiResult<LotteryListResponse>> {
  return request('/lotteries', LotteryListResponseSchema, { active: params.active === undefined ? undefined : String(params.active) });
}

export function getLatest(lotteryId?: string): Promise<ApiResult<LatestResponse>> {
  return request('/draws/latest', LatestResponseSchema, { lotteryId });
}

export function listDraws(params: { lotteryId?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}): Promise<ApiResult<DrawListResponse>> {
  return request('/draws', DrawListResponseSchema, params);
}

export function getDraw(drawId: string): Promise<ApiResult<DrawDetail>> {
  return request(`/draws/${encodeURIComponent(drawId)}`, DrawDetailSchema);
}

export function getResult(drawId: string, params: { categoryCode?: string; page?: number; pageSize?: number } = {}): Promise<ApiResult<ResultResponse>> {
  return request(`/draws/${encodeURIComponent(drawId)}/result`, ResultResponseSchema, params);
}

export function getReady(): Promise<ApiResult<HealthReadyResponse>> {
  return request('/health/ready', HealthReadyResponseSchema);
}

/** Resolves the deployment data mode for layout chrome. Unknown (API down) yields null; never assume demo or live. */
export async function getDataMode(): Promise<'demo' | 'live' | null> {
  const ready = await getReady();
  if (ready.ok) return ready.data.dataMode;
  return null;
}

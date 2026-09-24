import type { ZodType } from 'zod';
import {
  DrawDetailSchema,
  DrawIdParamsSchema,
  DrawListQuerySchema,
  DrawListResponseSchema,
  ErrorResponseSchema,
  HealthLiveResponseSchema,
  HealthReadyResponseSchema,
  LatestQuerySchema,
  LatestResponseSchema,
  LotteryListQuerySchema,
  LotteryListResponseSchema,
  ResultQuerySchema,
  ResultResponseSchema,
} from './public.js';

export const API_PREFIX = '/api/v1';

export interface RouteContract {
  method: 'GET' | 'POST';
  /** Path relative to API_PREFIX, Express style (`:drawId`). */
  path: string;
  summary: string;
  params?: ZodType;
  query?: ZodType;
  body?: ZodType;
  response: ZodType;
  /** HTTP status codes this route may answer with an ErrorResponse body. */
  errorStatuses: number[];
  /** Status used when the route reports failure with the SAME body schema (health checks). */
  failureStatus?: number;
  cache: 'no-store';
}

/**
 * Single source of truth for the public read API. The API controllers validate
 * against these schemas; the web client parses responses with them; the
 * OpenAPI document is generated from them (see scripts/generate-openapi.ts).
 */
export const publicRoutes = {
  listLotteries: {
    method: 'GET',
    path: '/lotteries',
    summary: 'List lotteries with localized names and archive coverage',
    query: LotteryListQuerySchema,
    response: LotteryListResponseSchema,
    errorStatuses: [400, 429, 503],
    cache: 'no-store',
  },
  listDraws: {
    method: 'GET',
    path: '/draws',
    summary: 'List draws (metadata only) ordered by display date, newest first',
    query: DrawListQuerySchema,
    response: DrawListResponseSchema,
    errorStatuses: [400, 429, 503],
    cache: 'no-store',
  },
  latestDraws: {
    method: 'GET',
    path: '/draws/latest',
    summary: 'Latest published draw and, separately, the pending draw',
    query: LatestQuerySchema,
    response: LatestResponseSchema,
    errorStatuses: [400, 429, 503],
    cache: 'no-store',
  },
  getDraw: {
    method: 'GET',
    path: '/draws/:drawId',
    summary: 'Draw identity, dates, visibility, current revision summary and checking capability',
    params: DrawIdParamsSchema,
    response: DrawDetailSchema,
    errorStatuses: [400, 404, 429, 503],
    cache: 'no-store',
  },
  getDrawResult: {
    method: 'GET',
    path: '/draws/:drawId/result',
    summary: 'Current published result: category manifest and paginated entries',
    params: DrawIdParamsSchema,
    query: ResultQuerySchema,
    response: ResultResponseSchema,
    errorStatuses: [400, 404, 409, 429, 503],
    cache: 'no-store',
  },
  healthLive: {
    method: 'GET',
    path: '/health/live',
    summary: 'Process liveness; no external dependencies',
    response: HealthLiveResponseSchema,
    errorStatuses: [],
    cache: 'no-store',
  },
  healthReady: {
    method: 'GET',
    path: '/health/ready',
    summary: 'Readiness: database, migrations and data-mode agreement',
    response: HealthReadyResponseSchema,
    errorStatuses: [],
    failureStatus: 503,
    cache: 'no-store',
  },
} satisfies Record<string, RouteContract>;

export type PublicRouteName = keyof typeof publicRoutes;

export const ErrorEnvelopeSchema = ErrorResponseSchema;

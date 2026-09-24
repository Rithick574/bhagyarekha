import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

const requestIds = new WeakMap<Request, string>();

/** Assigns a server-generated request ID. Inbound header values are deliberately not trusted or reflected. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  requestIds.set(req, id);
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}

/** Every API response is private and uncached (LLD §8). */
export function noStoreMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
}

export function requestIdOf(req: Request): string {
  return requestIds.get(req) ?? 'unknown';
}

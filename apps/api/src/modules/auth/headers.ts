import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiError } from '../../common/api-error.js';

/** `If-Match: 3` or `If-Match: "3"` → 3. Missing or malformed → 400. */
export const IfMatch = createParamDecorator((_data: unknown, ctx: ExecutionContext): number => {
  const raw = ctx.switchToHttp().getRequest<Request>().headers['if-match'];
  const value = typeof raw === 'string' ? raw.trim().replace(/^"|"$/g, '') : '';
  if (!/^\d{1,9}$/.test(value)) throw new ApiError(400, 'INVALID_INPUT', 'If-Match header with the current edit version is required', [{ path: 'If-Match', code: 'REQUIRED' }]);
  return Number.parseInt(value, 10);
});

/** `Idempotency-Key` header, 8–128 printable characters. */
export const IdempotencyKey = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const raw = ctx.switchToHttp().getRequest<Request>().headers['idempotency-key'];
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!/^[\x21-\x7e]{8,128}$/.test(value)) throw new ApiError(400, 'INVALID_INPUT', 'Idempotency-Key header (8–128 characters) is required', [{ path: 'Idempotency-Key', code: 'REQUIRED' }]);
  return value;
});

export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

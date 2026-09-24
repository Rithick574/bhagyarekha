import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@bhagyarekha/contracts';

export interface FieldError {
  path: string;
  code: string;
}

/**
 * The only exception type controllers and services throw for expected failures.
 * `message` is developer-facing English; the web maps `code` to localized text.
 * Never place user-submitted values in `message` or `fields`.
 */
export class ApiError extends HttpException {
  constructor(
    status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly fields?: FieldError[],
  ) {
    super({ code, message, fields }, status);
    this.name = 'ApiError';
  }

  static notFound(code: Extract<ErrorCode, 'DRAW_NOT_FOUND' | 'LOTTERY_NOT_FOUND' | 'CATEGORY_NOT_FOUND' | 'RESULT_NOT_PUBLISHED' | 'NOT_FOUND'>, message: string): ApiError {
    return new ApiError(404, code, message);
  }

  static conflict(code: Extract<ErrorCode, 'RESULT_SUSPENDED' | 'RESULT_CHANGED' | 'REVISION_CONFLICT' | 'IDEMPOTENCY_CONFLICT'>, message: string): ApiError {
    return new ApiError(409, code, message);
  }

  static unavailable(code: Extract<ErrorCode, 'RESULT_UNAVAILABLE' | 'SERVICE_UNAVAILABLE'>, message: string): ApiError {
    return new ApiError(503, code, message);
  }
}

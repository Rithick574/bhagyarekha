import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode, ErrorResponse } from '@bhagyarekha/contracts';
import type { Request, Response } from 'express';
import { ApiError } from './api-error.js';
import type { AppLogger } from './logger.js';
import { requestIdOf } from './request-context.js';

/**
 * Produces the single error envelope for every failure. Framework exceptions
 * (unknown route, throttling, payload too large) are mapped to stable codes.
 * Stack traces, SQL and submitted values never reach the client.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const requestId = requestIdOf(req);

    const { status, code, message, fields } = this.describe(exception);

    if (status >= 500) {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error({ requestId, status, code, err: { name: err.name, message: err.message, stack: err.stack } }, 'request failed');
    } else if (status === 429) {
      this.logger.warn({ requestId, status, code, path: req.path }, 'rate limited');
    }

    const body: ErrorResponse = { error: fields ? { code, message, fields } : { code, message }, requestId };
    res.status(status).setHeader('Cache-Control', 'no-store');
    res.json(body);
  }

  private describe(exception: unknown): { status: number; code: ErrorCode; message: string; fields?: ApiError['fields'] } {
    if (exception instanceof ApiError) {
      return { status: exception.getStatus(), code: exception.code, message: exception.message, fields: exception.fields };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      switch (status) {
        case HttpStatus.NOT_FOUND:
          return { status, code: 'NOT_FOUND', message: 'No such resource' };
        case HttpStatus.TOO_MANY_REQUESTS:
          return { status, code: 'RATE_LIMITED', message: 'Too many requests; retry later' };
        case HttpStatus.PAYLOAD_TOO_LARGE:
          return { status, code: 'INVALID_INPUT', message: 'Request body too large' };
        case HttpStatus.BAD_REQUEST:
        case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
          return { status: 400, code: 'INVALID_INPUT', message: 'Malformed request' };
        case HttpStatus.SERVICE_UNAVAILABLE:
          return { status, code: 'SERVICE_UNAVAILABLE', message: 'Service temporarily unavailable' };
        default:
          return status >= 500
            ? { status, code: 'INTERNAL_ERROR', message: 'Unexpected server error' }
            : { status, code: 'INVALID_INPUT', message: 'Request could not be processed' };
      }
    }
    // body-parser and similar surface errors with a numeric status property.
    const maybeStatus = (exception as { status?: unknown; statusCode?: unknown } | null)?.status ?? (exception as { statusCode?: unknown } | null)?.statusCode;
    if (typeof maybeStatus === 'number' && maybeStatus >= 400 && maybeStatus < 500) {
      return maybeStatus === 413
        ? { status: 413, code: 'INVALID_INPUT', message: 'Request body too large' }
        : { status: 400, code: 'INVALID_INPUT', message: 'Malformed request' };
    }
    return { status: 500, code: 'INTERNAL_ERROR', message: 'Unexpected server error' };
  }
}

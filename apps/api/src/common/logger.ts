import { type LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { pino, type Logger } from 'pino';
import { requestIdOf } from './request-context.js';

export type AppLogger = Logger;

export interface LoggerOptions {
  level: string;
  appEnv: string;
  dataMode: string;
  pretty?: boolean;
}

/**
 * Structured JSON logger. Request bodies, query values and headers are never
 * logged; only method, path, status, duration and request ID.
 */
export function createLogger(options: LoggerOptions): AppLogger {
  return pino({
    level: options.level,
    base: { service: 'bhagyarekha-api', appEnv: options.appEnv, dataMode: options.dataMode },
    redact: { paths: ['req.headers', 'req.body', 'req.query', 'body', 'query', 'ticket', 'number', 'series'], remove: true },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

/** Adapts pino to Nest's LoggerService so framework logs share the pipeline. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: AppLogger) {}
  log(message: unknown, context?: string): void {
    this.logger.info({ context }, String(message));
  }
  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, String(message));
  }
  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }
  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }
  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }
  fatal(message: unknown, context?: string): void {
    this.logger.fatal({ context }, String(message));
  }
}

export function requestLogMiddleware(logger: AppLogger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info(
        {
          requestId: requestIdOf(req),
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(durationMs * 10) / 10,
        },
        'request',
      );
    });
    next();
  };
}

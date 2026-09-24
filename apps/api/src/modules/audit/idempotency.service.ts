import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ApiError } from '../../common/api-error.js';
import { canonicalHash } from '../../common/canonical-hash.js';
import { AdminIdempotencyEntity } from '../../database/entities/index.js';

const RETENTION_MS = 72 * 3600 * 1000;

export interface IdempotentOutcome<T> {
  status: number;
  body: T;
  replayed: boolean;
}

/**
 * Same key + same request → the committed prior response. Same key + different
 * request → 409 IDEMPOTENCY_CONFLICT. Concurrent identical keys serialise on a
 * transaction-scoped advisory lock so a retry after a lost response cannot run twice.
 * Must be called inside the mutation's transaction with its manager.
 */
@Injectable()
export class IdempotencyService {
  async run<T>(m: EntityManager, scope: { actorId: string; operation: string; key: string; request: unknown }, work: () => Promise<{ status: number; body: T }>): Promise<IdempotentOutcome<T>> {
    const requestHash = canonicalHash(scope.request);
    await m.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${scope.actorId}:${scope.operation}:${scope.key}`]);
    const existing = await m.findOne(AdminIdempotencyEntity, { where: { actorId: scope.actorId, operation: scope.operation, idempotencyKey: scope.key } });
    if (existing) {
      if (existing.requestHash !== requestHash) throw ApiError.conflict('IDEMPOTENCY_CONFLICT', 'This Idempotency-Key was already used with a different request');
      return { status: existing.responseStatus, body: existing.responseBody as T, replayed: true };
    }
    const result = await work();
    const now = new Date();
    const row = m.create(AdminIdempotencyEntity, {
      actorId: scope.actorId,
      operation: scope.operation,
      idempotencyKey: scope.key,
      requestHash,
      responseStatus: result.status,
      responseBody: result.body as Record<string, unknown>,
      createdAt: now,
      expiresAt: new Date(now.getTime() + RETENTION_MS),
    });
    await m.save(AdminIdempotencyEntity, row);
    return { ...result, replayed: false };
  }
}

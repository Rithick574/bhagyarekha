import { Injectable } from '@nestjs/common';
import type { AuditEvent } from '@bhagyarekha/contracts';
import { In, type EntityManager } from 'typeorm';
import { AdminUserEntity, AuditEventEntity } from '../../database/entities/index.js';

export interface AuditRecord {
  actorId: string | null;
  action: string;
  entityType: 'LOTTERY' | 'DRAW' | 'RULE_VERSION' | 'RESULT_REVISION' | 'IMPORT_BATCH' | 'ADMIN_USER';
  entityId: string;
  beforeHash?: string | null;
  afterHash?: string | null;
  /** Allowlisted, small, non-sensitive metadata only. Never request bodies or ticket inputs. */
  metadata?: Record<string, string | number | boolean | null>;
  requestId?: string | null;
}

/** Append-only operational evidence. `record` MUST be called with the mutation's own transaction manager. */
@Injectable()
export class AuditService {
  async record(m: EntityManager, entry: AuditRecord): Promise<void> {
    const row = m.create(AuditEventEntity, {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      createdAt: new Date(),
      beforeHash: entry.beforeHash ?? null,
      afterHash: entry.afterHash ?? null,
      metadata: entry.metadata ?? {},
      requestId: entry.requestId ?? null,
    });
    await m.save(AuditEventEntity, row);
  }

  async list(m: EntityManager, entityType: AuditRecord['entityType'], entityId: string, limit = 100): Promise<AuditEvent[]> {
    const rows = await m.find(AuditEventEntity, { where: { entityType, entityId }, order: { createdAt: 'DESC', id: 'DESC' }, take: limit });
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => id !== null))];
    const actors: AdminUserEntity[] = actorIds.length ? await m.find(AdminUserEntity, { where: { id: In(actorIds) } }) : [];
    const emailById = new Map<string, string>(actors.map((a) => [a.id, a.email]));
    return rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      actorEmail: r.actorId ? (emailById.get(r.actorId) ?? null) : null,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      createdAt: r.createdAt.toISOString(),
      beforeHash: r.beforeHash,
      afterHash: r.afterHash,
      metadata: r.metadata,
      requestId: r.requestId,
    }));
  }
}

import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_event' })
export class AuditEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'text' })
  action: string;

  @Column({ name: 'entity_type', type: 'text' })
  entityType: string;

  @Column({ name: 'entity_id', type: 'text' })
  entityId: string;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'before_hash', type: 'text', nullable: true })
  beforeHash: string | null;

  @Column({ name: 'after_hash', type: 'text', nullable: true })
  afterHash: string | null;

  @Column({ type: 'jsonb' })
  metadata: Record<string, unknown>;

  @Column({ name: 'request_id', type: 'text', nullable: true })
  requestId: string | null;
}

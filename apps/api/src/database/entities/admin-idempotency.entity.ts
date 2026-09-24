import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'admin_idempotency' })
export class AdminIdempotencyEntity {
  @PrimaryColumn({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @PrimaryColumn({ type: 'text' })
  operation: string;

  @PrimaryColumn({ name: 'idempotency_key', type: 'text' })
  idempotencyKey: string;

  @Column({ name: 'request_hash', type: 'text' })
  requestHash: string;

  @Column({ name: 'response_status', type: 'integer' })
  responseStatus: number;

  @Column({ name: 'response_body', type: 'jsonb' })
  responseBody: Record<string, unknown>;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;
}

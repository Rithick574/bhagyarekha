import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'admin_session' })
export class AdminSessionEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** SHA-256 of the opaque cookie token; the token itself is never stored. */
  @Column({ name: 'token_hash', type: 'text' })
  tokenHash: string;

  @Column({ name: 'csrf_token', type: 'text' })
  csrfToken: string;

  @Column({ name: 'auth_version', type: 'integer' })
  authVersion: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;

  @Column({ name: 'idle_expires_at', type: 'timestamptz' })
  idleExpiresAt: Date;

  @Column({ name: 'absolute_expires_at', type: 'timestamptz' })
  absoluteExpiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}

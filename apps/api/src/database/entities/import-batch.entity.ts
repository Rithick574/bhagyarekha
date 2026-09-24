import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'import_batch' })
export class ImportBatchEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ name: 'lottery_id', type: 'uuid', nullable: true })
  lotteryId: string | null;

  @Column({ name: 'draw_id', type: 'uuid', nullable: true })
  drawId: string | null;

  @Column({ name: 'rule_version_id', type: 'uuid', nullable: true })
  ruleVersionId: string | null;

  @Column({ type: 'text' })
  format: 'csv' | 'json';

  @Column({ type: 'jsonb' })
  manifest: unknown;

  /** Private admin evidence; never served or interpreted as HTML. */
  @Column({ name: 'raw_upload', type: 'bytea' })
  rawUpload: Buffer;

  @Column({ name: 'upload_sha256', type: 'text' })
  uploadSha256: string;

  @Column({ name: 'canonical_payload_hash', type: 'text', nullable: true })
  canonicalPayloadHash: string | null;

  @Column({ type: 'text' })
  status: 'VALIDATION_FAILED' | 'PREVIEW_READY' | 'DRAFT_CREATED';

  @Column({ type: 'jsonb' })
  errors: unknown[];

  @Column({ name: 'parsed_rows', type: 'jsonb' })
  parsedRows: unknown[];

  @Column({ type: 'jsonb' })
  summary: Record<string, unknown>;

  @Column({ name: 'created_revision_id', type: 'uuid', nullable: true })
  createdRevisionId: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

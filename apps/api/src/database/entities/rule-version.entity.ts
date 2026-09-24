import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'rule_version' })
export class RuleVersionEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'lottery_id', type: 'uuid' })
  lotteryId: string;

  @Column({ type: 'integer' })
  version: number;

  @Column({ name: 'schema_version', type: 'integer' })
  schemaVersion: number;

  @Column({ name: 'engine_version', type: 'text' })
  engineVersion: string;

  @Column({ name: 'number_length', type: 'integer' })
  numberLength: number;

  @Column({ name: 'allowed_first_digits', type: 'text', array: true })
  allowedFirstDigits: string[];

  @Column({ name: 'allowed_series', type: 'text', array: true })
  allowedSeries: string[];

  @Column({ name: 'award_policy', type: 'text' })
  awardPolicy: string;

  @Column({ type: 'text' })
  state: 'DRAFT' | 'APPROVED' | 'REVOKED';

  @Column({ name: 'content_hash', type: 'text' })
  contentHash: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'approval_note', type: 'text', nullable: true })
  approvalNote: string | null;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revocation_reason', type: 'text', nullable: true })
  revocationReason: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'edit_version', type: 'integer', default: 1 })
  editVersion: number;
}

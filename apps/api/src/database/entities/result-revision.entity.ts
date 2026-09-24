import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Immutable reviewed identity/date snapshot captured when a revision is created. */
export interface DrawSnapshot {
  drawCode: string;
  scheduledDate: string | null;
  actualDate: string | null;
  scheduledAt: string | null;
  actualAt: string | null;
}

@Entity({ name: 'result_revision' })
export class ResultRevisionEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'draw_id', type: 'uuid' })
  drawId: string;

  @Column({ name: 'lottery_id', type: 'uuid' })
  lotteryId: string;

  @Column({ name: 'rule_version_id', type: 'uuid' })
  ruleVersionId: string;

  @Column({ name: 'revision_no', type: 'integer' })
  revisionNo: number;

  @Column({ name: 'draw_snapshot', type: 'jsonb' })
  drawSnapshot: DrawSnapshot;

  @Column({ name: 'based_on_revision_id', type: 'uuid', nullable: true })
  basedOnRevisionId: string | null;

  @Column({ name: 'workflow_state', type: 'text' })
  workflowState: 'DRAFT' | 'READY' | 'PUBLISHED' | 'SUPERSEDED';

  @Column({ name: 'publication_kind', type: 'text' })
  publicationKind: 'INITIAL' | 'UPDATE' | 'CORRECTION';

  @Column({ type: 'text' })
  completeness: 'PARTIAL' | 'COMPLETE';

  @Column({ name: 'content_hash', type: 'text' })
  contentHash: string;

  @Column({ name: 'reviewed_hash', type: 'text', nullable: true })
  reviewedHash: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'correction_reason', type: 'text', nullable: true })
  correctionReason: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'edit_version', type: 'integer', default: 1 })
  editVersion: number;
}

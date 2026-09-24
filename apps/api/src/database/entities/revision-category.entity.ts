import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'revision_category' })
export class RevisionCategoryEntity {
  @PrimaryColumn({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @PrimaryColumn({ name: 'category_code', type: 'text' })
  categoryCode: string;

  @Column({ name: 'rule_version_id', type: 'uuid' })
  ruleVersionId: string;

  @Column({ type: 'text' })
  state: 'MISSING' | 'PARTIAL' | 'COMPLETE';

  /** bigint minor units as decimal string, or null when unknown. */
  @Column({ name: 'amount_minor', type: 'bigint', nullable: true })
  amountMinor: string | null;

  @Column({ name: 'source_reviewed_by', type: 'uuid', nullable: true })
  sourceReviewedBy: string | null;

  @Column({ name: 'source_reviewed_at', type: 'timestamptz', nullable: true })
  sourceReviewedAt: Date | null;

  @Column({ name: 'source_review_note', type: 'text', nullable: true })
  sourceReviewNote: string | null;
}

import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'source_evidence' })
export class SourceEvidenceEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'text' })
  kind: 'OFFICIAL_DOCUMENT' | 'MANUAL_TRANSCRIPTION' | 'SYNTHETIC_FIXTURE';

  @Column({ type: 'text', nullable: true })
  url: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'document_hash', type: 'text', nullable: true })
  documentHash: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ name: 'review_note', type: 'text', nullable: true })
  reviewNote: string | null;

  @Column({ name: 'acquired_at', type: 'timestamptz', nullable: true })
  acquiredAt: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'revision_evidence' })
export class RevisionEvidenceEntity {
  @PrimaryColumn({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @PrimaryColumn({ name: 'evidence_id', type: 'uuid' })
  evidenceId: string;
}

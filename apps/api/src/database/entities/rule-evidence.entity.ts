import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'rule_evidence' })
export class RuleEvidenceEntity {
  @PrimaryColumn({ name: 'rule_version_id', type: 'uuid' })
  ruleVersionId: string;

  @PrimaryColumn({ name: 'evidence_id', type: 'uuid' })
  evidenceId: string;
}

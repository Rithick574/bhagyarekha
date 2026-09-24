import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'rule_category' })
export class RuleCategoryEntity {
  @PrimaryColumn({ name: 'rule_version_id', type: 'uuid' })
  ruleVersionId: string;

  @PrimaryColumn({ type: 'text' })
  code: string;

  @Column({ name: 'label_en', type: 'text' })
  labelEn: string;

  @Column({ name: 'label_ml', type: 'text' })
  labelMl: string;

  @Column({ type: 'integer' })
  priority: number;

  @Column({ name: 'metric_role', type: 'text' })
  metricRole: 'FIRST_PRIZE' | 'OTHER';

  @Column({ name: 'match_kind', type: 'text' })
  matchKind: 'FULL_NUMBER' | 'SUFFIX';

  @Column({ name: 'series_policy', type: 'text' })
  seriesPolicy: 'MATCH_ENTRY' | 'EXCEPT_ENTRY' | 'ANY_ALLOWED';

  @Column({ name: 'suffix_length', type: 'integer', nullable: true })
  suffixLength: number | null;

  @Column({ name: 'excluded_by', type: 'text', array: true })
  excludedBy: string[];

  @Column({ name: 'expected_entry_count', type: 'integer', nullable: true })
  expectedEntryCount: number | null;
}

import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'lottery' })
export class LotteryEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'text' })
  slug: string;

  @Column({ name: 'name_en', type: 'text' })
  nameEn: string;

  @Column({ name: 'name_ml', type: 'text' })
  nameMl: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** bigint serialised as a decimal string by the pg driver. */
  @Column({ name: 'dataset_version', type: 'bigint', default: '0' })
  datasetVersion: string;

  @Column({ name: 'archive_coverage', type: 'text', default: 'UNKNOWN' })
  archiveCoverage: 'UNKNOWN' | 'CURATED_COMPLETE';

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'edit_version', type: 'integer', default: 1 })
  editVersion: number;
}

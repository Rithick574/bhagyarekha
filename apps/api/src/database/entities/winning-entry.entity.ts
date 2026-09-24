import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'winning_entry' })
export class WinningEntryEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'revision_id', type: 'uuid' })
  revisionId: string;

  @Column({ name: 'category_code', type: 'text' })
  categoryCode: string;

  /** Empty string sentinel when the category does not use a series. */
  @Column({ type: 'varchar', length: 8, default: '' })
  series: string;

  /** Digit string; leading zeros are significant. Never numeric. */
  @Column({ type: 'varchar', length: 12 })
  number: string;

  @Column({ name: 'source_row', type: 'integer', nullable: true })
  sourceRow: number | null;
}

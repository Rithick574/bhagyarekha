import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'draw' })
export class DrawEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'lottery_id', type: 'uuid' })
  lotteryId: string;

  @Column({ name: 'draw_code', type: 'text' })
  drawCode: string;

  /** Local IST calendar date as YYYY-MM-DD string (pg `date`). */
  @Column({ name: 'scheduled_date', type: 'date', nullable: true })
  scheduledDate: string | null;

  @Column({ name: 'actual_date', type: 'date', nullable: true })
  actualDate: string | null;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'actual_at', type: 'timestamptz', nullable: true })
  actualAt: Date | null;

  @Column({ type: 'text' })
  phase: 'SCHEDULED' | 'POSTPONED' | 'HELD' | 'CANCELLED';

  @Column({ type: 'text', default: 'ACTIVE' })
  visibility: 'ACTIVE' | 'SUSPENDED';

  @Column({ name: 'suspension_reason', type: 'text', nullable: true })
  suspensionReason: string | null;

  @Column({ name: 'current_revision_id', type: 'uuid', nullable: true })
  currentRevisionId: string | null;

  @Column({ name: 'next_revision_no', type: 'integer', default: 1 })
  nextRevisionNo: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'edit_version', type: 'integer', default: 1 })
  editVersion: number;
}

import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'deployment_metadata' })
export class DeploymentMetadataEntity {
  @PrimaryColumn({ type: 'smallint' })
  id: number;

  @Column({ name: 'data_mode', type: 'text' })
  dataMode: 'demo' | 'live';

  @Column({ name: 'initialized_at', type: 'timestamptz' })
  initializedAt: Date;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;
}

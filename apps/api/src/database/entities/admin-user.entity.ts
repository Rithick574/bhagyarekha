import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'admin_user' })
export class AdminUserEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'text' })
  email: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ type: 'text' })
  role: 'EDITOR' | 'PUBLISHER';

  @Column({ type: 'boolean', default: false })
  disabled: boolean;

  @Column({ name: 'auth_version', type: 'integer', default: 1 })
  authVersion: number;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'edit_version', type: 'integer', default: 1 })
  editVersion: number;
}

import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import type { DataMode } from '@bhagyarekha/contracts';
import { DataSource } from 'typeorm';
import { ENV, type Env } from '../../config/env.provider.js';
import { DeploymentMetadataEntity } from '../../database/entities/index.js';

export class DeploymentModeError extends Error {
  constructor(
    public readonly reason: 'uninitialized' | 'mismatch' | 'pending_migrations',
    message: string,
  ) {
    super(message);
    this.name = 'DeploymentModeError';
  }
}

/**
 * Enforces INV-01 / ADR-10 at startup: the configured DATA_MODE must equal the
 * database's immutable deployment_metadata mode, and the schema must be fully
 * migrated. Any disagreement aborts bootstrap before a single request is served.
 */
@Injectable()
export class DeploymentModeService implements OnApplicationBootstrap {
  private verified: DataMode | null = null;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.assertReady();
  }

  /** The verified data mode. Throws if bootstrap verification has not run. */
  get dataMode(): DataMode {
    if (!this.verified) throw new DeploymentModeError('uninitialized', 'Deployment mode has not been verified');
    return this.verified;
  }

  async readDatabaseMode(): Promise<DataMode | null> {
    const row = await this.dataSource.manager.findOne(DeploymentMetadataEntity, { where: { id: 1 } });
    return row?.dataMode ?? null;
  }

  async hasPendingMigrations(): Promise<boolean> {
    return this.dataSource.showMigrations();
  }

  async assertReady(): Promise<DataMode> {
    if (await this.hasPendingMigrations()) {
      throw new DeploymentModeError('pending_migrations', 'Database has pending migrations. Run `pnpm db:migrate` before starting the API.');
    }
    const dbMode = await this.readDatabaseMode();
    if (dbMode === null) {
      throw new DeploymentModeError(
        'uninitialized',
        `Database has no deployment_metadata row. Run \`pnpm env:init -- --mode ${this.env.DATA_MODE}\` against the intended database.`,
      );
    }
    if (dbMode !== this.env.DATA_MODE) {
      throw new DeploymentModeError(
        'mismatch',
        `DATA_MODE=${this.env.DATA_MODE} but the database is marked ${dbMode}. Demo and live never share a database; refusing to start.`,
      );
    }
    this.verified = dbMode;
    return dbMode;
  }
}

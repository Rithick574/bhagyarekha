import { Inject, Injectable } from '@nestjs/common';
import type { HealthReadyResponse } from '@bhagyarekha/contracts';
import { DataSource } from 'typeorm';
import { ENV, type Env } from '../../config/env.provider.js';
import { DeploymentModeService } from '../deployment-mode/deployment-mode.service.js';

@Injectable()
export class HealthService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly dataSource: DataSource,
    private readonly deploymentMode: DeploymentModeService,
  ) {}

  /** Readiness without contacting any external result source. Exposes no secrets. */
  async readiness(): Promise<HealthReadyResponse> {
    const checks: HealthReadyResponse['checks'] = { database: 'fail', migrations: 'fail', dataMode: 'fail' };
    let dataMode: HealthReadyResponse['dataMode'] = null;
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'ok';
    } catch {
      // Leave database at fail; still attempt the other checks.
    }
    try {
      checks.migrations = (await this.deploymentMode.hasPendingMigrations()) ? 'pending' : 'ok';
    } catch {
      checks.migrations = 'fail';
    }
    try {
      const dbMode = await this.deploymentMode.readDatabaseMode();
      if (dbMode === null) checks.dataMode = 'uninitialized';
      else if (dbMode !== this.env.DATA_MODE) checks.dataMode = 'mismatch';
      else {
        checks.dataMode = 'ok';
        dataMode = dbMode;
      }
    } catch {
      checks.dataMode = 'fail';
    }
    const ok = checks.database === 'ok' && checks.migrations === 'ok' && checks.dataMode === 'ok';
    return { status: ok ? 'ok' : 'fail', dataMode, checks };
  }
}

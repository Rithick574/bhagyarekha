import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Clock } from './common/clock.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { buildDataSourceOptions } from './database/data-source.js';
import { DeploymentModeModule } from './modules/deployment-mode/deployment-mode.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ResultsModule } from './modules/results/results.module.js';

export interface AppModuleOptions {
  env: Env;
  clock?: Clock;
  /** Requests per minute per client before 429. Tests raise this. */
  rateLimitPerMinute?: number;
}

@Module({})
export class AppModule {
  static forRoot(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({ env: options.env, clock: options.clock }),
        TypeOrmModule.forRoot(buildDataSourceOptions({ databaseUrl: options.env.DATABASE_URL })),
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: options.rateLimitPerMinute ?? 120 }]),
        DeploymentModeModule,
        HealthModule,
        ResultsModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}

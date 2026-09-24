import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { Clock } from './common/clock.js';
import { ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { buildDataSourceOptions } from './database/data-source.js';
import { AdminCatalogModule } from './modules/admin-catalog/admin-catalog.module.js';
import { ImportsModule } from './modules/imports/imports.module.js';
import { PublishingModule } from './modules/publishing/publishing.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DeploymentModeModule } from './modules/deployment-mode/deployment-mode.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ResultsModule } from './modules/results/results.module.js';
import { TicketCheckModule } from './modules/ticket-check/ticket-check.module.js';

export interface AppModuleOptions {
  env: Env;
  clock?: Clock;
  /** Overrides env RATE_LIMIT_PER_MINUTE / RATE_LIMIT_CHECK_PER_MINUTE (tests raise them). */
  rateLimitPerMinute?: number;
  rateLimitCheckPerMinute?: number;
}

@Module({})
export class AppModule {
  static forRoot(options: AppModuleOptions): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({ env: options.env, clock: options.clock }),
        TypeOrmModule.forRoot(buildDataSourceOptions({ databaseUrl: options.env.DATABASE_URL })),
        ThrottlerModule.forRoot([
          { name: 'default', ttl: 60_000, limit: options.rateLimitPerMinute ?? options.env.RATE_LIMIT_PER_MINUTE },
          { name: 'check', ttl: 60_000, limit: options.rateLimitCheckPerMinute ?? options.env.RATE_LIMIT_CHECK_PER_MINUTE },
        ]),
        DeploymentModeModule,
        AuthModule,
        AuditModule,
        HealthModule,
        ResultsModule,
        TicketCheckModule,
        AdminCatalogModule,
        PublishingModule,
        ImportsModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}

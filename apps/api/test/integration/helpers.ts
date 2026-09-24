import type { INestApplication } from '@nestjs/common';
import { type DataSource } from 'typeorm';
import { createApp } from '../../src/app.js';
import { FixedClock } from '../../src/common/clock.js';
import { createLogger } from '../../src/common/logger.js';
import type { Env } from '../../src/config/env.js';
import { createDataSource } from '../../src/database/data-source.js';
import { DeploymentMetadataEntity } from '../../src/database/entities/index.js';
import { seedDemo } from '../../src/fixtures/seed-demo.js';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL as string;

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'test',
    APP_ENV: 'test',
    DATA_MODE: 'demo',
    API_PORT: 0,
    DATABASE_URL: TEST_DATABASE_URL,
    ALLOWED_ORIGIN: 'http://localhost:3000',
    PUBLIC_BASE_URL: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    TRUST_PROXY_HOPS: 0,
    ...overrides,
  };
}

/** Drops and recreates the public schema, then runs every migration. Throwaway database only. */
export async function resetDatabase(): Promise<DataSource> {
  const ds = createDataSource({ databaseUrl: TEST_DATABASE_URL, applicationName: 'bhagyarekha-test' });
  await ds.initialize();
  await ds.query('DROP SCHEMA public CASCADE');
  await ds.query('CREATE SCHEMA public');
  await ds.runMigrations({ transaction: 'each' });
  return ds;
}

export async function markMode(ds: DataSource, mode: 'demo' | 'live'): Promise<void> {
  await ds.getRepository(DeploymentMetadataEntity).insert({ id: 1, dataMode: mode, initializedAt: new Date(), note: 'test' });
}

export async function seedDemoDatabase(ds: DataSource): Promise<void> {
  await seedDemo(ds, { configuredMode: 'demo' });
}

export const silentLogger = () => createLogger({ level: 'silent', appEnv: 'test', dataMode: 'demo' });

/** Boots the real HTTP app (all middleware, filters, guards) against the test database with a fixed IST "today". */
export async function bootApp(options: { today?: string; env?: Partial<Env> } = {}): Promise<INestApplication> {
  const env = testEnv(options.env);
  const clock = new FixedClock(new Date(`${options.today ?? '2026-09-24'}T06:00:00.000Z`));
  const { app } = await createApp({ env, clock, logger: silentLogger(), rateLimitPerMinute: 100_000 });
  return app;
}

import { DataSource, type DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from './entities/index.js';
import { ALL_MIGRATIONS } from './migrations/index.js';

export interface DataSourceConfig {
  databaseUrl: string;
  /** Emit SQL to stdout. Never enabled by default; SQL may include filter parameters. */
  logging?: boolean;
  applicationName?: string;
}

/**
 * The single TypeORM configuration. `synchronize` is always false: schema
 * changes happen only through reviewed migrations in ./migrations.
 */
export interface PostgresConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
}

/**
 * Explicit URL parsing: TypeORM's own `url` handling was observed to mis-assign
 * the password as the database name with typeorm 1.1.1, so fields are passed
 * individually. Supports `?sslmode=require`.
 */
export function parsePostgresUrl(databaseUrl: string): PostgresConnection {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(`DATABASE_URL must use postgres:// or postgresql:// (got ${url.protocol})`);
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) throw new Error('DATABASE_URL must include a database name');
  const sslmode = url.searchParams.get('sslmode');
  return {
    host: url.hostname,
    port: url.port ? Number.parseInt(url.port, 10) : 5432,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    ssl: sslmode !== null && sslmode !== 'disable',
  };
}

export function buildDataSourceOptions(config: DataSourceConfig): DataSourceOptions {
  const conn = parsePostgresUrl(config.databaseUrl);
  return {
    type: 'postgres',
    host: conn.host,
    port: conn.port,
    username: conn.username,
    password: conn.password,
    database: conn.database,
    ssl: conn.ssl ? { rejectUnauthorized: true } : false,
    entities: ALL_ENTITIES,
    migrations: ALL_MIGRATIONS,
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false,
    logging: config.logging ?? false,
    applicationName: config.applicationName ?? 'bhagyarekha-api',
    extra: {
      max: 10,
      statement_timeout: 10_000,
    },
  };
}

export function createDataSource(config: DataSourceConfig): DataSource {
  return new DataSource(buildDataSourceOptions(config));
}

import { describe, expect, it } from 'vitest';
import { buildDataSourceOptions, parsePostgresUrl } from '../../src/database/data-source.js';

describe('parsePostgresUrl', () => {
  it('extracts every field and decodes credentials', () => {
    expect(parsePostgresUrl('postgres://user%40x:p%3Ass@db.internal:5434/bhagyarekha_demo?sslmode=require')).toEqual({
      host: 'db.internal',
      port: 5434,
      username: 'user@x',
      password: 'p:ss',
      database: 'bhagyarekha_demo',
      ssl: true,
    });
  });
  it('defaults the port and rejects non-postgres schemes', () => {
    expect(parsePostgresUrl('postgresql://a:b@localhost/x').port).toBe(5432);
    expect(() => parsePostgresUrl('mysql://a:b@localhost/x')).toThrow();
    expect(() => parsePostgresUrl('postgres://a:b@localhost')).toThrow(/database name/);
  });
});

describe('buildDataSourceOptions', () => {
  it('never enables schema synchronisation or auto-migrations', () => {
    const options = buildDataSourceOptions({ databaseUrl: 'postgres://a:b@localhost/x' });
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
    expect(options.logging).toBe(false);
  });
});

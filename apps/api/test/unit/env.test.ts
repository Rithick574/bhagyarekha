import { describe, expect, it } from 'vitest';
import { EnvError, loadEnv } from '../../src/config/env.js';

const valid = {
  DATA_MODE: 'demo',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  ALLOWED_ORIGIN: 'http://localhost:3000',
  PUBLIC_BASE_URL: 'http://localhost:3000',
};

describe('loadEnv', () => {
  it('applies defaults and coerces numbers', () => {
    const env = loadEnv({ ...valid, API_PORT: '4000' });
    expect(env.API_PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.TRUST_PROXY_HOPS).toBe(0);
  });

  it('rejects an unknown DATA_MODE and reports key names only', () => {
    let caught: unknown;
    try {
      loadEnv({ ...valid, DATA_MODE: 'staging', DATABASE_URL: 'mysql://x' });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(EnvError);
    const err = caught as EnvError;
    expect(err.invalidKeys.sort()).toEqual(['DATABASE_URL', 'DATA_MODE']);
    expect(err.message).not.toContain('mysql://x');
  });

  it('requires DATA_MODE explicitly — there is no default mode', () => {
    const withoutMode: Record<string, string> = { ...valid };
    delete withoutMode.DATA_MODE;
    expect(() => loadEnv(withoutMode)).toThrow(EnvError);
  });
});

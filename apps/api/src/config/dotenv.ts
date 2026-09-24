import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads the first `.env` found at cwd or up to three parent directories, without
 * overriding variables already present in the process environment. Safe to call
 * when no file exists. Never called by pure unit tests.
 */
export function loadDotEnv(startDir: string = process.cwd()): string | null {
  let dir = startDir;
  for (let depth = 0; depth < 4; depth += 1) {
    const candidate = resolve(dir, '.env');
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return candidate;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

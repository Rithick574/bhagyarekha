import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import { loadDotEnv } from '../config/dotenv.js';
import { EnvError, loadEnv, type Env } from '../config/env.js';
import { createDataSource } from '../database/data-source.js';

export interface CliContext {
  env: Env;
  dataSource: DataSource;
  args: string[];
}

/** Shared CLI bootstrap: loads .env, validates configuration, opens one DataSource. */
export async function withCli(name: string, run: (ctx: CliContext) => Promise<number>): Promise<void> {
  const dotenvPath = loadDotEnv();
  let env: Env;
  try {
    env = loadEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      console.error(`[${name}] ${error.message}${dotenvPath ? '' : ' (no .env file found; copy .env.example to .env)'}`);
      process.exit(2);
    }
    throw error;
  }
  const dataSource = createDataSource({ databaseUrl: env.DATABASE_URL, applicationName: `bhagyarekha-cli-${name}` });
  let exitCode = 1;
  try {
    await dataSource.initialize();
    exitCode = await run({ env, dataSource, args: process.argv.slice(2) });
  } catch (error) {
    console.error(`[${name}] failed: ${error instanceof Error ? error.message : String(error)}`);
    exitCode = 1;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
  process.exit(exitCode);
}

export function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  return args[index + 1];
}

import { DataModeSchema } from '@bhagyarekha/contracts';
import { z } from 'zod';

const PostgresUrlSchema = z.url({ protocol: /^postgres(ql)?$/ });

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.string().min(1).default('local'),
  DATA_MODE: DataModeSchema,
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: PostgresUrlSchema,
  ALLOWED_ORIGIN: z.url(),
  PUBLIC_BASE_URL: z.url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  /** Requests per minute per client for public reads. */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  /** Requests per minute per client for POST /ticket-check (LLD §7.2 proposes 30). */
  RATE_LIMIT_CHECK_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  /** Requests per minute per client for GET /statistics (LLD §7.2 proposes 10). */
  RATE_LIMIT_STATS_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  /** Single-operator deployments may allow the creator of a revision to review it. Recorded on every such publication. */
  ALLOW_SELF_REVIEW: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(24 * 7).default(8),
  IMPORT_MAX_BYTES: z.coerce.number().int().min(1024).max(2 * 1024 * 1024).default(2 * 1024 * 1024),
  IMPORT_MAX_ENTRIES: z.coerce.number().int().min(1).max(20_000).default(20_000),
  /** Development only: allow the session cookie without Secure (never honoured when NODE_ENV=production). */
  INSECURE_DEV_COOKIES: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});
export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {
  constructor(public readonly invalidKeys: string[]) {
    super(`Invalid or missing environment configuration: ${invalidKeys.join(', ')}`);
    this.name = 'EnvError';
  }
}

/** Parses environment variables. Throws EnvError listing key names only — never values. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? '?')))];
    throw new EnvError(keys);
  }
  return result.data;
}

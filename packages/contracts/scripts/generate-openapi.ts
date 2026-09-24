/**
 * Generates openapi.json from the Zod route contracts.
 *   tsx scripts/generate-openapi.ts write   -> rewrite openapi.json
 *   tsx scripts/generate-openapi.ts check   -> exit 1 if openapi.json is stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { API_PREFIX, ErrorResponseSchema, adminRoutes, publicRoutes } from '../src/index.js';
import type { AdminRouteContract, RouteContract } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '..', 'openapi.json');

type JsonRecord = Record<string, unknown>;

function toSchema(schema: z.ZodType): JsonRecord {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', unrepresentable: 'any', io: 'output' }) as JsonRecord;
}

function toInputSchema(schema: z.ZodType): JsonRecord {
  return z.toJSONSchema(schema, { target: 'openapi-3.0', unrepresentable: 'any', io: 'input' }) as JsonRecord;
}

function parametersFor(route: RouteContract): JsonRecord[] {
  const params: JsonRecord[] = [];
  for (const [location, schema] of [
    ['path', route.params],
    ['query', route.query],
  ] as const) {
    if (!schema) continue;
    const json = toInputSchema(schema);
    const properties = (json.properties ?? {}) as Record<string, JsonRecord>;
    const required = new Set((json.required as string[] | undefined) ?? []);
    for (const [name, propSchema] of Object.entries(properties)) {
      params.push({
        name,
        in: location,
        required: location === 'path' ? true : required.has(name),
        schema: propSchema,
      });
    }
  }
  return params;
}

function buildDocument(): JsonRecord {
  const errorSchema = toSchema(ErrorResponseSchema);
  const paths: Record<string, JsonRecord> = {};
  type AnyRoute = RouteContract | AdminRouteContract;
  const all: [string, AnyRoute, string][] = [
    ...(Object.entries(publicRoutes) as [string, RouteContract][]).map(([n, r]): [string, AnyRoute, string] => [n, r, 'public']),
    ...(Object.entries(adminRoutes) as [string, AdminRouteContract][]).map(([n, r]): [string, AnyRoute, string] => [n, r, 'admin']),
  ];
  for (const [name, route, tag] of all) {
    const role = 'role' in route ? route.role : undefined;
    const headers = 'headers' in route ? (route.headers ?? []) : [];
    const openApiPath = route.path.replace(/:([A-Za-z]+)/g, '{$1}');
    const responses: JsonRecord = {
      '200': {
        description: 'Success',
        headers: { 'Cache-Control': { schema: { type: 'string', enum: ['no-store'] } } },
        content: { 'application/json': { schema: toSchema(route.response) } },
      },
    };
    if (route.failureStatus) {
      responses[String(route.failureStatus)] = {
        description: 'Failure reported with the same body schema',
        content: { 'application/json': { schema: toSchema(route.response) } },
      };
    }
    for (const status of route.errorStatuses) {
      responses[String(status)] = {
        description: 'Error envelope',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      };
    }
    const headerParams: JsonRecord[] = headers.map((h) => ({ name: h, in: 'header', required: true, schema: { type: 'string' } }));
    const operation: JsonRecord = {
      operationId: name,
      tags: [tag],
      summary: route.summary + (role && role !== 'NONE' ? ` (requires ${role === 'SESSION' ? 'a session' : `role ${role}`}; unsafe methods need Origin + X-CSRF-Token)` : ''),
      parameters: [...parametersFor(route), ...headerParams],
      responses,
    };
    if (route.body) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: toInputSchema(route.body) } },
      };
    }
    paths[openApiPath] = { ...(paths[openApiPath] ?? {}), [route.method.toLowerCase()]: operation };
  }
  return {
    openapi: '3.0.3',
    info: {
      title: 'BhagyaRekha public API',
      version: '0.1.0',
      description:
        'Read-only public API. Every response carries dataMode; demo deployments serve synthetic fixtures only. Generated from packages/contracts — do not edit by hand.',
    },
    servers: [{ url: API_PREFIX }],
    paths,
    components: { schemas: { ErrorResponse: errorSchema } },
  };
}

const mode = process.argv[2] ?? 'check';
const rendered = JSON.stringify(buildDocument(), null, 2) + '\n';

if (mode === 'write') {
  writeFileSync(target, rendered);
  console.log(`openapi.json written (${rendered.length} bytes)`);
} else if (mode === 'check') {
  let existing = '';
  try {
    existing = readFileSync(target, 'utf8');
  } catch {
    console.error('openapi.json is missing. Run: pnpm --filter @bhagyarekha/contracts openapi:generate');
    process.exit(1);
  }
  if (existing !== rendered) {
    console.error('openapi.json is stale relative to the Zod contracts. Run: pnpm --filter @bhagyarekha/contracts openapi:generate');
    process.exit(1);
  }
  console.log('openapi.json is up to date');
} else {
  console.error(`Unknown mode "${mode}". Use write or check.`);
  process.exit(2);
}

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RequestHandler } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmetModule from 'helmet';

// Helmet 8 exports the middleware as default. NodeNext sometimes types that
// import as the module namespace, which is not callable.
const helmet = helmetModule as unknown as (options?: {
  contentSecurityPolicy?: { directives?: Record<string, null | Iterable<string>> };
  crossOriginResourcePolicy?: { policy?: 'same-origin' | 'same-site' | 'cross-origin' };
}) => RequestHandler;
import { loadDotEnv } from './config/dotenv.js';
import { loadEnv } from './config/env.js';
import { AppModule, type AppModuleOptions } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { type AppLogger, PinoNestLogger, createLogger, requestLogMiddleware } from './common/logger.js';
import { noStoreMiddleware, requestIdMiddleware } from './common/request-context.js';

export interface CreateAppOptions extends AppModuleOptions {
  logger?: AppLogger;
  /** Test-only: provider overrides applied through @nestjs/testing (loaded lazily, never in production paths). */
  overrides?: (builder: import('@nestjs/testing').TestingModuleBuilder) => import('@nestjs/testing').TestingModuleBuilder;
}

/**
 * Builds and initialises the HTTP application. Bootstrap fails (rejects) when
 * the database mode disagrees with DATA_MODE or migrations are pending.
 */
export async function createApp(options: CreateAppOptions): Promise<{ app: NestExpressApplication; logger: AppLogger }> {
  const { env } = options;
  const logger = options.logger ?? createLogger({ level: env.LOG_LEVEL, appEnv: env.APP_ENV, dataMode: env.DATA_MODE });

  const nestLogger = new PinoNestLogger(logger);
  let app: NestExpressApplication;
  if (options.overrides) {
    const { Test } = await import('@nestjs/testing');
    const moduleRef = await options.overrides(Test.createTestingModule({ imports: [AppModule.forRoot(options)] })).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, abortOnError: false, logger: nestLogger });
  } else {
    app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(options), { bodyParser: false, abortOnError: false, logger: nestLogger });
  }

  app.setGlobalPrefix('api/v1');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.enableCors({
    // Callback form: a non-matching Origin receives no CORS headers at all (a string origin would be echoed unconditionally).
    origin: (origin, callback) => callback(null, origin === env.ALLOWED_ORIGIN),
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
    maxAge: 600,
  });
  // Imports may carry up to IMPORT_MAX_BYTES of CSV/JSON text (plus envelope); every other route stays small.
  const isImportRoute = (req: IncomingMessage) => (req.url ?? '').startsWith('/api/v1/admin/imports') && /^application\/json/i.test(String(req.headers['content-type'] ?? ''));
  app.useBodyParser('json', { limit: env.IMPORT_MAX_BYTES + 256 * 1024, type: isImportRoute });
  app.useBodyParser('json', { limit: '64kb', type: (req: IncomingMessage) => !isImportRoute(req) && /^application\/json/i.test(String(req.headers['content-type'] ?? '')) });
  app.use(requestIdMiddleware);
  app.use(noStoreMiddleware);
  app.use(requestLogMiddleware(logger));
  app.useGlobalFilters(new ApiExceptionFilter(logger));
  app.enableShutdownHooks();

  await app.init();
  return { app, logger };
}

type NodeListener = (req: IncomingMessage, res: ServerResponse) => void;

let expressApp: Promise<NodeListener> | undefined;

function nestExpressApp(): Promise<NodeListener> {
  expressApp ??= createApp({ env: loadEnv() })
    .then(({ app }) => app.getHttpAdapter().getInstance() as unknown as NodeListener)
    .catch((error: unknown) => {
      expressApp = undefined;
      throw error;
    });
  return expressApp;
}

/**
 * Vercel treats this module as the function entry and requires a default export
 * that is a request handler or an HTTP server. Local `main.ts` still calls listen().
 * The Nest app is created on the first request, not when tests import createApp.
 */
export default async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  loadDotEnv();
  const handle = await nestExpressApp();
  handle(req, res);
}

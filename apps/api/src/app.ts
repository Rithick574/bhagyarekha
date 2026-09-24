import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule, type AppModuleOptions } from './app.module.js';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { type AppLogger, PinoNestLogger, createLogger, requestLogMiddleware } from './common/logger.js';
import { noStoreMiddleware, requestIdMiddleware } from './common/request-context.js';

export interface CreateAppOptions extends AppModuleOptions {
  logger?: AppLogger;
}

/**
 * Builds and initialises the HTTP application. Bootstrap fails (rejects) when
 * the database mode disagrees with DATA_MODE or migrations are pending.
 */
export async function createApp(options: CreateAppOptions): Promise<{ app: NestExpressApplication; logger: AppLogger }> {
  const { env } = options;
  const logger = options.logger ?? createLogger({ level: env.LOG_LEVEL, appEnv: env.APP_ENV, dataMode: env.DATA_MODE });

  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(options), {
    bodyParser: false,
    abortOnError: false,
    logger: new PinoNestLogger(logger),
  });

  app.setGlobalPrefix('api/v1');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.enableCors({
    // Callback form: a non-matching Origin receives no CORS headers at all (a string origin would be echoed unconditionally).
    origin: (origin, callback) => callback(null, origin === env.ALLOWED_ORIGIN),
    methods: ['GET', 'POST'],
    credentials: true,
    maxAge: 600,
  });
  app.useBodyParser('json', { limit: '64kb' });
  app.use(requestIdMiddleware);
  app.use(noStoreMiddleware);
  app.use(requestLogMiddleware(logger));
  app.useGlobalFilters(new ApiExceptionFilter(logger));
  app.enableShutdownHooks();

  await app.init();
  return { app, logger };
}

import 'reflect-metadata';
import { loadDotEnv } from './config/dotenv.js';
import { EnvError, loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { createLogger } from './common/logger.js';

async function bootstrap(): Promise<void> {
  loadDotEnv();
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    if (error instanceof EnvError) {
      console.error(`[api] ${error.message}. See .env.example.`);
      process.exit(2);
    }
    throw error;
  }
  const logger = createLogger({ level: env.LOG_LEVEL, appEnv: env.APP_ENV, dataMode: env.DATA_MODE });
  try {
    const { app } = await createApp({ env, logger });
    await app.listen(env.API_PORT);
    logger.info({ port: env.API_PORT, dataMode: env.DATA_MODE, appEnv: env.APP_ENV }, 'api listening');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.fatal({ err: { message } }, 'api failed to start');
    process.exit(1);
  }
}

await bootstrap();

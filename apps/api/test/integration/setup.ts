import 'reflect-metadata';
import { loadDotEnv } from '../../src/config/dotenv.js';

// Integration tests read TEST_DATABASE_URL from the root .env (or the environment).
loadDotEnv();
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not set. Copy .env.example to .env and point it at a throwaway database.');
}

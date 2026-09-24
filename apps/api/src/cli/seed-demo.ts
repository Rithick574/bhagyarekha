import { SeedRefusedError, seedDemo } from '../fixtures/seed-demo.js';
import { withCli } from './_bootstrap.js';

/**
 * pnpm seed:demo
 * Idempotently loads the synthetic fixtures. Refuses live databases and live
 * configuration; there is intentionally no --force flag.
 */
await withCli('seed-demo', async ({ dataSource, env, args }) => {
  if (args.some((a) => a.startsWith('--force'))) {
    console.error('[seed-demo] --force is not supported: synthetic fixtures never enter a live database.');
    return 1;
  }
  try {
    const summary = await seedDemo(dataSource, { configuredMode: env.DATA_MODE });
    console.log(`[seed-demo] ${JSON.stringify(summary)}`);
    console.log('[seed-demo] Sample data only — not live results.');
    return 0;
  } catch (error) {
    if (error instanceof SeedRefusedError) {
      console.error(`[seed-demo] ${error.message}`);
      return 1;
    }
    throw error;
  }
});

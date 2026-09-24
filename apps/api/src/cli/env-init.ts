import { DeploymentMetadataEntity } from '../database/entities/index.js';
import { flagValue, withCli } from './_bootstrap.js';

/**
 * pnpm env:init -- --mode demo|live
 * Writes the immutable deployment_metadata marker. The flag must equal DATA_MODE
 * so that a copy-pasted command cannot mark a database with the wrong mode.
 * An existing marker with a different mode is an error, never overwritten.
 */
await withCli('env-init', async ({ dataSource, args, env }) => {
  const requested = flagValue(args, '--mode');
  if (requested !== 'demo' && requested !== 'live') {
    console.error('[env-init] usage: pnpm env:init -- --mode demo|live');
    return 2;
  }
  if (requested !== env.DATA_MODE) {
    console.error(`[env-init] refusing: --mode ${requested} does not match DATA_MODE=${env.DATA_MODE} in the environment.`);
    return 1;
  }
  if (await dataSource.showMigrations()) {
    console.error('[env-init] refusing: pending migrations. Run `pnpm db:migrate` first.');
    return 1;
  }
  const repo = dataSource.getRepository(DeploymentMetadataEntity);
  const existing = await repo.findOne({ where: { id: 1 } });
  if (existing) {
    if (existing.dataMode === requested) {
      console.log(`[env-init] database already marked ${requested} (initialized ${existing.initializedAt.toISOString()}); nothing to do`);
      return 0;
    }
    console.error(`[env-init] refusing: database is already marked ${existing.dataMode}. Modes are immutable; use a different database for ${requested}.`);
    return 1;
  }
  await repo.insert({ id: 1, dataMode: requested, initializedAt: new Date(), note: `initialized by env-init (APP_ENV=${env.APP_ENV})` });
  console.log(`[env-init] database marked ${requested}`);
  return 0;
});

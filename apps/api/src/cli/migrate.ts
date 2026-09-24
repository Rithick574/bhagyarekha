import { withCli } from './_bootstrap.js';

/**
 * pnpm db:migrate            run pending migrations (each in its own transaction)
 * pnpm db:migrate -- --status list executed and pending migrations without changing anything
 */
await withCli('migrate', async ({ dataSource, args, env }) => {
  const pending = await dataSource.showMigrations();
  if (args.includes('--status')) {
    const executed = await dataSource.query<{ name: string }[]>('SELECT name FROM typeorm_migrations ORDER BY id').catch(() => []);
    console.log(`[migrate] database mode: ${env.DATA_MODE} (configured)`);
    console.log(`[migrate] executed: ${executed.map((r) => r.name).join(', ') || '(none)'}`);
    console.log(`[migrate] pending: ${pending ? 'yes' : 'no'}`);
    return 0;
  }
  if (!pending) {
    console.log('[migrate] no pending migrations');
    return 0;
  }
  const ran = await dataSource.runMigrations({ transaction: 'each' });
  for (const m of ran) console.log(`[migrate] applied ${m.name}`);
  console.log(`[migrate] applied ${ran.length} migration(s)`);
  return 0;
});

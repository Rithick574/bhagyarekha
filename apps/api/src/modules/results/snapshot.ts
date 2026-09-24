import type { DataSource, EntityManager } from 'typeorm';

/**
 * Runs `work` inside a short READ ONLY, REPEATABLE READ transaction so every
 * query observes the same committed snapshot (INV-05). No network calls inside.
 */
export async function withReadSnapshot<T>(dataSource: DataSource, work: (m: EntityManager) => Promise<T>): Promise<T> {
  return dataSource.transaction('REPEATABLE READ', async (m) => {
    await m.query('SET TRANSACTION READ ONLY');
    return work(m);
  });
}

import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Migration 6 — read-path indexes from the LLD. */
export class Indexes1758700000006 implements MigrationInterface {
  name = 'Indexes1758700000006';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE INDEX draw_lottery_display_date_idx
      ON draw (lottery_id, (COALESCE(actual_date, scheduled_date)) DESC, id DESC)
    `);
    await q.query(`
      CREATE INDEX draw_display_date_idx
      ON draw ((COALESCE(actual_date, scheduled_date)) DESC, id DESC)
    `);
    await q.query(`CREATE INDEX revision_draw_state_idx ON result_revision (draw_id, workflow_state)`);
    await q.query(`CREATE INDEX winning_entry_lookup_idx ON winning_entry (revision_id, category_code, number, series)`);
    await q.query(`CREATE INDEX rule_version_lottery_state_idx ON rule_version (lottery_id, state)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX rule_version_lottery_state_idx`);
    await q.query(`DROP INDEX winning_entry_lookup_idx`);
    await q.query(`DROP INDEX revision_draw_state_idx`);
    await q.query(`DROP INDEX draw_display_date_idx`);
    await q.query(`DROP INDEX draw_lottery_display_date_idx`);
  }
}

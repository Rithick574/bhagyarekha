import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DataSource } from 'typeorm';
import { createApp } from '../../src/app.js';
import { DeploymentMetadataEntity, DrawEntity, ResultRevisionEntity, WinningEntryEntity } from '../../src/database/entities/index.js';
import { IDS } from '../../src/fixtures/demo-fixtures.js';
import { SeedRefusedError, seedDemo } from '../../src/fixtures/seed-demo.js';
import { markMode, resetDatabase, silentLogger, testEnv } from './helpers.js';

describe('schema, mode isolation and immutability guards (real PostgreSQL)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await resetDatabase();
  });
  afterAll(async () => {
    await ds.destroy();
  });

  it('applies all migrations from an empty schema and leaves none pending', async () => {
    expect(await ds.showMigrations()).toBe(false);
    const tables = await ds.query<{ table_name: string }[]>(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`);
    expect(tables.map((t) => t.table_name)).toEqual(
      expect.arrayContaining(['deployment_metadata', 'admin_user', 'lottery', 'rule_version', 'rule_category', 'source_evidence', 'draw', 'result_revision', 'revision_category', 'winning_entry', 'revision_evidence']),
    );
  });

  it('refuses to start the API when the database mode is uninitialised (AC-09)', async () => {
    await expect(createApp({ env: testEnv(), logger: silentLogger() })).rejects.toThrow(/no deployment_metadata row/);
  });

  it('refuses to seed an uninitialised database and any non-demo configuration', async () => {
    await expect(seedDemo(ds, { configuredMode: 'demo' })).rejects.toBeInstanceOf(SeedRefusedError);
    await expect(seedDemo(ds, { configuredMode: 'live' })).rejects.toThrow(/not "demo"/);
    expect(await ds.getRepository(DrawEntity).count()).toBe(0);
  });

  it('marks the database demo, never lets the marker flip, and refuses a live-configured API (T26)', async () => {
    await markMode(ds, 'demo');
    await expect(ds.query(`UPDATE deployment_metadata SET data_mode = 'live' WHERE id = 1`)).rejects.toThrow(/immutable/);
    await expect(ds.query(`DELETE FROM deployment_metadata`)).rejects.toThrow(/cannot be deleted/);
    await expect(ds.query(`INSERT INTO deployment_metadata (id, data_mode) VALUES (2, 'live')`)).rejects.toThrow();
    await expect(createApp({ env: testEnv({ DATA_MODE: 'live' }), logger: silentLogger() })).rejects.toThrow(/DATA_MODE=live but the database is marked demo/);
    expect((await ds.getRepository(DeploymentMetadataEntity).findOneByOrFail({ id: 1 })).dataMode).toBe('demo');
  });

  it('seeds idempotently: a second run inserts nothing and duplicates no winning rows (AC-06)', async () => {
    const first = await seedDemo(ds, { configuredMode: 'demo' });
    expect(first.revisionsInserted).toBe(9);
    const entriesAfterFirst = await ds.getRepository(WinningEntryEntity).count();
    const second = await seedDemo(ds, { configuredMode: 'demo' });
    expect(second).toMatchObject({ lotteriesInserted: 0, ruleVersionsInserted: 0, drawsInserted: 0, revisionsInserted: 0, entriesInserted: 0 });
    expect(await ds.getRepository(WinningEntryEntity).count()).toBe(entriesAfterFirst);
  });

  it('stores leading zeros verbatim as strings (T01/AC-05)', async () => {
    const rows = await ds.query<{ number: string; series: string }[]>(`SELECT number, series FROM winning_entry WHERE revision_id = $1 AND category_code = 'FIRST'`, [IDS.revNila039r1]);
    expect(rows).toEqual([{ number: '001234', series: 'AA' }]);
    const suffix = await ds.query<{ number: string }[]>(`SELECT number FROM winning_entry WHERE revision_id = $1 AND number = '0042'`, [IDS.revNila039r1]);
    expect(suffix).toHaveLength(1);
  });

  it('rejects in-place edits and deletes of published payloads (T17 / INV-04)', async () => {
    await expect(ds.query(`UPDATE winning_entry SET number = '999999' WHERE revision_id = $1 AND category_code = 'FIRST'`, [IDS.revNila039r1])).rejects.toThrow(/immutable/);
    await expect(ds.query(`DELETE FROM winning_entry WHERE revision_id = $1`, [IDS.revNila039r1])).rejects.toThrow(/immutable/);
    await expect(ds.query(`INSERT INTO winning_entry (revision_id, category_code, series, number) VALUES ($1, 'FIRST', 'AB', '000001')`, [IDS.revNila039r1])).rejects.toThrow(/immutable/);
    await expect(ds.query(`UPDATE revision_category SET amount_minor = 1 WHERE revision_id = $1`, [IDS.revNila039r1])).rejects.toThrow(/immutable/);
    await expect(ds.query(`UPDATE result_revision SET completeness = 'PARTIAL' WHERE id = $1`, [IDS.revNila039r1])).rejects.toThrow(/immutable/);
    await expect(ds.query(`UPDATE result_revision SET workflow_state = 'DRAFT' WHERE id = $1`, [IDS.revNila039r1])).rejects.toThrow(/cannot move/);
    await expect(ds.query(`DELETE FROM result_revision WHERE id = $1`, [IDS.revNila039r1])).rejects.toThrow(/cannot be deleted/);
    await expect(ds.query(`UPDATE rule_category SET priority = 99 WHERE rule_version_id = $1 AND code = 'FIRST'`, [IDS.ruleNila1])).rejects.toThrow(/immutable/);
    await expect(ds.query(`UPDATE rule_version SET number_length = 5 WHERE id = $1`, [IDS.ruleNila1])).rejects.toThrow(/immutable/);
    await expect(ds.query(`UPDATE source_evidence SET title = 'tampered' WHERE id = $1`, [IDS.evidenceResults])).rejects.toThrow(/immutable/);
  });

  it('enforces same-lottery composite keys and pointer integrity (T18)', async () => {
    // A revision cannot claim a rule version from another lottery.
    await expect(
      ds.query(
        `INSERT INTO result_revision (id, draw_id, lottery_id, rule_version_id, revision_no, draw_snapshot, workflow_state, publication_kind, completeness, content_hash)
         VALUES ('c0000009-0000-4000-8000-000000000001', $1, $2, $3, 9, '{"drawCode":"X"}', 'DRAFT', 'INITIAL', 'PARTIAL', 'h')`,
        [IDS.drawNila040, IDS.lotteryNila, IDS.ruleThira1],
      ),
    ).rejects.toThrow(/foreign key/);
    // A draw's current pointer must reference one of its own revisions.
    await expect(ds.query(`UPDATE draw SET current_revision_id = $1 WHERE id = $2`, [IDS.revNila039r1, IDS.drawNila040])).rejects.toThrow(/foreign key/);
    // A correction requires a reason; INITIAL forbids a predecessor.
    await expect(
      ds.query(
        `INSERT INTO result_revision (id, draw_id, lottery_id, rule_version_id, revision_no, draw_snapshot, workflow_state, publication_kind, completeness, content_hash, based_on_revision_id)
         VALUES ('c0000009-0000-4000-8000-000000000002', $1, $2, $3, 2, '{"drawCode":"NL-039"}', 'DRAFT', 'CORRECTION', 'COMPLETE', 'h', $4)`,
        [IDS.drawNila039, IDS.lotteryNila, IDS.ruleNila1, IDS.revNila039r1],
      ),
    ).rejects.toThrow(/correction_reason/);
  });

  it('keeps scheduled and actual dates distinct and requires IST agreement (T19)', async () => {
    const postponed = await ds.getRepository(DrawEntity).findOneByOrFail({ id: IDS.drawThira037 });
    expect(postponed.scheduledDate).toBe('2026-09-15');
    expect(postponed.actualDate).toBe('2026-09-16');
    // 2026-09-24T20:00Z is already 25 Sep in IST; the DB must reject the mismatch.
    await expect(
      ds.query(
        `INSERT INTO draw (id, lottery_id, draw_code, scheduled_date, scheduled_at, phase) VALUES ('d0000009-0000-4000-8000-000000000001', $1, 'BAD-IST', '2026-09-24', '2026-09-24T20:00:00Z', 'SCHEDULED')`,
        [IDS.lotteryNila],
      ),
    ).rejects.toThrow(/draw_scheduled_ist_chk/);
    await expect(ds.query(`INSERT INTO draw (id, lottery_id, draw_code, phase) VALUES ('d0000009-0000-4000-8000-000000000002', $1, 'NO-DATE', 'SCHEDULED')`, [IDS.lotteryNila])).rejects.toThrow(/draw_some_date_chk/);
    // Two different draws on one date coexist.
    const sameDate = await ds.query<{ n: string }[]>(`SELECT COUNT(*)::text AS n FROM draw WHERE COALESCE(actual_date, scheduled_date) = '2026-09-17'`);
    expect(Number(sameDate[0]?.n)).toBe(2);
  });

  it('keeps earlier revisions when a correction supersedes them (AC-07)', async () => {
    const revisions = await ds.getRepository(ResultRevisionEntity).find({ where: { drawId: IDS.drawThira037 }, order: { revisionNo: 'ASC' } });
    expect(revisions.map((r) => [r.revisionNo, r.workflowState, r.publicationKind])).toEqual([
      [1, 'SUPERSEDED', 'INITIAL'],
      [2, 'PUBLISHED', 'CORRECTION'],
    ]);
    const draw = await ds.getRepository(DrawEntity).findOneByOrFail({ id: IDS.drawThira037 });
    expect(draw.currentRevisionId).toBe(IDS.revThira037r2);
    const oldNumbers = await ds.query<{ number: string }[]>(`SELECT number FROM winning_entry WHERE revision_id = $1 AND category_code = 'FIRST'`, [IDS.revThira037r1]);
    expect(oldNumbers).toEqual([{ number: '123456' }]);
  });
});

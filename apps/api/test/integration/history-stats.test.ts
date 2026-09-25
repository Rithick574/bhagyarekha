import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import { pino } from 'pino';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AdminRevisionSchema, DrawListResponseSchema, ErrorResponseSchema, HistorySearchResponseSchema, StatisticsResponseSchema } from '@bhagyarekha/contracts';
import { createApp } from '../../src/app.js';
import { FixedClock } from '../../src/common/clock.js';
import { IDS } from '../../src/fixtures/demo-fixtures.js';
import { createAdmin, key, loginAs } from './admin-helpers.js';
import { markMode, resetDatabase, seedDemoDatabase, testEnv } from './helpers.js';

describe('history search and descriptive statistics (real PostgreSQL, seeded demo)', () => {
  let ds: DataSource;
  let app: INestApplication;
  const logLines: string[] = [];
  const http = () => request(app.getHttpServer());
  const search = (body: unknown) => http().post('/api/v1/history/search').set('content-type', 'application/json').send(body as object);
  const stats = (qs: string) => http().get(`/api/v1/statistics?${qs}`);

  beforeAll(async () => {
    ds = await resetDatabase();
    await markMode(ds, 'demo');
    await seedDemoDatabase(ds);
    await createAdmin(ds, 'publisher@example.test', 'PUBLISHER');
    const sink = new Writable({ write(chunk, _enc, cb) { logLines.push(String(chunk)); cb(); } });
    ({ app } = await createApp({ env: testEnv({ LOG_LEVEL: 'trace', ALLOW_SELF_REVIEW: true }), clock: new FixedClock(new Date('2026-09-24T12:00:00Z')), logger: pino({ level: 'trace' }, sink), rateLimitPerMinute: 100_000, rateLimitCheckPerMinute: 100_000, rateLimitStatsPerMinute: 100_000 }));
  });
  afterAll(async () => {
    await app?.close();
    await ds?.destroy();
  });

  it('history list filters by exact draw code (case-insensitive) and date range', async () => {
    const byCode = DrawListResponseSchema.parse((await http().get('/api/v1/draws?drawCode=th-037').expect(200)).body);
    expect(byCode.items.map((d) => d.drawCode)).toEqual(['TH-037']);
    expect(byCode.items[0]?.currentRevision?.isCorrection).toBe(true);
    const sameDay = DrawListResponseSchema.parse((await http().get('/api/v1/draws?from=2026-09-17&to=2026-09-17').expect(200)).body);
    expect(sameDay.items.map((d) => d.drawCode).sort()).toEqual(['NL-038', 'SB-2026-01']);
    await http().get('/api/v1/draws?drawCode=has space').expect(400);
  });

  it('FULL search finds every category holding that full number in current revisions only', async () => {
    const res = HistorySearchResponseSchema.parse((await search({ lotteryId: IDS.lotteryNila, searchType: 'FULL', number: '001234' }).expect(200)).body);
    expect(res.items.map((i) => [i.drawCode, i.categoryCode, i.series, i.number])).toEqual([['NL-039', 'FIRST', 'AA', '001234'], ['NL-039', 'CONSOLATION', 'AA', '001234']]);
    expect(res.items[0]).toMatchObject({ publicationStatus: 'COMPLETE', revisionNo: 1, categoryLabel: { en: 'First prize' } });
    // The superseded first prize of TH-037 (123456) is not searchable; the corrected one is.
    expect(HistorySearchResponseSchema.parse((await search({ searchType: 'FULL', number: '123456' }).expect(200)).body).total).toBe(0);
    expect(HistorySearchResponseSchema.parse((await search({ searchType: 'FULL', number: '123465' }).expect(200)).body).items[0]?.drawCode).toBe('TH-037');
  });

  it('SUFFIX search matches suffix entries of that exact length and full numbers ending with it', async () => {
    const zero = HistorySearchResponseSchema.parse((await search({ lotteryId: IDS.lotteryNila, searchType: 'SUFFIX', number: '0042' }).expect(200)).body);
    expect(zero.items.map((i) => [i.drawCode, i.categoryCode, i.number])).toEqual([['NL-039', 'LAST4', '0042']]);
    const both = HistorySearchResponseSchema.parse((await search({ lotteryId: IDS.lotteryNila, searchType: 'SUFFIX', number: '1234' }).expect(200)).body);
    expect(both.items.map((i) => [i.categoryCode, i.number])).toEqual([['FIRST', '001234'], ['CONSOLATION', '001234'], ['LAST4', '1234']]);
    // A 3-digit suffix does not match 4-digit suffix entries, but does match full numbers ending in it.
    const three = HistorySearchResponseSchema.parse((await search({ lotteryId: IDS.lotteryNila, searchType: 'SUFFIX', number: '234' }).expect(200)).body);
    expect(three.items.every((i) => i.categoryCode !== 'LAST4')).toBe(true);
    expect(three.total).toBe(2);
  });

  it('excludes suspended, unpublished and cancelled draws and reports them as unsearchable; bounds the range', async () => {
    const res = HistorySearchResponseSchema.parse((await search({ searchType: 'FULL', number: '555000', from: '2026-09-01', to: '2026-09-30' }).expect(200)).body);
    expect(res.total).toBe(0); // NL-037 is suspended
    // In Sept: NL-037 (suspended), TH-039 (unpublished), SB-2026-02 (cancelled, 30 Sep) are unsearchable.
    expect(res.unsearchableDrawCount).toBe(3);
    expect(res).toMatchObject({ from: '2026-09-01', to: '2026-09-30' });
    const defaulted = HistorySearchResponseSchema.parse((await search({ searchType: 'FULL', number: '000000' }).expect(200)).body);
    expect(defaulted.to).toBe('2026-09-24');
    expect(defaulted.from).toBe('2025-09-24');
    const tooLong = await search({ searchType: 'FULL', number: '000000', from: '2025-01-01', to: '2026-09-24' }).expect(400);
    expect(ErrorResponseSchema.parse(tooLong.body).error.fields?.[0]?.code).toBe('RANGE_TOO_LONG');
    await search({ searchType: 'FULL', number: '12 34' }).expect(400);
    await http().get('/api/v1/history/search?number=001234').expect(404);
  });

  it('statistics for Nila in September: three eligible first prizes, suspended draw excluded, known draws = 4', async () => {
    const body = StatisticsResponseSchema.parse((await stats(`lotteryId=${IDS.lotteryNila}&from=2026-09-01&to=2026-09-30`).expect(200)).body);
    expect(body.scope).toMatchObject({ observationCount: 3, drawCount: 3, knownDrawCount: 4, numberLength: 6, categoryCodes: ['FIRST'], ruleVersionIds: [IDS.ruleNila1], calendarCoverage: 'UNKNOWN', dataMode: 'demo', computedAt: '2026-09-24T12:00:00.000Z' });
    expect(body.scope.excludedDrawCounts).toEqual({ NOT_PUBLISHED: 0, SUSPENDED: 1, CANCELLED: 0, FIRST_PRIZE_INCOMPLETE: 0, RULE_UNSUPPORTED: 0, INCOMPATIBLE_RULE_VERSION: 0 });
    // Observations: 100200 (NL-036), 045678 (NL-038), 001234 (NL-039).
    for (const row of body.positionDigitCounts) expect(row.reduce((a, b) => a + b, 0)).toBe(3);
    expect(body.positionDigitCounts[0]).toEqual([2, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(body.lastTwo.top.map((t) => t.key)).toEqual(['00', '34', '78']);
    expect(body.parity).toEqual({ odd: 0, even: 3, oddShare: 0 });
    expect(body.digitSum.distribution.map((d) => [d.key, d.count])).toEqual([['3', 1], ['10', 1], ['30', 1]]);
    expect(body.consecutiveRuns.count).toBe(2);
    expect(body.notes.some((n) => /not probabilities/i.test(n))).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/p-value|significan|confidence/i);
  });

  it('counts the corrected current revision once and a partial draw whose first prize is complete and reviewed (T23)', async () => {
    const body = StatisticsResponseSchema.parse((await stats(`lotteryId=${IDS.lotteryThira}&from=2026-09-01&to=2026-09-30`).expect(200)).body);
    // TH-036 654321, TH-037 corrected 123465 (not 123456), TH-038 partial but FIRST complete+reviewed 000077; TH-039 unpublished.
    expect(body.scope).toMatchObject({ observationCount: 3, drawCount: 3, knownDrawCount: 4 });
    expect(body.scope.excludedDrawCounts.NOT_PUBLISHED).toBe(1);
    expect(body.lastThree.top.map((t) => t.key).sort()).toEqual(['077', '321', '465']);
    expect(body.repeated).toMatchObject({ distinctNumbers: 3, distinctTickets: 3, numberCollisionPairs: 0 });
  });

  it('empty sample: zero counts, null shares, exclusions explain why (T22)', async () => {
    const bumper = StatisticsResponseSchema.parse((await stats(`lotteryId=${IDS.lotteryBumper}&from=2026-09-01&to=2026-09-30`).expect(200)).body);
    expect(bumper.scope).toMatchObject({ observationCount: 0, drawCount: 0, knownDrawCount: 2, numberLength: null });
    expect(bumper.scope.excludedDrawCounts).toMatchObject({ RULE_UNSUPPORTED: 1, CANCELLED: 1 });
    expect(bumper.parity.oddShare).toBeNull();
    expect(bumper.duplicateDigits.share).toBeNull();
    const nothing = StatisticsResponseSchema.parse((await stats(`lotteryId=${IDS.lotteryNila}&from=2020-01-01&to=2020-01-31`).expect(200)).body);
    expect(nothing.scope.knownDrawCount).toBe(0);
    await stats(`lotteryId=${IDS.lotteryNila}&from=2025-01-01&to=2026-01-31`).expect(400);
    await stats(`lotteryId=00000000-0000-4000-8000-000000000000&from=2026-09-01&to=2026-09-30`).expect(404);
  });

  it('refuses to mix number domains silently; an explicit ruleVersionId selects one domain', async () => {
    // Publish a 7-digit result for Nila under a new approved rule version.
    const publisher = await loginAs(app, 'publisher@example.test');
    const ruleSet = { schemaVersion: 1, engineVersion: 'v1', lotteryCode: 'DEMO_NILA', ruleVersion: 2, numberLength: 7, allowedFirstDigits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], allowedSeries: ['AA'], awardPolicy: 'SINGLE_BY_PRIORITY', categories: [{ code: 'FIRST', labels: { en: 'First prize', ml: 'ഒന്നാം സമ്മാനം' }, metricRole: 'FIRST_PRIZE', priority: 1, match: { kind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY' }, excludedBy: [], expectedEntryCount: 1 }] };
    const source = { kind: 'MANUAL_TRANSCRIPTION', title: 'Synthetic rule v2', url: null, documentHash: null, acquiredAt: null, note: null };
    const rule = await publisher.post(`/admin/lotteries/${IDS.lotteryNila}/rules`, { ruleSet, source }).expect(201);
    await publisher.post(`/admin/rules/${rule.body.id}/approve`, { note: 'synthetic' }, { 'Idempotency-Key': key() }).expect(200);
    await publisher.post('/admin/draws', { lotteryId: IDS.lotteryNila, drawCode: 'NL-7D', scheduledDate: '2026-09-27', actualDate: '2026-09-27', scheduledAt: null, actualAt: null, phase: 'HELD' }).expect(201);
    const pv = await publisher.post('/admin/imports', { format: 'json', manifest: { lotteryCode: 'DEMO_NILA', drawCode: 'NL-7D', ruleVersion: 2, publicationKind: 'INITIAL', correctionReason: null, completeness: 'COMPLETE', categories: [{ code: 'FIRST', state: 'COMPLETE', amountMinor: '1' }], source }, entries: [{ categoryCode: 'FIRST', series: 'AA', number: '0001234' }] }).expect(200);
    const draft = AdminRevisionSchema.parse((await publisher.post(`/admin/imports/${pv.body.id}/create-draft`).expect(200)).body);
    const ready = AdminRevisionSchema.parse((await publisher.post(`/admin/revisions/${draft.id}/review`, { confirmSelfReview: true, note: null }, { 'If-Match': '1' }).expect(200)).body);
    await publisher.post(`/admin/revisions/${draft.id}/publish`, { expectedEditVersion: ready.editVersion, expectedCurrentRevisionId: null, reactivate: false }, { 'Idempotency-Key': key() }).expect(200);

    const mixed = await stats(`lotteryId=${IDS.lotteryNila}&from=2026-09-01&to=2026-09-30`).expect(400);
    expect(ErrorResponseSchema.parse(mixed.body).error.fields?.[0]).toEqual({ path: 'ruleVersionId', code: 'REQUIRED_MIXED_DOMAINS' });
    const sixRes = await stats(`lotteryId=${IDS.lotteryNila}&from=2026-09-01&to=2026-09-30&ruleVersionId=${IDS.ruleNila1}`);
    if (sixRes.status !== 200) console.error('six failed', sixRes.status, JSON.stringify(sixRes.body));
    const six = StatisticsResponseSchema.parse(sixRes.body);
    expect(six.scope).toMatchObject({ observationCount: 3, numberLength: 6, incompatibleRuleVersionIds: [rule.body.id] });
    expect(six.scope.excludedDrawCounts.INCOMPATIBLE_RULE_VERSION).toBe(1);
    const seven = StatisticsResponseSchema.parse((await stats(`lotteryId=${IDS.lotteryNila}&from=2026-09-01&to=2026-09-30&ruleVersionId=${rule.body.id}`).expect(200)).body);
    expect(seven.scope).toMatchObject({ observationCount: 1, numberLength: 7 });
    expect(seven.positionDigitCounts).toHaveLength(7);
  });

  it('never logs searched numbers (INV-11) and applies the stats throttler independently', async () => {
    const marker = '424242';
    await search({ searchType: 'FULL', number: marker }).expect(200);
    const joined = logLines.join('\n');
    expect(joined).toContain('"path":"/api/v1/history/search"');
    expect(joined).not.toContain(marker);
    const { app: limited } = await createApp({ env: testEnv(), clock: new FixedClock(new Date('2026-09-24T12:00:00Z')), logger: pino({ level: 'silent' }), rateLimitPerMinute: 100_000, rateLimitCheckPerMinute: 100_000, rateLimitStatsPerMinute: 1 });
    try {
      await request(limited.getHttpServer()).get(`/api/v1/statistics?lotteryId=${IDS.lotteryNila}&from=2026-09-01&to=2026-09-24`).expect(200);
      await request(limited.getHttpServer()).get(`/api/v1/statistics?lotteryId=${IDS.lotteryNila}&from=2026-09-01&to=2026-09-24`).expect(429);
      await request(limited.getHttpServer()).get('/api/v1/lotteries').expect(200);
    } finally {
      await limited.close();
    }
  });
});

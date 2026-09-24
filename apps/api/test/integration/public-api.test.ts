import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { DrawDetailSchema, DrawListResponseSchema, ErrorResponseSchema, HealthReadyResponseSchema, LatestResponseSchema, LotteryListResponseSchema, ResultResponseSchema } from '@bhagyarekha/contracts';
import { IDS } from '../../src/fixtures/demo-fixtures.js';
import { bootApp, markMode, resetDatabase, seedDemoDatabase } from './helpers.js';

describe('public read API over seeded demo data', () => {
  let ds: DataSource;
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ds = await resetDatabase();
    await markMode(ds, 'demo');
    await seedDemoDatabase(ds);
    app = await bootApp({ today: '2026-09-24' });
  });
  afterAll(async () => {
    await app?.close();
    await ds?.destroy();
  });

  it('serves liveness and readiness with no-store and a request id', async () => {
    const live = await http().get('/api/v1/health/live').expect(200);
    expect(live.headers['cache-control']).toBe('no-store');
    expect(live.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const ready = await http().get('/api/v1/health/ready').expect(200);
    expect(HealthReadyResponseSchema.parse(ready.body)).toMatchObject({ status: 'ok', dataMode: 'demo', checks: { database: 'ok', migrations: 'ok', dataMode: 'ok' } });
  });

  it('lists lotteries with localized names and dataMode', async () => {
    const res = await http().get('/api/v1/lotteries').expect(200);
    const body = LotteryListResponseSchema.parse(res.body);
    expect(body.dataMode).toBe('demo');
    expect(body.items.map((l) => l.code).sort()).toEqual(['DEMO_BUMPER', 'DEMO_NILA', 'DEMO_THIRA']);
    expect(body.items.every((l) => l.name.ml.length > 0)).toBe(true);
  });

  it('separates the latest published draw from the pending draw (AC-02)', async () => {
    const res = await http().get('/api/v1/draws/latest').expect(200);
    const body = LatestResponseSchema.parse(res.body);
    expect(body.asOfDate).toBe('2026-09-24');
    expect(body.latestPublished).toMatchObject({ drawCode: 'NL-039', displayDate: '2026-09-24', publicationStatus: 'COMPLETE' });
    expect(body.latestPublished?.firstPrize?.entries).toEqual([{ series: 'AA', number: '001234' }]);
    expect(body.pendingDraw).toMatchObject({ drawCode: 'NL-040', displayDate: '2026-10-01', publicationStatus: 'NOT_PUBLISHED', phase: 'SCHEDULED', currentRevision: null, firstPrize: null });
    expect(body.pendingDraw?.id).not.toBe(body.latestPublished?.id);
  });

  it('never relabels a stale result as a newer draw when a lottery has a pending draw', async () => {
    const res = await http().get(`/api/v1/draws/latest?lotteryId=${IDS.lotteryThira}`).expect(200);
    const body = LatestResponseSchema.parse(res.body);
    // TH-039 (23 Sep) has no result; the latest published is TH-038 (22 Sep, partial) and stays labelled as such.
    expect(body.latestPublished).toMatchObject({ drawCode: 'TH-038', displayDate: '2026-09-22', publicationStatus: 'PARTIAL' });
    // TH-039 is in the past relative to "today", so it is not "pending" either; it appears as awaiting in the list.
    expect(body.pendingDraw).toBeNull();
    const list = DrawListResponseSchema.parse((await http().get(`/api/v1/draws?lotteryId=${IDS.lotteryThira}`).expect(200)).body);
    expect(list.items[0]).toMatchObject({ drawCode: 'TH-039', publicationStatus: 'NOT_PUBLISHED', phase: 'HELD', firstPrize: null });
  });

  it('treats a held draw dated today without a result as pending, and excludes cancelled draws', async () => {
    const yesterdayApp = await bootApp({ today: '2026-09-23' });
    try {
      const res = await request(yesterdayApp.getHttpServer()).get(`/api/v1/draws/latest?lotteryId=${IDS.lotteryThira}`).expect(200);
      expect(LatestResponseSchema.parse(res.body).pendingDraw).toMatchObject({ drawCode: 'TH-039', displayDate: '2026-09-23' });
      const bumper = await request(yesterdayApp.getHttpServer()).get(`/api/v1/draws/latest?lotteryId=${IDS.lotteryBumper}`).expect(200);
      expect(LatestResponseSchema.parse(bumper.body).pendingDraw).toBeNull(); // SB-2026-02 is cancelled
    } finally {
      await yesterdayApp.close();
    }
  });

  it('lists draws newest first with bounded pagination and date filters', async () => {
    const page1 = DrawListResponseSchema.parse((await http().get('/api/v1/draws?pageSize=5').expect(200)).body);
    expect(page1.total).toBe(11);
    expect(page1.items).toHaveLength(5);
    expect(page1.items.map((d) => d.displayDate)).toEqual([...page1.items.map((d) => d.displayDate)].sort().reverse());
    const sameDay = DrawListResponseSchema.parse((await http().get('/api/v1/draws?from=2026-09-17&to=2026-09-17').expect(200)).body);
    expect(sameDay.items.map((d) => d.drawCode).sort()).toEqual(['NL-038', 'SB-2026-01']);
    await http().get('/api/v1/draws?pageSize=101').expect(400);
    await http().get('/api/v1/draws?from=2026-09-30&to=2026-09-01').expect(400);
    await http().get('/api/v1/draws?from=2026-02-30').expect(400);
  });

  it('exposes statuses honestly: suspended withholds numbers, cancelled and awaiting have none', async () => {
    const list = DrawListResponseSchema.parse((await http().get('/api/v1/draws?pageSize=50').expect(200)).body);
    const byCode = new Map(list.items.map((d) => [d.drawCode, d]));
    expect(byCode.get('NL-037')).toMatchObject({ publicationStatus: 'SUSPENDED', currentRevision: null, firstPrize: null });
    expect(byCode.get('SB-2026-02')).toMatchObject({ publicationStatus: 'CANCELLED', phase: 'CANCELLED', firstPrize: null });
    expect(byCode.get('TH-038')).toMatchObject({ publicationStatus: 'PARTIAL' });
    expect(byCode.get('TH-038')?.firstPrize?.entries).toEqual([{ series: 'BB', number: '000077' }]);
    expect(byCode.get('TH-037')).toMatchObject({ scheduledDate: '2026-09-15', actualDate: '2026-09-16', displayDate: '2026-09-16', phase: 'POSTPONED' });
    expect(byCode.get('TH-037')?.currentRevision).toMatchObject({ revisionNo: 2, isCorrection: true, supersededRevisionCount: 1 });
    expect(byCode.get('TH-037')?.firstPrize?.entries).toEqual([{ series: 'BA', number: '123465' }]);
  });

  it('returns draw detail with checking capability and sources; unknown ids are 404', async () => {
    const detail = DrawDetailSchema.parse((await http().get(`/api/v1/draws/${IDS.drawBumper01}`).expect(200)).body);
    expect(detail.checking).toMatchObject({ capability: 'UNSUPPORTED', reasonCode: 'RULE_REVOKED' });
    expect(detail.sources[0]).toMatchObject({ kind: 'SYNTHETIC_FIXTURE', url: null });
    const suspended = DrawDetailSchema.parse((await http().get(`/api/v1/draws/${IDS.drawNila037}`).expect(200)).body);
    expect(suspended.checking.reasonCode).toBe('RESULT_SUSPENDED');
    expect(suspended.sources).toEqual([]);
    const missing = await http().get('/api/v1/draws/00000000-0000-4000-8000-000000000000').expect(404);
    expect(ErrorResponseSchema.parse(missing.body).error.code).toBe('DRAW_NOT_FOUND');
    const invalid = await http().get('/api/v1/draws/not-a-uuid').expect(400);
    expect(ErrorResponseSchema.parse(invalid.body).error).toMatchObject({ code: 'INVALID_INPUT', fields: [{ path: 'drawId' }] });
  });

  it('serves the full result with every category, entries and leading zeros (AC-05)', async () => {
    const res = await http().get(`/api/v1/draws/${IDS.drawNila039}/result`).expect(200);
    const body = ResultResponseSchema.parse(res.body);
    expect(body.categories.map((c) => [c.code, c.state, c.amountMinor, c.entryCount])).toEqual([
      ['FIRST', 'COMPLETE', '10000000', 1],
      ['CONSOLATION', 'COMPLETE', '500000', 1],
      ['LAST4', 'COMPLETE', '100000', 5],
    ]);
    expect(body.entries.find((e) => e.categoryCode === 'FIRST')?.items).toEqual([{ series: 'AA', number: '001234' }]);
    expect(body.entries.find((e) => e.categoryCode === 'LAST4')?.items.map((i) => i.number)).toContain('0042');
    expect(body.rule).toMatchObject({ numberLength: 6, allowedSeries: ['AA', 'AB', 'AC'], state: 'APPROVED' });
    expect(body.revision.revisionNo).toBe(1);
    expect(JSON.stringify(res.body)).not.toMatch(/"number":\d/); // numbers are never serialised as JSON numbers
  });

  it('paginates one category and rejects unknown categories', async () => {
    const page = ResultResponseSchema.parse((await http().get(`/api/v1/draws/${IDS.drawThira036}/result?categoryCode=LAST3&pageSize=4&page=2`).expect(200)).body);
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]).toMatchObject({ categoryCode: 'LAST3', page: 2, pageSize: 4, total: 10 });
    expect(page.entries[0]?.items).toHaveLength(4);
    expect(page.entries[0]?.items.every((i) => i.number.length === 3)).toBe(true);
    await http().get(`/api/v1/draws/${IDS.drawThira036}/result?categoryCode=NOPE`).expect(404);
  });

  it('reports partial results as PARTIAL with MISSING categories, not as complete', async () => {
    const body = ResultResponseSchema.parse((await http().get(`/api/v1/draws/${IDS.drawThira038}/result`).expect(200)).body);
    expect(body.revision.completeness).toBe('PARTIAL');
    expect(body.categories.map((c) => [c.code, c.state])).toEqual([['FIRST', 'COMPLETE'], ['SECOND', 'MISSING'], ['LAST3', 'PARTIAL']]);
    expect(body.entries.find((e) => e.categoryCode === 'SECOND')?.total).toBe(0);
  });

  it('answers 404 RESULT_NOT_PUBLISHED, 409 RESULT_SUSPENDED and 409 RESULT_CHANGED', async () => {
    expect(ErrorResponseSchema.parse((await http().get(`/api/v1/draws/${IDS.drawNila040}/result`).expect(404)).body).error.code).toBe('RESULT_NOT_PUBLISHED');
    expect(ErrorResponseSchema.parse((await http().get(`/api/v1/draws/${IDS.drawNila037}/result`).expect(409)).body).error.code).toBe('RESULT_SUSPENDED');
    const stale = await http().get(`/api/v1/draws/${IDS.drawThira037}/result?revisionId=${IDS.revThira037r1}`).expect(409);
    expect(ErrorResponseSchema.parse(stale.body).error.code).toBe('RESULT_CHANGED');
    // The superseded payload is never served as current.
    const current = ResultResponseSchema.parse((await http().get(`/api/v1/draws/${IDS.drawThira037}/result?revisionId=${IDS.revThira037r2}`).expect(200)).body);
    expect(current.entries.find((e) => e.categoryCode === 'FIRST')?.items).toEqual([{ series: 'BA', number: '123465' }]);
    expect(current.revision.correctionReason).toMatch(/transposed/);
  });

  it('uses the shared error envelope for unknown routes and strict queries', async () => {
    const unknown = await http().get('/api/v1/definitely-not-here').expect(404);
    expect(ErrorResponseSchema.parse(unknown.body).error.code).toBe('NOT_FOUND');
    const strict = await http().get('/api/v1/lotteries?evil=1').expect(400);
    expect(ErrorResponseSchema.parse(strict.body)).toMatchObject({ error: { code: 'INVALID_INPUT' } });
    expect(strict.headers['cache-control']).toBe('no-store');
  });

  it('sets security headers and restricts CORS to the configured origin', async () => {
    const res = await http().get('/api/v1/lotteries').set('Origin', 'http://localhost:3000').expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    const other = await http().get('/api/v1/lotteries').set('Origin', 'https://evil.example').expect(200);
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});

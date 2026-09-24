import type { INestApplication } from '@nestjs/common';
import { Writable } from 'node:stream';
import { pino } from 'pino';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DrawDetailSchema, ErrorResponseSchema, TicketCheckResponseSchema, type TicketCheckResponse } from '@bhagyarekha/contracts';
import { createApp } from '../../src/app.js';
import { FixedClock } from '../../src/common/clock.js';
import { IDS } from '../../src/fixtures/demo-fixtures.js';
import { markMode, resetDatabase, seedDemoDatabase, testEnv } from './helpers.js';

const NILA = { lotteryId: IDS.lotteryNila, drawId: IDS.drawNila039 };
const THIRA_PARTIAL = { lotteryId: IDS.lotteryThira, drawId: IDS.drawThira038 };

describe('POST /api/v1/ticket-check (real PostgreSQL, seeded demo)', () => {
  let ds: DataSource;
  let app: INestApplication;
  const logLines: string[] = [];
  const post = (body: unknown) => request(app.getHttpServer()).post('/api/v1/ticket-check').set('content-type', 'application/json').send(body as object);
  const okBody = async (body: unknown): Promise<TicketCheckResponse> => TicketCheckResponseSchema.parse((await post(body).expect(200)).body);

  beforeAll(async () => {
    ds = await resetDatabase();
    await markMode(ds, 'demo');
    await seedDemoDatabase(ds);
    // Capture every log line the app emits so the privacy assertion can inspect them.
    const sink = new Writable({ write(chunk, _enc, cb) { logLines.push(String(chunk)); cb(); } });
    const logger = pino({ level: 'trace' }, sink);
    ({ app } = await createApp({ env: testEnv({ LOG_LEVEL: 'trace' }), clock: new FixedClock(new Date('2026-09-24T12:00:00Z')), logger, rateLimitPerMinute: 100_000, rateLimitCheckPerMinute: 100_000 }));
  });
  afterAll(async () => {
    await app?.close();
    await ds?.destroy();
  });

  it('AA/001234 → MATCH FIRST with the recorded amount, single award, revision context and synthetic source', async () => {
    const body = await okBody({ ...NILA, series: 'AA', number: '001234' });
    expect(body).toMatchObject({
      outcome: 'MATCH', dataMode: 'demo', resultRevisionId: IDS.revNila039r1, ruleVersionId: IDS.ruleNila1, completeness: 'COMPLETE',
      checkedCategoryCodes: ['FIRST', 'CONSOLATION', 'LAST4'], unresolvedCategoryCodes: [],
      matches: [{ categoryCode: 'FIRST', awardConfirmed: true, amountMinor: '10000000', currency: 'INR' }],
      basis: 'PUBLISHED_SNAPSHOT_ONLY', messageCode: 'CHECK_MATCH_INFORMATIONAL', checkedAt: '2026-09-24T12:00:00.000Z',
    });
    expect(body.draw).toMatchObject({ drawCode: 'NL-039', displayDate: '2026-09-24' });
    expect(body.sources[0]).toMatchObject({ kind: 'SYNTHETIC_FIXTURE', url: null });
    expect(body.categories.map((c) => [c.code, c.state])).toEqual([['FIRST', 'COMPLETE'], ['CONSOLATION', 'COMPLETE'], ['LAST4', 'COMPLETE']]);
  });

  it('normalises only outer whitespace and series case (T02)', async () => {
    const body = await okBody({ ...NILA, series: ' aa ', number: ' 001234 ' });
    expect(body.outcome).toBe('MATCH');
  });

  it('AB/001234 → CONSOLATION (EXCEPT_ENTRY); AB/991234 → LAST4; AA/990042 → LAST4 via leading-zero suffix (T03)', async () => {
    expect((await okBody({ ...NILA, series: 'AB', number: '001234' })).matches[0]).toMatchObject({ categoryCode: 'CONSOLATION', amountMinor: '500000' });
    expect((await okBody({ ...NILA, series: 'AB', number: '991234' })).matches[0]).toMatchObject({ categoryCode: 'LAST4', amountMinor: '100000' });
    expect((await okBody({ ...NILA, series: 'AA', number: '990042' })).matches[0]).toMatchObject({ categoryCode: 'LAST4' });
  });

  it('AB/994321 → NO_MATCH only against the complete result', async () => {
    const body = await okBody({ ...NILA, series: 'AB', number: '994321' });
    expect(body.outcome).toBe('NO_MATCH');
    expect(body.matches).toEqual([]);
    expect(body.messageCode).toBe('CHECK_NO_MATCH_COMPLETE');
  });

  it('rejects invalid series and wrong lengths with field codes and never echoes the value (T04/T20)', async () => {
    const zz = ErrorResponseSchema.parse((await post({ ...NILA, series: 'ZZ', number: '001234' }).expect(400)).body);
    expect(zz.error).toMatchObject({ code: 'INVALID_SERIES', fields: [{ path: 'series', code: 'SERIES_NOT_ALLOWED' }] });
    const short = ErrorResponseSchema.parse((await post({ ...NILA, series: 'AA', number: '1234' }).expect(400)).body);
    expect(short.error).toMatchObject({ code: 'INVALID_NUMBER_LENGTH', fields: [{ path: 'number', code: 'WRONG_LENGTH' }] });
    const junk = ErrorResponseSchema.parse((await post({ ...NILA, series: 'AA', number: '00-1234' }).expect(400)).body);
    expect(junk.error).toMatchObject({ code: 'INVALID_INPUT', fields: [{ path: 'number', code: 'DIGITS_REQUIRED' }] });
    const empty = ErrorResponseSchema.parse((await post({ ...NILA, series: 'AA', number: '' }).expect(400)).body);
    expect(empty.error.code).toBe('INVALID_INPUT');
    for (const res of [zz, short, junk]) expect(JSON.stringify(res)).not.toMatch(/001234|1234|ZZ/);
  });

  it('rejects a lottery/draw mismatch instead of switching draws', async () => {
    const res = ErrorResponseSchema.parse((await post({ lotteryId: IDS.lotteryThira, drawId: IDS.drawNila039, series: 'AA', number: '001234' }).expect(400)).body);
    expect(res.error.code).toBe('DRAW_MISMATCH');
    expect(ErrorResponseSchema.parse((await post({ ...NILA, drawId: '00000000-0000-4000-8000-000000000000', series: 'AA', number: '001234' }).expect(404)).body).error.code).toBe('DRAW_NOT_FOUND');
  });

  it('partial result: raw match → PARTIAL_MATCH provisional; no raw match → RESULT_INCOMPLETE, never NO_MATCH (T06/T07)', async () => {
    const provisional = await okBody({ ...THIRA_PARTIAL, series: 'BB', number: '000077' });
    expect(provisional).toMatchObject({ outcome: 'PARTIAL_MATCH', completeness: 'PARTIAL', matches: [{ categoryCode: 'FIRST', awardConfirmed: false, amountMinor: null }], unresolvedCategoryCodes: ['SECOND', 'LAST3'], checkedCategoryCodes: ['FIRST'] });
    const incomplete = await okBody({ ...THIRA_PARTIAL, series: 'BB', number: '999999' });
    expect(incomplete).toMatchObject({ outcome: 'RESULT_INCOMPLETE', matches: [], unresolvedCategoryCodes: ['SECOND', 'LAST3'] });
    // A suffix match inside the PARTIAL LAST3 list is still only provisional.
    const suffix = await okBody({ ...THIRA_PARTIAL, series: 'BA', number: '123077' });
    expect(suffix).toMatchObject({ outcome: 'PARTIAL_MATCH', matches: [{ categoryCode: 'LAST3', awardConfirmed: false }] });
  });

  it('non-verdict states: not published, suspended, cancelled, revoked rules (T08/T09)', async () => {
    expect((await okBody({ lotteryId: IDS.lotteryNila, drawId: IDS.drawNila040, series: 'AA', number: '001234' })).outcome).toBe('RESULT_NOT_PUBLISHED');
    expect((await okBody({ lotteryId: IDS.lotteryNila, drawId: IDS.drawNila037, series: 'AA', number: '555000' })).outcome).toBe('RESULT_SUSPENDED');
    expect((await okBody({ lotteryId: IDS.lotteryBumper, drawId: IDS.drawBumper02, series: 'SB', number: '0123456' })).outcome).toBe('DRAW_CANCELLED');
    const revoked = await okBody({ lotteryId: IDS.lotteryBumper, drawId: IDS.drawBumper01, series: 'SB', number: '0123456' });
    expect(revoked).toMatchObject({ outcome: 'RULES_UNSUPPORTED', matches: [], resultRevisionId: IDS.revBumper01r1 });
    // Non-verdict states are answered before ticket-domain validation, so an odd ticket does not become a 400 here.
    expect((await okBody({ lotteryId: IDS.lotteryNila, drawId: IDS.drawNila040, series: 'ZZ', number: '1' })).outcome).toBe('RESULT_NOT_PUBLISHED');
    for (const body of [revoked]) expect(body.checkedCategoryCodes).toEqual([]);
  });

  it('stale expectedRevisionId → 409 RESULT_CHANGED; current id → verdict against the corrected numbers (T11)', async () => {
    const stale = await post({ lotteryId: IDS.lotteryThira, drawId: IDS.drawThira037, series: 'BA', number: '123456', expectedRevisionId: IDS.revThira037r1 }).expect(409);
    expect(ErrorResponseSchema.parse(stale.body).error.code).toBe('RESULT_CHANGED');
    // The superseded first prize (123456) is no longer a match; the corrected one (123465) is.
    expect((await okBody({ lotteryId: IDS.lotteryThira, drawId: IDS.drawThira037, series: 'BA', number: '123456', expectedRevisionId: IDS.revThira037r2 })).outcome).toBe('NO_MATCH');
    expect((await okBody({ lotteryId: IDS.lotteryThira, drawId: IDS.drawThira037, series: 'BA', number: '123465' })).matches[0]?.categoryCode).toBe('FIRST');
  });

  it('rejects malformed envelopes: GET, non-JSON, unknown keys, numeric number', async () => {
    await request(app.getHttpServer()).get('/api/v1/ticket-check').expect(404);
    expect(ErrorResponseSchema.parse((await post({ ...NILA, series: 'AA', number: 1234 }).expect(400)).body).error.code).toBe('INVALID_INPUT');
    expect(ErrorResponseSchema.parse((await post({ ...NILA, series: 'AA', number: '001234', extra: true }).expect(400)).body).error.code).toBe('INVALID_INPUT');
    await request(app.getHttpServer()).post('/api/v1/ticket-check').set('content-type', 'application/json').send('{not json').expect(400);
  });

  it('draw detail exposes SUPPORTED capability and a ticketFormat hint', async () => {
    const detail = DrawDetailSchema.parse((await request(app.getHttpServer()).get(`/api/v1/draws/${IDS.drawNila039}`).expect(200)).body);
    expect(detail.checking).toEqual({ capability: 'SUPPORTED', ruleVersionId: IDS.ruleNila1, reasonCode: null });
    expect(detail.ticketFormat).toEqual({ ruleVersionId: IDS.ruleNila1, numberLength: 6, allowedSeries: ['AA', 'AB', 'AC'] });
    const pending = DrawDetailSchema.parse((await request(app.getHttpServer()).get(`/api/v1/draws/${IDS.drawNila040}`).expect(200)).body);
    expect(pending.checking.reasonCode).toBe('NO_PUBLISHED_RESULT');
    expect(pending.ticketFormat?.numberLength).toBe(6);
  });

  it('applies the stricter check throttler independently of public reads (429 RATE_LIMITED)', async () => {
    const { app: limited } = await createApp({ env: testEnv(), clock: new FixedClock(new Date('2026-09-24T12:00:00Z')), logger: pino({ level: 'silent' }), rateLimitPerMinute: 100_000, rateLimitCheckPerMinute: 2 });
    try {
      const send = () => request(limited.getHttpServer()).post('/api/v1/ticket-check').set('content-type', 'application/json').send({ ...NILA, series: 'AA', number: '001234' });
      await send().expect(200);
      await send().expect(200);
      const third = await send().expect(429);
      expect(ErrorResponseSchema.parse(third.body).error.code).toBe('RATE_LIMITED');
      // Public reads are governed by the default throttler and still work.
      await request(limited.getHttpServer()).get('/api/v1/lotteries').expect(200);
    } finally {
      await limited.close();
    }
  });

  it('never writes entered tickets to logs or the database (T27 / INV-11)', async () => {
    const marker = '987654';
    await okBody({ ...NILA, series: 'AC', number: marker });
    await post({ ...NILA, series: 'ZZ', number: marker }).expect(400);
    const joined = logLines.join('\n');
    expect(joined).toContain('"path":"/api/v1/ticket-check"');
    expect(joined).not.toContain(marker);
    expect(joined).not.toMatch(/"series"|"number"|"body"/);
    const tables = await ds.query<{ table_name: string }[]>(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    for (const { table_name } of tables) {
      if (table_name === 'typeorm_migrations') continue;
      const rows = await ds.query<{ hit: string }[]>(`SELECT COUNT(*)::text AS hit FROM ${table_name} t WHERE t::text LIKE '%${marker}%'`);
      expect(Number(rows[0]?.hit), `table ${table_name} must not contain the entered ticket`).toBe(0);
    }
  });
});

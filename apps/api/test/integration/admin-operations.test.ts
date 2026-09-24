import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AdminRevisionSchema, DrawDetailSchema, ImportPreviewSchema, PublishResultSchema, ResultResponseSchema, TicketCheckResponseSchema, type ImportManifest } from '@bhagyarekha/contracts';
import { AuditService } from '../../src/modules/audit/audit.service.js';
import { IDS } from '../../src/fixtures/demo-fixtures.js';
import { createAdmin, key, loginAs, type AdminClient } from './admin-helpers.js';
import { bootApp, markMode, resetDatabase, seedDemoDatabase } from './helpers.js';

const manifest = (over: Partial<ImportManifest> = {}): ImportManifest => ({
  lotteryCode: 'DEMO_NILA', drawCode: 'NL-041', ruleVersion: 1, publicationKind: 'INITIAL', correctionReason: null, completeness: 'COMPLETE',
  categories: [{ code: 'FIRST', state: 'COMPLETE', amountMinor: '10000000' }, { code: 'CONSOLATION', state: 'COMPLETE', amountMinor: '500000' }, { code: 'LAST4', state: 'COMPLETE', amountMinor: '100000' }],
  source: { kind: 'MANUAL_TRANSCRIPTION', title: 'Test transcription of a synthetic result', url: null, documentHash: null, acquiredAt: null, note: null },
  ...over,
});
const goodEntries = [
  { categoryCode: 'FIRST', series: 'AC', number: '000321' },
  { categoryCode: 'CONSOLATION', series: 'AC', number: '000321' },
  { categoryCode: 'LAST4', series: '', number: '0321' },
  { categoryCode: 'LAST4', series: '', number: '7777' },
];

describe('admin operations: catalog, imports, review, publish, corrections, suspension (real PostgreSQL)', () => {
  let ds: DataSource;
  let app: INestApplication;
  let publisher: AdminClient;
  let editor: AdminClient;
  let drawId: string;

  beforeAll(async () => {
    ds = await resetDatabase();
    await markMode(ds, 'demo');
    await seedDemoDatabase(ds);
    await createAdmin(ds, 'publisher@example.test', 'PUBLISHER');
    await createAdmin(ds, 'editor@example.test', 'EDITOR');
    app = await bootApp({ env: { ALLOW_SELF_REVIEW: true } });
    publisher = await loginAs(app, 'publisher@example.test');
    editor = await loginAs(app, 'editor@example.test');
  });
  afterAll(async () => {
    await app?.close();
    await ds?.destroy();
  });

  it('creates a draw with IST-consistent dates and rejects duplicates and mismatched instants', async () => {
    const created = await editor.post('/admin/draws', { lotteryId: IDS.lotteryNila, drawCode: 'NL-041', scheduledDate: '2026-10-08', actualDate: null, scheduledAt: '2026-10-08T09:30:00.000Z', actualAt: null, phase: 'SCHEDULED' }).expect(201);
    drawId = created.body.id;
    expect(created.body).toMatchObject({ drawCode: 'NL-041', lotteryCode: 'DEMO_NILA', currentRevisionId: null, editVersion: 1 });
    expect((await editor.post('/admin/draws', { lotteryId: IDS.lotteryNila, drawCode: 'NL-041', scheduledDate: '2026-10-08', actualDate: null, scheduledAt: null, actualAt: null }).expect(409)).body.error.code).toBe('ALREADY_EXISTS');
    // 20:00Z is already 9 Oct in IST.
    const bad = await editor.post('/admin/draws', { lotteryId: IDS.lotteryNila, drawCode: 'NL-BAD', scheduledDate: '2026-10-08', actualDate: null, scheduledAt: '2026-10-08T20:00:00.000Z', actualAt: null }).expect(400);
    expect(bad.body.error.fields[0]).toMatchObject({ path: 'scheduledAt', code: 'IST_DATE_MISMATCH' });
  });

  it('rejects an import with duplicates, wrong lengths and a spreadsheet-mangled number, listing every row error (T15)', async () => {
    const csv = ['categoryCode,series,number', 'FIRST,AC,000321', 'CONSOLATION,AC,000321', 'LAST4,,0321', 'LAST4,,0321', 'LAST4,,321', 'FIRST,ZZ,12345'].join('\n');
    const res = await editor.post('/admin/imports', { format: 'csv', manifest: manifest(), csv }).expect(200);
    const preview = ImportPreviewSchema.parse(res.body);
    expect(preview.status).toBe('VALIDATION_FAILED');
    const codes = preview.errors.items.map((e) => `${e.row}:${e.code}`);
    expect(codes).toEqual(expect.arrayContaining(['5:DUPLICATE_ENTRY', '6:WRONG_LENGTH', '7:WRONG_LENGTH', '7:SERIES_NOT_ALLOWED']));
    expect(preview.summary.totalRows).toBe(6);
    // A failed preview cannot become a draft.
    expect((await editor.post(`/admin/imports/${preview.id}/create-draft`).expect(409)).body.error.code).toBe('REVISION_CONFLICT');
    // JSON numbers (which lose leading zeros) are rejected as strings-required.
    const json = await editor.post('/admin/imports', { format: 'json', manifest: manifest(), entries: [{ categoryCode: 'FIRST', series: 'AC', number: 321 }] }).expect(200);
    expect(json.body.errors.items[0]).toMatchObject({ row: 1, code: 'STRING_REQUIRED' });
  });

  it('rejects oversized imports without truncation (413) and manifest/rule inconsistencies', async () => {
    const huge = 'categoryCode,series,number\n' + 'LAST4,,1234\n'.repeat(200_000);
    await editor.post('/admin/imports', { format: 'csv', manifest: manifest(), csv: huge }).expect(413);
    const tooMany = { format: 'json', manifest: manifest(), entries: Array.from({ length: 20_001 }, (_, i) => ({ categoryCode: 'LAST4', series: '', number: String(i % 10000).padStart(4, '0') })) };
    await editor.post('/admin/imports', tooMany).expect(400); // Zod max(20000) on the envelope
    const partialAsComplete = await editor.post('/admin/imports', { format: 'json', manifest: manifest({ categories: [{ code: 'FIRST', state: 'COMPLETE', amountMinor: '1' }, { code: 'CONSOLATION', state: 'MISSING', amountMinor: null }, { code: 'LAST4', state: 'COMPLETE', amountMinor: '1' }] }), entries: goodEntries.filter((e) => e.categoryCode !== 'CONSOLATION') }).expect(200);
    expect(partialAsComplete.body.errors.items.map((e: { code: string }) => e.code)).toContain('INCOMPLETE_CATEGORY');
    const unknownDraw = await editor.post('/admin/imports', { format: 'json', manifest: manifest({ drawCode: 'NL-999' }), entries: goodEntries }).expect(200);
    expect(unknownDraw.body.errors.items[0].code).toBe('UNKNOWN_DRAW');
  });

  let previewId: string;
  let revisionId: string;

  it('previews a valid import and creates exactly one DRAFT even when called twice (AC-06)', async () => {
    const res = await editor.post('/admin/imports', { format: 'json', manifest: manifest(), entries: goodEntries }).expect(200);
    const preview = ImportPreviewSchema.parse(res.body);
    expect(preview.status).toBe('PREVIEW_READY');
    expect(preview.summary).toMatchObject({ totalRows: 4, validRows: 4, errorCount: 0, rowsPerCategory: { FIRST: 1, CONSOLATION: 1, LAST4: 2 } });
    previewId = preview.id;
    const first = AdminRevisionSchema.parse((await editor.post(`/admin/imports/${previewId}/create-draft`).expect(200)).body);
    const second = AdminRevisionSchema.parse((await editor.post(`/admin/imports/${previewId}/create-draft`).expect(200)).body);
    expect(second.id).toBe(first.id);
    revisionId = first.id;
    expect(first).toMatchObject({ workflowState: 'DRAFT', publicationKind: 'INITIAL', completeness: 'COMPLETE', revisionNo: 1, basedOnRevisionId: null, drawId, isCurrent: false });
    expect(first.categories.map((c) => [c.code, c.state, c.entryCount])).toEqual([['FIRST', 'COMPLETE', 1], ['CONSOLATION', 'COMPLETE', 1], ['LAST4', 'COMPLETE', 2]]);
    const entries = await editor.get(`/admin/revisions/${revisionId}/entries?categoryCode=FIRST`).expect(200);
    expect(entries.body.items).toEqual([{ series: 'AC', number: '000321', sourceRow: 1 }]);
    // Nothing is public yet.
    expect((await request(app.getHttpServer()).get(`/api/v1/draws/${drawId}`).expect(200)).body.publicationStatus).toBe('NOT_PUBLISHED');
  });

  it('cannot publish a DRAFT, and review enforces the self-review policy and stale edit versions (T16)', async () => {
    expect((await publisher.post(`/admin/revisions/${revisionId}/publish`, { expectedEditVersion: 1, expectedCurrentRevisionId: null, reactivate: false }, { 'Idempotency-Key': key() }).expect(409)).body.error.code).toBe('REVISION_CONFLICT');
    // Stale If-Match.
    await publisher.post(`/admin/revisions/${revisionId}/review`, { confirmSelfReview: false, note: null }, { 'If-Match': '99' }).expect(409);
    // The editor created it; the publisher is a different person, so no self-review confirmation is needed.
    const reviewed = AdminRevisionSchema.parse((await publisher.post(`/admin/revisions/${revisionId}/review`, { confirmSelfReview: false, note: 'Checked against the synthetic source' }, { 'If-Match': '1' }).expect(200)).body);
    expect(reviewed.workflowState).toBe('READY');
    expect(reviewed.reviewedHash).toBe(reviewed.contentHash);
    expect(reviewed.evidence[0]?.reviewedAt).not.toBeNull();
    // Editing READY content is refused until reopened; reopening clears the review.
    expect((await editor.patch(`/admin/revisions/${revisionId}`, { completeness: 'PARTIAL' }, reviewed.editVersion).expect(409)).body.error.message).toMatch(/reopen/);
    const reopened = AdminRevisionSchema.parse((await editor.post(`/admin/revisions/${revisionId}/reopen`, {}, { 'If-Match': String(reviewed.editVersion) }).expect(200)).body);
    expect(reopened).toMatchObject({ workflowState: 'DRAFT', reviewedHash: null });
    // The old reviewed hash cannot be used to publish.
    await publisher.post(`/admin/revisions/${revisionId}/publish`, { expectedEditVersion: reopened.editVersion, expectedCurrentRevisionId: null, reactivate: false }, { 'Idempotency-Key': key() }).expect(409);
    // Editor edits an entry, which recomputes the hash; then the publisher reviews again.
    const edited = AdminRevisionSchema.parse((await editor.patch(`/admin/revisions/${revisionId}`, { replaceEntries: [{ categoryCode: 'LAST4', entries: [{ series: '', number: '0321' }, { series: '', number: '7777' }, { series: '', number: '0001' }] }] }, reopened.editVersion).expect(200)).body);
    expect(edited.contentHash).not.toBe(reopened.contentHash);
    expect(edited.categories.find((c) => c.code === 'LAST4')?.entryCount).toBe(3);
    const rereviewed = AdminRevisionSchema.parse((await publisher.post(`/admin/revisions/${revisionId}/review`, { confirmSelfReview: false, note: null }, { 'If-Match': String(edited.editVersion) }).expect(200)).body);
    expect(rereviewed.workflowState).toBe('READY');
  });

  let publishResult: { publicationId: string; datasetVersion: string };
  const publishKey = key();

  it('publishes atomically, replays the same idempotency key, and rejects a different request with that key (T14)', async () => {
    const ready = AdminRevisionSchema.parse((await publisher.get(`/admin/revisions/${revisionId}`).expect(200)).body);
    const body = { expectedEditVersion: ready.editVersion, expectedCurrentRevisionId: null, reactivate: false };
    // Wrong expected current pointer → conflict, nothing published.
    await publisher.post(`/admin/revisions/${revisionId}/publish`, { ...body, expectedCurrentRevisionId: IDS.revNila039r1 }, { 'Idempotency-Key': key() }).expect(409);
    const res = await publisher.post(`/admin/revisions/${revisionId}/publish`, body, { 'Idempotency-Key': publishKey }).expect(200);
    const result = PublishResultSchema.parse(res.body);
    expect(result).toMatchObject({ revisionId, drawId, supersededRevisionId: null, replayed: false, isStillCurrent: true });
    publishResult = result;
    const replay = PublishResultSchema.parse((await publisher.post(`/admin/revisions/${revisionId}/publish`, body, { 'Idempotency-Key': publishKey }).expect(200)).body);
    expect(replay).toMatchObject({ publicationId: result.publicationId, replayed: true, isStillCurrent: true });
    expect((await publisher.post(`/admin/revisions/${revisionId}/publish`, { ...body, reactivate: true }, { 'Idempotency-Key': publishKey }).expect(409)).body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    // Public side now shows it, with the reviewed source and leading zeros intact.
    const pub = DrawDetailSchema.parse((await request(app.getHttpServer()).get(`/api/v1/draws/${drawId}`).expect(200)).body);
    expect(pub).toMatchObject({ publicationStatus: 'COMPLETE', phase: 'HELD', actualDate: null, scheduledDate: '2026-10-08' });
    expect(pub.firstPrize?.entries).toEqual([{ series: 'AC', number: '000321' }]);
    expect(pub.sources[0]).toMatchObject({ kind: 'MANUAL_TRANSCRIPTION', title: 'Test transcription of a synthetic result' });
    expect(pub.sources[0]?.reviewedAt).not.toBeNull();
    const check = TicketCheckResponseSchema.parse((await request(app.getHttpServer()).post('/api/v1/ticket-check').set('content-type', 'application/json').send({ lotteryId: IDS.lotteryNila, drawId, series: 'AB', number: '990001' }).expect(200)).body);
    expect(check.matches[0]?.categoryCode).toBe('LAST4');
    const audit = await publisher.get(`/admin/revisions/${revisionId}/audit`).expect(200);
    expect(audit.body.items.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(['REVISION_PUBLISHED', 'REVISION_REVIEWED', 'REVISION_REOPENED', 'REVISION_EDITED', 'REVISION_DRAFT_CREATED']));
    expect(audit.body.items.find((e: { action: string }) => e.action === 'REVISION_PUBLISHED').actorEmail).toBe('publisher@example.test');
    // Published payload is immutable even through the admin API.
    await editor.patch(`/admin/revisions/${revisionId}`, { completeness: 'PARTIAL' }, ready.editVersion + 1).expect(409);
  });

  it('a publish whose audit insert fails rolls back pointer, state and dataset version (T13)', async () => {
    // Prepare a second draw + READY revision, then boot an app whose AuditService throws.
    const d2 = await editor.post('/admin/draws', { lotteryId: IDS.lotteryNila, drawCode: 'NL-042', scheduledDate: '2026-10-15', actualDate: null, scheduledAt: null, actualAt: null, phase: 'SCHEDULED' }).expect(201);
    const pv = await editor.post('/admin/imports', { format: 'json', manifest: manifest({ drawCode: 'NL-042' }), entries: goodEntries }).expect(200);
    const draft = AdminRevisionSchema.parse((await editor.post(`/admin/imports/${pv.body.id}/create-draft`).expect(200)).body);
    const ready = AdminRevisionSchema.parse((await publisher.post(`/admin/revisions/${draft.id}/review`, { confirmSelfReview: false, note: null }, { 'If-Match': '1' }).expect(200)).body);
    const before = await ds.query<{ dataset_version: string }[]>(`SELECT dataset_version FROM lottery WHERE id = $1`, [IDS.lotteryNila]);

    const failing = await bootApp({ env: { ALLOW_SELF_REVIEW: true }, overrides: (builder) => builder.overrideProvider(AuditService).useValue({ record: async () => { throw new Error('audit sink unavailable'); }, list: async () => [] }) });
    try {
      const pubFail = await loginAs(failing, 'publisher@example.test');
      await pubFail.post(`/admin/revisions/${draft.id}/publish`, { expectedEditVersion: ready.editVersion, expectedCurrentRevisionId: null, reactivate: false }, { 'Idempotency-Key': key() }).expect(500);
    } finally {
      await failing.close();
    }
    const after = await ds.query<{ dataset_version: string }[]>(`SELECT dataset_version FROM lottery WHERE id = $1`, [IDS.lotteryNila]);
    expect(after[0]?.dataset_version).toBe(before[0]?.dataset_version);
    const drawRow = await ds.query<{ current_revision_id: string | null }[]>(`SELECT current_revision_id FROM draw WHERE id = $1`, [d2.body.id]);
    expect(drawRow[0]?.current_revision_id).toBeNull();
    const revRow = await ds.query<{ workflow_state: string }[]>(`SELECT workflow_state FROM result_revision WHERE id = $1`, [draft.id]);
    expect(revRow[0]?.workflow_state).toBe('READY');
    // The healthy app can still publish it afterwards.
    await publisher.post(`/admin/revisions/${draft.id}/publish`, { expectedEditVersion: ready.editVersion, expectedCurrentRevisionId: null, reactivate: false }, { 'Idempotency-Key': key() }).expect(200);
  });

  it('suspends and resumes a draw: public reads withhold the payload and checks return RESULT_SUSPENDED', async () => {
    const draw = await publisher.get(`/admin/draws/${drawId}`).expect(200);
    const suspended = await publisher.post(`/admin/draws/${drawId}/suspend`, { reason: 'Source discrepancy under review', expectedEditVersion: draw.body.editVersion }, { 'Idempotency-Key': key() }).expect(200);
    expect(suspended.body).toMatchObject({ visibility: 'SUSPENDED', suspensionReason: 'Source discrepancy under review' });
    const pub = DrawDetailSchema.parse((await request(app.getHttpServer()).get(`/api/v1/draws/${drawId}`).expect(200)).body);
    expect(pub).toMatchObject({ publicationStatus: 'SUSPENDED', currentRevision: null, firstPrize: null });
    await request(app.getHttpServer()).get(`/api/v1/draws/${drawId}/result`).expect(409);
    const check = TicketCheckResponseSchema.parse((await request(app.getHttpServer()).post('/api/v1/ticket-check').set('content-type', 'application/json').send({ lotteryId: IDS.lotteryNila, drawId, series: 'AC', number: '000321' }).expect(200)).body);
    expect(check.outcome).toBe('RESULT_SUSPENDED');
    // Stale edit version on resume → conflict; then resume properly.
    await publisher.post(`/admin/draws/${drawId}/resume`, { reason: 'Resolved', expectedEditVersion: draw.body.editVersion }, { 'Idempotency-Key': key() }).expect(409);
    const resumed = await publisher.post(`/admin/draws/${drawId}/resume`, { reason: 'Resolved: transcription confirmed', expectedEditVersion: suspended.body.editVersion }, { 'Idempotency-Key': key() }).expect(200);
    expect(resumed.body.visibility).toBe('ACTIVE');
    expect((await request(app.getHttpServer()).get(`/api/v1/draws/${drawId}`).expect(200)).body.publicationStatus).toBe('COMPLETE');
    const audit = await publisher.get(`/admin/draws/${drawId}/audit`).expect(200);
    expect(audit.body.items.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(['DRAW_SUSPENDED', 'DRAW_RESUMED', 'DRAW_RESULT_PUBLISHED', 'DRAW_CREATED']));
  });

  it('corrections clone the current revision, publish as revision 2, preserve revision 1 and update public reads and checks (AC-07)', async () => {
    const draft = AdminRevisionSchema.parse((await editor.post(`/admin/draws/${drawId}/corrections`, { reason: 'Transposed digits in the first prize', source: { kind: 'MANUAL_TRANSCRIPTION', title: 'Corrected transcription', url: null, documentHash: null, acquiredAt: null, note: null } }).expect(201)).body);
    expect(draft).toMatchObject({ workflowState: 'DRAFT', publicationKind: 'CORRECTION', revisionNo: 2, basedOnRevisionId: revisionId, correctionReason: 'Transposed digits in the first prize' });
    expect(draft.evidence).toHaveLength(2);
    // Only one open draft per draw.
    await editor.post(`/admin/draws/${drawId}/corrections`, { reason: 'again', source: { kind: 'MANUAL_TRANSCRIPTION', title: 'x', url: null, documentHash: null, acquiredAt: null, note: null } }).expect(409);
    const edited = AdminRevisionSchema.parse((await editor.patch(`/admin/revisions/${draft.id}`, { replaceEntries: [{ categoryCode: 'FIRST', entries: [{ series: 'AC', number: '000312' }] }, { categoryCode: 'CONSOLATION', entries: [{ series: 'AC', number: '000312' }] }] }, draft.editVersion).expect(200)).body);
    // Publishing against the wrong current pointer fails; the right one succeeds.
    const ready = AdminRevisionSchema.parse((await publisher.post(`/admin/revisions/${draft.id}/review`, { confirmSelfReview: false, note: null }, { 'If-Match': String(edited.editVersion) }).expect(200)).body);
    await publisher.post(`/admin/revisions/${draft.id}/publish`, { expectedEditVersion: ready.editVersion, expectedCurrentRevisionId: null, reactivate: false }, { 'Idempotency-Key': key() }).expect(409);
    const result = PublishResultSchema.parse((await publisher.post(`/admin/revisions/${draft.id}/publish`, { expectedEditVersion: ready.editVersion, expectedCurrentRevisionId: revisionId, reactivate: false }, { 'Idempotency-Key': key() }).expect(200)).body);
    expect(result.supersededRevisionId).toBe(revisionId);
    expect(Number(result.datasetVersion)).toBeGreaterThan(Number(publishResult.datasetVersion));
    const pub = ResultResponseSchema.parse((await request(app.getHttpServer()).get(`/api/v1/draws/${drawId}/result`).expect(200)).body);
    expect(pub.revision).toMatchObject({ revisionNo: 2, isCorrection: true, supersededRevisionCount: 1, correctionReason: 'Transposed digits in the first prize' });
    expect(pub.entries.find((e) => e.categoryCode === 'FIRST')?.items).toEqual([{ series: 'AC', number: '000312' }]);
    const old = AdminRevisionSchema.parse((await publisher.get(`/admin/revisions/${revisionId}`).expect(200)).body);
    expect(old).toMatchObject({ workflowState: 'SUPERSEDED', isCurrent: false });
    expect((await publisher.get(`/admin/revisions/${revisionId}/entries?categoryCode=FIRST`).expect(200)).body.items[0].number).toBe('000321');
    // The old first-prize number no longer wins FIRST; it still matches the unchanged LAST4 suffix 0321, and only that.
    const oldNumber = TicketCheckResponseSchema.parse((await request(app.getHttpServer()).post('/api/v1/ticket-check').set('content-type', 'application/json').send({ lotteryId: IDS.lotteryNila, drawId, series: 'AC', number: '000321' }).expect(200)).body);
    expect(oldNumber.matches).toEqual([{ categoryCode: 'LAST4', awardConfirmed: true, amountMinor: '100000', currency: 'INR' }]);
    const newNumber = TicketCheckResponseSchema.parse((await request(app.getHttpServer()).post('/api/v1/ticket-check').set('content-type', 'application/json').send({ lotteryId: IDS.lotteryNila, drawId, series: 'AC', number: '000312' }).expect(200)).body);
    expect(newNumber.matches[0]?.categoryCode).toBe('FIRST');
  });

  it('two publishers racing on the same draw: exactly one commits, the other gets a conflict (T12)', async () => {
    const d = await editor.post('/admin/draws', { lotteryId: IDS.lotteryThira, drawCode: 'TH-040', scheduledDate: '2026-10-06', actualDate: null, scheduledAt: null, actualAt: null, phase: 'SCHEDULED' }).expect(201);
    const mk = async (first: string) => {
      const pv = await editor.post('/admin/imports', { format: 'json', manifest: manifest({ lotteryCode: 'DEMO_THIRA', drawCode: 'TH-040', categories: [{ code: 'FIRST', state: 'COMPLETE', amountMinor: '1' }, { code: 'SECOND', state: 'COMPLETE', amountMinor: '1' }, { code: 'LAST3', state: 'COMPLETE', amountMinor: '1' }] }), entries: [{ categoryCode: 'FIRST', series: 'BA', number: first }, { categoryCode: 'SECOND', series: 'BB', number: '222222' }, ...Array.from({ length: 10 }, (_, i) => ({ categoryCode: 'LAST3', series: '', number: String(100 + i) }))] }).expect(200);
      expect(pv.body.status).toBe('PREVIEW_READY');
      const draft = AdminRevisionSchema.parse((await editor.post(`/admin/imports/${pv.body.id}/create-draft`).expect(200)).body);
      return AdminRevisionSchema.parse((await publisher.post(`/admin/revisions/${draft.id}/review`, { confirmSelfReview: false, note: null }, { 'If-Match': '1' }).expect(200)).body);
    };
    const a = await mk('111111');
    const b = await mk('333333');
    expect(a.basedOnRevisionId).toBeNull();
    expect(b.basedOnRevisionId).toBeNull();
    const [ra, rb] = await Promise.all([
      publisher.post(`/admin/revisions/${a.id}/publish`, { expectedEditVersion: a.editVersion, expectedCurrentRevisionId: null, reactivate: false }, { 'Idempotency-Key': key() }),
      publisher.post(`/admin/revisions/${b.id}/publish`, { expectedEditVersion: b.editVersion, expectedCurrentRevisionId: null, reactivate: false }, { 'Idempotency-Key': key() }),
    ]);
    expect([ra.status, rb.status].sort()).toEqual([200, 409]);
    const draw = await ds.query<{ current_revision_id: string }[]>(`SELECT current_revision_id FROM draw WHERE id = $1`, [d.body.id]);
    const winner = ra.status === 200 ? a.id : b.id;
    expect(draw[0]?.current_revision_id).toBe(winner);
    const states = await ds.query<{ workflow_state: string }[]>(`SELECT workflow_state FROM result_revision WHERE draw_id = $1 ORDER BY revision_no`, [d.body.id]);
    expect(states.map((s) => s.workflow_state).sort()).toEqual(['PUBLISHED', 'READY']);
  });

  it('rule lifecycle: draft → approve (idempotent) → revoke makes checks unsupported; approval needs a compilable rule', async () => {
    const lottery = await publisher.post('/admin/lotteries', { code: 'DEMO_NEW', slug: 'demo-new', name: { en: 'New (Sample)', ml: 'പുതിയത് (സാമ്പിൾ)' }, active: true }).expect(201);
    const ruleSet = { schemaVersion: 1, engineVersion: 'v1', lotteryCode: 'DEMO_NEW', ruleVersion: 1, numberLength: 4, allowedFirstDigits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], allowedSeries: ['NA'], awardPolicy: 'SINGLE_BY_PRIORITY', categories: [{ code: 'FIRST', labels: { en: 'First', ml: 'ഒന്ന്' }, metricRole: 'FIRST_PRIZE', priority: 1, match: { kind: 'FULL_NUMBER', seriesPolicy: 'MATCH_ENTRY' }, excludedBy: [], expectedEntryCount: 1 }] };
    const source = { kind: 'MANUAL_TRANSCRIPTION', title: 'Synthetic rule note', url: null, documentHash: null, acquiredAt: null, note: null };
    const broken = await editor.post(`/admin/lotteries/${lottery.body.id}/rules`, { ruleSet: { ...ruleSet, ruleVersion: 2, categories: [{ ...ruleSet.categories[0], excludedBy: ['FIRST'] }] }, source }).expect(201);
    expect(broken.body.compiles).toBe(false);
    await publisher.post(`/admin/rules/${broken.body.id}/approve`, { note: 'try' }, { 'Idempotency-Key': key() }).expect(400);
    const rule = await editor.post(`/admin/lotteries/${lottery.body.id}/rules`, { ruleSet, source }).expect(201);
    expect(rule.body).toMatchObject({ state: 'DRAFT', compiles: true });
    await editor.post(`/admin/rules/${rule.body.id}/approve`, { note: 'x' }, { 'Idempotency-Key': key() }).expect(403);
    const k = key();
    const approved = await publisher.post(`/admin/rules/${rule.body.id}/approve`, { note: 'Reviewed synthetic scheme note' }, { 'Idempotency-Key': k }).expect(200);
    expect(approved.body.state).toBe('APPROVED');
    const replay = await publisher.post(`/admin/rules/${rule.body.id}/approve`, { note: 'Reviewed synthetic scheme note' }, { 'Idempotency-Key': k }).expect(200);
    expect(replay.headers['idempotent-replayed']).toBe('true');
    // Approved content is immutable at the database.
    await expect(ds.query(`UPDATE rule_version SET number_length = 5 WHERE id = $1`, [rule.body.id])).rejects.toThrow(/immutable/);
    // Revoking Nila's rule makes the published NL-039 result viewable but uncheckable.
    await publisher.post(`/admin/rules/${IDS.ruleNila1}/revoke`, { reason: 'Synthetic: scheme document under review' }, { 'Idempotency-Key': key() }).expect(200);
    const check = TicketCheckResponseSchema.parse((await request(app.getHttpServer()).post('/api/v1/ticket-check').set('content-type', 'application/json').send({ lotteryId: IDS.lotteryNila, drawId: IDS.drawNila039, series: 'AA', number: '001234' }).expect(200)).body);
    expect(check.outcome).toBe('RULES_UNSUPPORTED');
    expect((await request(app.getHttpServer()).get(`/api/v1/draws/${IDS.drawNila039}/result`).expect(200)).body.categories.length).toBe(3);
  });
});

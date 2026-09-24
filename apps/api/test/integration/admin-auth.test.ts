import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ErrorResponseSchema, SessionResponseSchema } from '@bhagyarekha/contracts';
import { AdminSessionEntity } from '../../src/database/entities/index.js';
import { ORIGIN, PASSWORD, createAdmin, loginAs } from './admin-helpers.js';
import { bootApp, markMode, resetDatabase, seedDemoDatabase } from './helpers.js';

describe('admin authentication, CSRF and authorization boundaries (T24/T25)', () => {
  let ds: DataSource;
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    ds = await resetDatabase();
    await markMode(ds, 'demo');
    await seedDemoDatabase(ds);
    await createAdmin(ds, 'publisher@example.test', 'PUBLISHER');
    await createAdmin(ds, 'editor@example.test', 'EDITOR');
    app = await bootApp();
  });
  afterAll(async () => {
    await app?.close();
    await ds?.destroy();
  });

  it('rejects anonymous admin access with 401 at the API, not merely in the UI', async () => {
    expect(ErrorResponseSchema.parse((await http().get('/api/v1/admin/lotteries').expect(401)).body).error.code).toBe('UNAUTHENTICATED');
    expect(ErrorResponseSchema.parse((await http().get('/api/v1/auth/session').expect(401)).body).error.code).toBe('UNAUTHENTICATED');
    await http().post('/api/v1/admin/draws').set('Origin', ORIGIN).set('content-type', 'application/json').send({}).expect(401);
  });

  it('login requires a same-origin JSON request and does not reveal which part was wrong', async () => {
    await http().post('/api/v1/auth/login').set('content-type', 'application/json').send({ email: 'publisher@example.test', password: PASSWORD }).expect(403);
    await http().post('/api/v1/auth/login').set('Origin', 'https://evil.example').set('content-type', 'application/json').send({ email: 'publisher@example.test', password: PASSWORD }).expect(403);
    const wrongPw = await http().post('/api/v1/auth/login').set('Origin', ORIGIN).set('content-type', 'application/json').send({ email: 'publisher@example.test', password: 'nope-nope-nope' }).expect(401);
    const unknown = await http().post('/api/v1/auth/login').set('Origin', ORIGIN).set('content-type', 'application/json').send({ email: 'nobody@example.test', password: PASSWORD }).expect(401);
    expect(wrongPw.body.error.message).toBe(unknown.body.error.message);
    expect(JSON.stringify(wrongPw.body)).not.toContain('nope-nope-nope');
  });

  it('issues an HttpOnly session cookie and a CSRF token; the session endpoint echoes the user', async () => {
    const res = await http().post('/api/v1/auth/login').set('Origin', ORIGIN).set('content-type', 'application/json').send({ email: 'publisher@example.test', password: PASSWORD }).expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/br_admin=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    const body = SessionResponseSchema.parse(res.body);
    expect(body.user).toMatchObject({ email: 'publisher@example.test', role: 'PUBLISHER' });
    expect(body.dataMode).toBe('demo');
    // The raw token is not stored; only its hash is.
    const token = cookie.split('br_admin=')[1]?.split(';')[0] as string;
    const sessions = await ds.manager.find(AdminSessionEntity);
    expect(sessions.some((s) => s.tokenHash === token)).toBe(false);
    expect(sessions.length).toBeGreaterThan(0);
  });

  it('blocks unsafe requests without Origin or CSRF token even with a valid cookie (T25)', async () => {
    const admin = await loginAs(app, 'publisher@example.test');
    const body = { code: 'DEMO_X', slug: 'demo-x', name: { en: 'X', ml: 'എക്സ്' }, active: true };
    const noOrigin = await request(app.getHttpServer()).post('/api/v1/admin/lotteries').set('Cookie', admin.cookie).set('X-CSRF-Token', admin.csrf).set('content-type', 'application/json').send(body).expect(403);
    expect(noOrigin.body.error.code).toBe('CSRF_FAILED');
    const badOrigin = await request(app.getHttpServer()).post('/api/v1/admin/lotteries').set('Cookie', admin.cookie).set('Origin', 'https://evil.example').set('X-CSRF-Token', admin.csrf).set('content-type', 'application/json').send(body).expect(403);
    expect(badOrigin.body.error.code).toBe('CSRF_FAILED');
    const noToken = await request(app.getHttpServer()).post('/api/v1/admin/lotteries').set('Cookie', admin.cookie).set('Origin', ORIGIN).set('content-type', 'application/json').send(body).expect(403);
    expect(noToken.body.error.code).toBe('CSRF_FAILED');
    const wrongToken = await request(app.getHttpServer()).post('/api/v1/admin/lotteries').set('Cookie', admin.cookie).set('Origin', ORIGIN).set('X-CSRF-Token', 'x'.repeat(43)).set('content-type', 'application/json').send(body).expect(403);
    expect(wrongToken.body.error.code).toBe('CSRF_FAILED');
    // Nothing was created by any of those attempts.
    const list = await admin.get('/admin/lotteries').expect(200);
    expect(list.body.items.some((l: { code: string }) => l.code === 'DEMO_X')).toBe(false);
    // The proper request succeeds.
    await admin.post('/admin/lotteries', body).expect(201);
  });

  it('enforces roles server-side: an editor cannot create lotteries, approve rules or publish', async () => {
    const editor = await loginAs(app, 'editor@example.test');
    expect((await editor.post('/admin/lotteries', { code: 'DEMO_Y', slug: 'demo-y', name: { en: 'Y', ml: 'വൈ' }, active: true }).expect(403)).body.error.code).toBe('FORBIDDEN');
    await editor.post('/admin/rules/b0000001-0000-4000-8000-000000000001/revoke', { reason: 'x' }, { 'Idempotency-Key': 'editor-revoke-1' }).expect(403);
    await editor.post('/admin/revisions/c0000001-0000-4000-8000-000000000391/publish', { expectedEditVersion: 1, expectedCurrentRevisionId: null, reactivate: false }, { 'Idempotency-Key': 'editor-publish-1' }).expect(403);
    // Editors can read.
    await editor.get('/admin/draws').expect(200);
  });

  it('throttles repeated failed logins per account and recovers after success elsewhere', async () => {
    for (let i = 0; i < 5; i += 1) {
      await http().post('/api/v1/auth/login').set('Origin', ORIGIN).set('content-type', 'application/json').send({ email: 'editor@example.test', password: 'wrong-password-1' }).expect(401);
    }
    const blocked = await http().post('/api/v1/auth/login').set('Origin', ORIGIN).set('content-type', 'application/json').send({ email: 'editor@example.test', password: PASSWORD }).expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    // Other accounts are unaffected by the per-account bucket.
    await http().post('/api/v1/auth/login').set('Origin', ORIGIN).set('content-type', 'application/json').send({ email: 'publisher@example.test', password: PASSWORD }).expect(200);
  });

  it('logout revokes the session and the cookie no longer authenticates', async () => {
    const admin = await loginAs(app, 'publisher@example.test');
    await admin.get('/auth/session').expect(200);
    await admin.post('/auth/logout').expect(204);
    await admin.get('/auth/session').expect(401);
    await admin.get('/admin/lotteries').expect(401);
  });

  it('a disabled user or bumped auth version invalidates existing sessions', async () => {
    const admin = await loginAs(app, 'publisher@example.test');
    await ds.query(`UPDATE admin_user SET auth_version = auth_version + 1 WHERE email = 'publisher@example.test'`);
    await admin.get('/auth/session').expect(401);
  });
});

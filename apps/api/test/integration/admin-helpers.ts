import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import argon2 from 'argon2';
import request, { type Test } from 'supertest';
import type { DataSource } from 'typeorm';
import { AdminUserEntity } from '../../src/database/entities/index.js';

export const PASSWORD = 'correct-horse-battery-staple';
export const ORIGIN = 'http://localhost:3000';

export async function createAdmin(ds: DataSource, email: string, role: 'EDITOR' | 'PUBLISHER'): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  await ds.manager.insert(AdminUserEntity, { id, email, passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }), role, disabled: false, authVersion: 1, createdAt: now, updatedAt: now, editVersion: 1 });
  return id;
}

export interface AdminClient {
  cookie: string;
  csrf: string;
  userId: string;
  get: (path: string) => Test;
  post: (path: string, body?: unknown, headers?: Record<string, string>) => Test;
  patch: (path: string, body: unknown, ifMatch: number) => Test;
}

/** Logs in through the real endpoint and returns helpers that attach cookie, Origin and CSRF like the browser would. */
export async function loginAs(app: INestApplication, email: string): Promise<AdminClient> {
  const res = await request(app.getHttpServer()).post('/api/v1/auth/login').set('Origin', ORIGIN).set('content-type', 'application/json').send({ email, password: PASSWORD }).expect(200);
  const setCookie = res.headers['set-cookie'];
  const raw = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!raw) throw new Error('login did not set a cookie');
  const cookie = raw.split(';')[0] as string;
  const csrf = res.body.csrfToken as string;
  const server = app.getHttpServer();
  return {
    cookie,
    csrf,
    userId: res.body.user.id as string,
    get: (path) => request(server).get(`/api/v1${path}`).set('Cookie', cookie),
    post: (path, body?: unknown, headers: Record<string, string> = {}) => {
      let t = request(server).post(`/api/v1${path}`).set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).set('content-type', 'application/json');
      for (const [k, v] of Object.entries(headers)) t = t.set(k, v);
      return t.send((body ?? {}) as object);
    },
    patch: (path, body, ifMatch) => request(server).patch(`/api/v1${path}`).set('Cookie', cookie).set('Origin', ORIGIN).set('X-CSRF-Token', csrf).set('If-Match', String(ifMatch)).set('content-type', 'application/json').send(body as object),
  };
}

export const key = () => randomUUID();

import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { DataSource, IsNull } from 'typeorm';
import { ApiError } from '../../common/api-error.js';
import { Clock } from '../../common/clock.js';
import { ENV, type Env } from '../../config/env.provider.js';
import { AdminSessionEntity, AdminUserEntity } from '../../database/entities/index.js';
import { LoginThrottle } from './login-throttle.js';

export interface ResolvedSession {
  user: AdminUserEntity;
  session: AdminSessionEntity;
}

// A real Argon2id hash of a random string, used so unknown emails take as long as wrong passwords.
const DUMMY_HASH_PROMISE = argon2.hash(randomBytes(16).toString('hex'), { type: argon2.argon2id });
const LAST_SEEN_WRITE_INTERVAL_MS = 60_000;

@Injectable()
export class AdminSessionService {
  readonly throttle = new LoginThrottle();

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly dataSource: DataSource,
    private readonly clock: Clock,
  ) {}

  get absoluteSeconds(): number {
    return this.env.SESSION_ABSOLUTE_HOURS * 3600;
  }

  static hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  /** Verifies credentials and opens a fresh session (rotation on every login). */
  async login(email: string, password: string, ip: string): Promise<{ resolved: ResolvedSession; rawToken: string }> {
    const now = this.clock.now();
    const wait = this.throttle.blockedFor(email, ip, now.getTime());
    if (wait > 0) throw new ApiError(429, 'RATE_LIMITED', `Too many failed logins; retry in ${wait} seconds`);

    const user = await this.dataSource.manager.findOne(AdminUserEntity, { where: { email } });
    const ok = user && !user.disabled ? await argon2.verify(user.passwordHash, password) : (await argon2.verify(await DUMMY_HASH_PROMISE, password), false);
    if (!ok || !user) {
      this.throttle.recordFailure(email, ip, now.getTime());
      throw new ApiError(401, 'UNAUTHENTICATED', 'Email or password is incorrect');
    }
    this.throttle.recordSuccess(email);

    const rawToken = randomBytes(32).toString('base64url');
    const session = this.dataSource.manager.create(AdminSessionEntity, {
      id: randomUUID(),
      userId: user.id,
      tokenHash: AdminSessionService.hashToken(rawToken),
      csrfToken: randomBytes(32).toString('base64url'),
      authVersion: user.authVersion,
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt: new Date(now.getTime() + this.env.SESSION_IDLE_MINUTES * 60_000),
      absoluteExpiresAt: new Date(now.getTime() + this.absoluteSeconds * 1000),
      revokedAt: null,
    });
    await this.dataSource.manager.insert(AdminSessionEntity, session);
    return { resolved: { user, session }, rawToken };
  }

  /** Resolves a cookie token to a live session, extending the idle window (write-throttled). */
  async resolve(rawToken: string): Promise<ResolvedSession | null> {
    if (!rawToken || rawToken.length > 200) return null;
    const now = this.clock.now();
    const session = await this.dataSource.manager.findOne(AdminSessionEntity, { where: { tokenHash: AdminSessionService.hashToken(rawToken) } });
    if (!session || session.revokedAt || session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) return null;
    const user = await this.dataSource.manager.findOne(AdminUserEntity, { where: { id: session.userId } });
    if (!user || user.disabled || user.authVersion !== session.authVersion) return null;

    if (now.getTime() - session.lastSeenAt.getTime() > LAST_SEEN_WRITE_INTERVAL_MS) {
      const idleExpiresAt = new Date(Math.min(now.getTime() + this.env.SESSION_IDLE_MINUTES * 60_000, session.absoluteExpiresAt.getTime()));
      await this.dataSource.manager.update(AdminSessionEntity, { id: session.id }, { lastSeenAt: now, idleExpiresAt });
      session.lastSeenAt = now;
      session.idleExpiresAt = idleExpiresAt;
    }
    return { user, session };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.dataSource.manager.update(AdminSessionEntity, { id: sessionId, revokedAt: IsNull() }, { revokedAt: this.clock.now() });
  }

  static csrfMatches(expected: string, supplied: string | undefined): boolean {
    if (!supplied || supplied.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
  }
}

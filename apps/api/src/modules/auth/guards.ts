import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AdminRole } from '@bhagyarekha/contracts';
import { ApiError } from '../../common/api-error.js';
import { ENV, type Env } from '../../config/env.provider.js';
import { getAdminContext, setAdminContext } from './admin-context.js';
import { AdminSessionService } from './admin-session.service.js';
import { cookiePolicy, readCookie } from './cookies.js';

export const ROLE_KEY = 'br:role';
/** PUBLISHER satisfies EDITOR. */
export const RequireRole = (role: AdminRole) => SetMetadata(ROLE_KEY, role);

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function allowedOrigins(env: Env): Set<string> {
  return new Set([env.ALLOWED_ORIGIN, new URL(env.PUBLIC_BASE_URL).origin]);
}

/** Origin + JSON content-type check for unsafe requests. Used by login (pre-session) and by CsrfGuard. */
export function assertSameOrigin(req: Request, env: Env): void {
  if (!UNSAFE_METHODS.has(req.method)) return;
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || !allowedOrigins(env).has(origin)) {
    throw new ApiError(403, 'CSRF_FAILED', 'Cross-site request rejected: missing or unexpected Origin');
  }
  const contentType = req.headers['content-type'] ?? '';
  const hasBody = req.headers['content-length'] !== undefined && req.headers['content-length'] !== '0';
  if (hasBody && !contentType.toLowerCase().startsWith('application/json')) {
    throw new ApiError(403, 'CSRF_FAILED', 'Unsafe requests must use application/json');
  }
}

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}
  canActivate(ctx: ExecutionContext): boolean {
    assertSameOrigin(ctx.switchToHttp().getRequest<Request>(), this.env);
    return true;
  }
}

/** Authenticates the cookie session and attaches the admin context. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly sessions: AdminSessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const token = readCookie(req, cookiePolicy(this.env).name);
    const resolved = token ? await this.sessions.resolve(token) : null;
    if (!resolved) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required');
    setAdminContext(req, resolved);
    return true;
  }
}

/** Exact Origin + X-CSRF-Token for every unsafe authenticated request (SameSite alone is not enough). */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!UNSAFE_METHODS.has(req.method)) return true;
    assertSameOrigin(req, this.env);
    const admin = getAdminContext(req);
    if (!admin) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required');
    const supplied = req.headers['x-csrf-token'];
    if (!AdminSessionService.csrfMatches(admin.session.csrfToken, typeof supplied === 'string' ? supplied : undefined)) {
      throw new ApiError(403, 'CSRF_FAILED', 'Missing or invalid CSRF token');
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AdminRole | undefined>(ROLE_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required) return true;
    const admin = getAdminContext(ctx.switchToHttp().getRequest<Request>());
    if (!admin) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in required');
    const ok = admin.user.role === 'PUBLISHER' || admin.user.role === required;
    if (!ok) throw new ApiError(403, 'FORBIDDEN', `This action requires the ${required} role`);
    return true;
  }
}

import type { Request, Response } from 'express';
import type { Env } from '../../config/env.js';

export interface CookiePolicy {
  name: string;
  secure: boolean;
}

/**
 * Production always uses a Secure `__Host-` cookie. Development may opt into a
 * plain-HTTP cookie with INSECURE_DEV_COOKIES=true; that flag is ignored in production.
 */
export function cookiePolicy(env: Env): CookiePolicy {
  const secure = env.NODE_ENV === 'production' ? true : !env.INSECURE_DEV_COOKIES;
  return { name: secure ? '__Host-br_admin' : 'br_admin', secure };
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export function setSessionCookie(res: Response, policy: CookiePolicy, token: string, maxAgeSeconds: number): void {
  res.cookie(policy.name, token, { httpOnly: true, sameSite: 'lax', secure: policy.secure, path: '/', maxAge: maxAgeSeconds * 1000 });
}

export function clearSessionCookie(res: Response, policy: CookiePolicy): void {
  res.cookie(policy.name, '', { httpOnly: true, sameSite: 'lax', secure: policy.secure, path: '/', maxAge: 0 });
}

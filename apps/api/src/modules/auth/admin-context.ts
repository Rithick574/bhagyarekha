import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AdminSessionEntity, AdminUserEntity } from '../../database/entities/index.js';
import { requestIdOf } from '../../common/request-context.js';

export interface AdminContext {
  user: AdminUserEntity;
  session: AdminSessionEntity;
  requestId: string;
}

const contexts = new WeakMap<Request, AdminContext>();

export function setAdminContext(req: Request, ctx: Omit<AdminContext, 'requestId'>): void {
  contexts.set(req, { ...ctx, requestId: requestIdOf(req) });
}

export function getAdminContext(req: Request): AdminContext | undefined {
  return contexts.get(req);
}

/** Injects the authenticated admin context (set by SessionGuard). */
export const Admin = createParamDecorator((_data: unknown, ctx: ExecutionContext): AdminContext => {
  const req = ctx.switchToHttp().getRequest<Request>();
  const admin = getAdminContext(req);
  if (!admin) throw new Error('Admin context requested outside an authenticated route');
  return admin;
});

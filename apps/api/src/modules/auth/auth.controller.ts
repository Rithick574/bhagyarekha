import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '../../vendor/throttler.js';
import { LoginRequestSchema, type LoginRequest, type SessionResponse } from '@bhagyarekha/contracts';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ENV, type Env } from '../../config/env.provider.js';
import { DeploymentModeService } from '../deployment-mode/deployment-mode.service.js';
import { Admin, type AdminContext } from './admin-context.js';
import { AdminSessionService, type ResolvedSession } from './admin-session.service.js';
import { clearSessionCookie, cookiePolicy, setSessionCookie } from './cookies.js';
import { CsrfGuard, OriginGuard, SessionGuard } from './guards.js';
import { clientIp } from './headers.js';

@SkipThrottle({ check: true, stats: true })
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly sessions: AdminSessionService,
    private readonly deploymentMode: DeploymentModeService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(OriginGuard)
  async login(@Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<SessionResponse> {
    const { resolved, rawToken } = await this.sessions.login(body.email, body.password, clientIp(req));
    setSessionCookie(res, cookiePolicy(this.env), rawToken, this.sessions.absoluteSeconds);
    return this.toResponse(resolved);
  }

  @Get('session')
  @UseGuards(SessionGuard)
  session(@Admin() admin: AdminContext): SessionResponse {
    return this.toResponse(admin);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(@Admin() admin: AdminContext, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.sessions.revoke(admin.session.id);
    clearSessionCookie(res, cookiePolicy(this.env));
  }

  private toResponse(resolved: ResolvedSession): SessionResponse {
    return {
      user: { id: resolved.user.id, email: resolved.user.email, role: resolved.user.role },
      csrfToken: resolved.session.csrfToken,
      idleExpiresAt: resolved.session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: resolved.session.absoluteExpiresAt.toISOString(),
      dataMode: this.deploymentMode.dataMode,
      allowSelfReview: this.env.ALLOW_SELF_REVIEW,
    };
  }
}

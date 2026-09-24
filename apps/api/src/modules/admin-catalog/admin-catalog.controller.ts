import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  AdminDrawListQuerySchema,
  ApproveRuleRequestSchema,
  CreateDrawRequestSchema,
  CreateLotteryRequestSchema,
  CreateRuleVersionRequestSchema,
  PatchDrawRequestSchema,
  PatchLotteryRequestSchema,
  RevokeRuleRequestSchema,
  UuidSchema,
  type AdminDraw,
  type AdminLottery,
  type AdminRuleVersion,
  type CreateDrawRequest,
  type CreateLotteryRequest,
  type CreateRuleVersionRequest,
  type PatchDrawRequest,
  type PatchLotteryRequest,
} from '@bhagyarekha/contracts';
import type { Response } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuditService } from '../audit/audit.service.js';
import { Admin, type AdminContext } from '../auth/admin-context.js';
import { CsrfGuard, RequireRole, RolesGuard, SessionGuard } from '../auth/guards.js';
import { IdempotencyKey, IfMatch } from '../auth/headers.js';
import { DataSource } from 'typeorm';
import { AdminCatalogService } from './admin-catalog.service.js';

const IdParams = z.strictObject({ id: UuidSchema });
type IdParams = z.infer<typeof IdParams>;

@SkipThrottle({ check: true })
@UseGuards(SessionGuard, CsrfGuard, RolesGuard)
@RequireRole('EDITOR')
@Controller('admin')
export class AdminCatalogController {
  constructor(
    private readonly catalog: AdminCatalogService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('lotteries')
  async listLotteries(): Promise<{ items: AdminLottery[] }> {
    return { items: await this.catalog.listLotteries() };
  }

  @Post('lotteries')
  @RequireRole('PUBLISHER')
  createLottery(@Admin() admin: AdminContext, @Body(new ZodValidationPipe(CreateLotteryRequestSchema)) body: CreateLotteryRequest): Promise<AdminLottery> {
    return this.catalog.createLottery(admin, body);
  }

  @Patch('lotteries/:id')
  @RequireRole('PUBLISHER')
  patchLottery(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @IfMatch() version: number, @Body(new ZodValidationPipe(PatchLotteryRequestSchema)) body: PatchLotteryRequest): Promise<AdminLottery> {
    return this.catalog.patchLottery(admin, p.id, version, body);
  }

  @Get('draws')
  async listDraws(@Query(new ZodValidationPipe(AdminDrawListQuerySchema)) q: z.infer<typeof AdminDrawListQuerySchema>): Promise<{ items: AdminDraw[]; page: number; pageSize: number; total: number }> {
    const { items, total } = await this.catalog.listDraws(q.lotteryId, q.page);
    return { items, page: q.page, pageSize: 50, total };
  }

  @Post('draws')
  createDraw(@Admin() admin: AdminContext, @Body(new ZodValidationPipe(CreateDrawRequestSchema)) body: CreateDrawRequest): Promise<AdminDraw> {
    return this.catalog.createDraw(admin, body);
  }

  @Get('draws/:id')
  getDraw(@Param(new ZodValidationPipe(IdParams)) p: IdParams): Promise<AdminDraw> {
    return this.catalog.getDraw(this.dataSource.manager, p.id);
  }

  @Patch('draws/:id')
  patchDraw(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @IfMatch() version: number, @Body(new ZodValidationPipe(PatchDrawRequestSchema)) body: PatchDrawRequest): Promise<AdminDraw> {
    return this.catalog.patchDraw(admin, p.id, version, body);
  }

  @Get('draws/:id/audit')
  async drawAudit(@Param(new ZodValidationPipe(IdParams)) p: IdParams) {
    return { items: await this.audit.list(this.dataSource.manager, 'DRAW', p.id) };
  }

  @Get('lotteries/:id/rules')
  async listRules(@Param(new ZodValidationPipe(IdParams)) p: IdParams): Promise<{ items: AdminRuleVersion[] }> {
    return { items: await this.catalog.listRules(p.id) };
  }

  @Post('lotteries/:id/rules')
  @HttpCode(201)
  createRule(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @Body(new ZodValidationPipe(CreateRuleVersionRequestSchema)) body: CreateRuleVersionRequest): Promise<AdminRuleVersion> {
    return this.catalog.createRule(admin, p.id, body);
  }

  @Get('rules/:id')
  getRule(@Param(new ZodValidationPipe(IdParams)) p: IdParams): Promise<AdminRuleVersion> {
    return this.catalog.toAdminRule(this.dataSource.manager, p.id);
  }

  @Post('rules/:id/approve')
  @RequireRole('PUBLISHER')
  async approveRule(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @IdempotencyKey() key: string, @Body(new ZodValidationPipe(ApproveRuleRequestSchema)) body: z.infer<typeof ApproveRuleRequestSchema>, @Res({ passthrough: true }) res: Response): Promise<AdminRuleVersion> {
    const out = await this.catalog.approveRule(admin, p.id, key, body.note);
    res.status(out.status).setHeader('Idempotent-Replayed', String(out.replayed));
    return out.body;
  }

  @Post('rules/:id/revoke')
  @RequireRole('PUBLISHER')
  async revokeRule(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @IdempotencyKey() key: string, @Body(new ZodValidationPipe(RevokeRuleRequestSchema)) body: z.infer<typeof RevokeRuleRequestSchema>, @Res({ passthrough: true }) res: Response): Promise<AdminRuleVersion> {
    const out = await this.catalog.revokeRule(admin, p.id, key, body.reason);
    res.status(out.status).setHeader('Idempotent-Replayed', String(out.replayed));
    return out.body;
  }
}

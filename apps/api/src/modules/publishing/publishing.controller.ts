import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  AdminRevisionEntriesQuerySchema,
  AdminRevisionListQuerySchema,
  CreateCorrectionRequestSchema,
  PatchRevisionRequestSchema,
  PublishRevisionRequestSchema,
  ResumeDrawRequestSchema,
  ReviewRevisionRequestSchema,
  SuspendDrawRequestSchema,
  UuidSchema,
  type AdminDraw,
  type AdminRevision,
  type CreateCorrectionRequest,
  type PatchRevisionRequest,
  type PublishResult,
  type PublishRevisionRequest,
  type ReviewRevisionRequest,
} from '@bhagyarekha/contracts';
import type { Response } from 'express';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { AuditService } from '../audit/audit.service.js';
import { Admin, type AdminContext } from '../auth/admin-context.js';
import { CsrfGuard, RequireRole, RolesGuard, SessionGuard } from '../auth/guards.js';
import { IdempotencyKey, IfMatch } from '../auth/headers.js';
import { PublishingService } from './publishing.service.js';
import { RevisionReadService } from './revision-read.service.js';

const IdParams = z.strictObject({ id: UuidSchema });
type IdParams = z.infer<typeof IdParams>;

@SkipThrottle({ check: true })
@UseGuards(SessionGuard, CsrfGuard, RolesGuard)
@RequireRole('EDITOR')
@Controller('admin')
export class PublishingController {
  constructor(
    private readonly reads: RevisionReadService,
    private readonly publishing: PublishingService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('revisions')
  async list(@Query(new ZodValidationPipe(AdminRevisionListQuerySchema)) q: z.infer<typeof AdminRevisionListQuerySchema>) {
    return { items: await this.reads.list(this.dataSource.manager, q) };
  }

  @Get('revisions/:id')
  get(@Param(new ZodValidationPipe(IdParams)) p: IdParams): Promise<AdminRevision> {
    return this.reads.get(this.dataSource.manager, p.id);
  }

  @Get('revisions/:id/entries')
  entries(@Param(new ZodValidationPipe(IdParams)) p: IdParams, @Query(new ZodValidationPipe(AdminRevisionEntriesQuerySchema)) q: z.infer<typeof AdminRevisionEntriesQuerySchema>) {
    return this.reads.entries(this.dataSource.manager, p.id, q.categoryCode, q.page);
  }

  @Get('revisions/:id/audit')
  async revisionAudit(@Param(new ZodValidationPipe(IdParams)) p: IdParams) {
    return { items: await this.audit.list(this.dataSource.manager, 'RESULT_REVISION', p.id) };
  }

  @Patch('revisions/:id')
  patch(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @IfMatch() version: number, @Body(new ZodValidationPipe(PatchRevisionRequestSchema)) body: PatchRevisionRequest): Promise<AdminRevision> {
    return this.publishing.patch(admin, p.id, version, body);
  }

  @Post('revisions/:id/reopen')
  @HttpCode(200)
  reopen(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @IfMatch() version: number): Promise<AdminRevision> {
    return this.publishing.reopen(admin, p.id, version);
  }

  @Post('revisions/:id/review')
  @HttpCode(200)
  @RequireRole('PUBLISHER')
  review(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @IfMatch() version: number, @Body(new ZodValidationPipe(ReviewRevisionRequestSchema)) body: ReviewRevisionRequest): Promise<AdminRevision> {
    return this.publishing.review(admin, p.id, version, body);
  }

  @Post('revisions/:id/publish')
  @HttpCode(200)
  @RequireRole('PUBLISHER')
  async publish(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @IdempotencyKey() key: string, @Body(new ZodValidationPipe(PublishRevisionRequestSchema)) body: PublishRevisionRequest, @Res({ passthrough: true }) res: Response): Promise<PublishResult> {
    const out = await this.publishing.publish(admin, p.id, key, body);
    res.status(out.status).setHeader('Idempotent-Replayed', String(out.replayed));
    return out.body;
  }

  @Post('draws/:id/suspend')
  @HttpCode(200)
  @RequireRole('PUBLISHER')
  async suspend(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @IdempotencyKey() key: string, @Body(new ZodValidationPipe(SuspendDrawRequestSchema)) body: z.infer<typeof SuspendDrawRequestSchema>, @Res({ passthrough: true }) res: Response): Promise<AdminDraw> {
    const out = await this.publishing.setVisibility(admin, p.id, key, 'SUSPEND', body.reason, body.expectedEditVersion);
    res.status(out.status).setHeader('Idempotent-Replayed', String(out.replayed));
    return out.body;
  }

  @Post('draws/:id/resume')
  @HttpCode(200)
  @RequireRole('PUBLISHER')
  async resume(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @IdempotencyKey() key: string, @Body(new ZodValidationPipe(ResumeDrawRequestSchema)) body: z.infer<typeof ResumeDrawRequestSchema>, @Res({ passthrough: true }) res: Response): Promise<AdminDraw> {
    const out = await this.publishing.setVisibility(admin, p.id, key, 'RESUME', body.reason, body.expectedEditVersion);
    res.status(out.status).setHeader('Idempotent-Replayed', String(out.replayed));
    return out.body;
  }

  @Post('draws/:id/corrections')
  @HttpCode(201)
  createCorrection(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams, @Body(new ZodValidationPipe(CreateCorrectionRequestSchema)) body: CreateCorrectionRequest): Promise<AdminRevision> {
    return this.publishing.createCorrection(admin, p.id, body);
  }
}

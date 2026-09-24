import { Body, Controller, Get, HttpCode, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ImportPreviewQuerySchema, ImportRequestSchema, UuidSchema, type AdminRevision, type ImportPreview, type ImportRequest } from '@bhagyarekha/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { Admin, type AdminContext } from '../auth/admin-context.js';
import { CsrfGuard, RequireRole, RolesGuard, SessionGuard } from '../auth/guards.js';
import { ImportsService } from './imports.service.js';

const IdParams = z.strictObject({ id: UuidSchema });
type IdParams = z.infer<typeof IdParams>;

@SkipThrottle({ check: true })
@UseGuards(SessionGuard, CsrfGuard, RolesGuard)
@RequireRole('EDITOR')
@Controller('admin/imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  @HttpCode(200)
  preview(@Admin() admin: AdminContext, @Body(new ZodValidationPipe(ImportRequestSchema)) body: ImportRequest, @Req() req: Request): Promise<ImportPreview> {
    const declared = Number.parseInt(String(req.headers['content-length'] ?? '0'), 10) || 0;
    return this.imports.preview(admin, body, declared);
  }

  @Get(':id')
  get(@Param(new ZodValidationPipe(IdParams)) p: IdParams, @Query(new ZodValidationPipe(ImportPreviewQuerySchema)) q: z.infer<typeof ImportPreviewQuerySchema>): Promise<ImportPreview> {
    return this.imports.getPreview(p.id, q.errorsPage, q.rowsPage);
  }

  @Post(':id/create-draft')
  @HttpCode(200)
  createDraft(@Admin() admin: AdminContext, @Param(new ZodValidationPipe(IdParams)) p: IdParams): Promise<AdminRevision> {
    return this.imports.createDraft(admin, p.id);
  }
}

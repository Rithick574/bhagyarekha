import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AdminRevision, ImportPreview, ImportRequest, ImportRowError } from '@bhagyarekha/contracts';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/api-error.js';
import { canonicalHash, sha256Hex } from '../../common/canonical-hash.js';
import { ENV, type Env } from '../../config/env.provider.js';
import {
  DrawEntity,
  ImportBatchEntity,
  LotteryEntity,
  ResultRevisionEntity,
  RevisionCategoryEntity,
  RevisionEvidenceEntity,
  RuleVersionEntity,
  WinningEntryEntity,
  type DrawSnapshot,
} from '../../database/entities/index.js';
import { insertSourceEvidence } from '../admin-catalog/admin-catalog.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AdminContext } from '../auth/admin-context.js';
import { DeploymentModeService } from '../deployment-mode/deployment-mode.service.js';
import { RevisionReadService } from '../publishing/revision-read.service.js';
import { RuleLoaderService } from '../rule-versions/rule-loader.service.js';
import { parseCsvRows, parseJsonRows } from './import-parser.js';
import { validateImport } from './import-validator.js';

const PAGE = 100;
const DEADLINE_MS = 10_000;

interface StoredRow { row: number; categoryCode: string; series: string; number: string }

@Injectable()
export class ImportsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly dataSource: DataSource,
    private readonly rules: RuleLoaderService,
    private readonly audit: AuditService,
    private readonly deploymentMode: DeploymentModeService,
    private readonly revisions: RevisionReadService,
  ) {}

  /** Synchronous, bounded preview. Nothing public changes. */
  async preview(admin: AdminContext, request: ImportRequest, rawBytes: number): Promise<ImportPreview> {
    if (rawBytes > this.env.IMPORT_MAX_BYTES) throw new ApiError(413, 'IMPORT_TOO_LARGE', `Import exceeds ${this.env.IMPORT_MAX_BYTES} bytes; split it or reduce it — nothing was truncated`);
    const startedAt = Date.now();
    const manifest = request.manifest;
    const raw = request.format === 'csv' ? request.csv : JSON.stringify(request.entries);
    const rawBuffer = Buffer.from(raw, 'utf8');
    if (rawBuffer.byteLength > this.env.IMPORT_MAX_BYTES) throw new ApiError(413, 'IMPORT_TOO_LARGE', `Import exceeds ${this.env.IMPORT_MAX_BYTES} bytes`);

    const m = this.dataSource.manager;
    const errors: ImportRowError[] = [];
    const lottery = await m.findOne(LotteryEntity, { where: { code: manifest.lotteryCode } });
    if (!lottery) errors.push({ row: 0, path: 'lotteryCode', code: 'UNKNOWN_LOTTERY', message: `No lottery with code ${manifest.lotteryCode}` });
    const draw = lottery ? await m.findOne(DrawEntity, { where: { lotteryId: lottery.id, drawCode: manifest.drawCode } }) : null;
    if (lottery && !draw) errors.push({ row: 0, path: 'drawCode', code: 'UNKNOWN_DRAW', message: `No draw ${manifest.drawCode} for ${manifest.lotteryCode}; create the draw first` });
    const ruleVersion = lottery ? await m.findOne(RuleVersionEntity, { where: { lotteryId: lottery.id, version: manifest.ruleVersion } }) : null;
    if (lottery && !ruleVersion) errors.push({ row: 0, path: 'ruleVersion', code: 'UNKNOWN_RULE_VERSION', message: `No rule version ${manifest.ruleVersion} for ${manifest.lotteryCode}` });
    const loaded = ruleVersion ? await this.rules.load(m, ruleVersion.id) : null;
    if (ruleVersion && !loaded?.compiled) errors.push({ row: 0, path: 'ruleVersion', code: 'RULE_NOT_COMPILABLE', message: 'Rule version does not compile' });

    const parsed = request.format === 'csv' ? parseCsvRows(request.csv, this.env.IMPORT_MAX_ENTRIES) : parseJsonRows(request.entries, this.env.IMPORT_MAX_ENTRIES);
    let validRows: { row: number; entry: StoredRow }[] = [];
    let rowsPerCategory: Record<string, number> = {};
    if (loaded?.compiled && draw && ruleVersion) {
      const outcome = validateImport(parsed, { manifest, rules: loaded.compiled, drawHasCurrentRevision: draw.currentRevisionId !== null, ruleState: ruleVersion.state, dataMode: this.deploymentMode.dataMode });
      errors.push(...outcome.errors);
      validRows = outcome.validRows.map((v) => ({ row: v.row, entry: { row: v.row, ...v.entry } }));
      rowsPerCategory = outcome.rowsPerCategory;
    } else {
      errors.push(...parsed.errors);
    }
    if (Date.now() - startedAt > DEADLINE_MS) throw ApiError.unavailable('SERVICE_UNAVAILABLE', 'Import processing exceeded the 10 second deadline; split the file');

    const status = errors.length === 0 ? 'PREVIEW_READY' : 'VALIDATION_FAILED';
    const storedRows: StoredRow[] = (status === 'PREVIEW_READY' ? validRows : parsed.rows.map((r) => ({ row: r.row, entry: { row: r.row, ...r.entry } }))).map((r) => r.entry);
    const now = new Date();
    const batch = m.create(ImportBatchEntity, {
      id: randomUUID(), actorId: admin.user.id, lotteryId: lottery?.id ?? null, drawId: draw?.id ?? null, ruleVersionId: ruleVersion?.id ?? null, format: request.format,
      manifest, rawUpload: rawBuffer, uploadSha256: sha256Hex(raw), canonicalPayloadHash: status === 'PREVIEW_READY' ? canonicalHash({ manifest, rows: storedRows.map(({ categoryCode, series, number }) => ({ categoryCode, series, number })) }) : null,
      status, errors, parsedRows: storedRows, summary: { totalRows: parsed.totalRows, validRows: validRows.length, errorCount: errors.length, rowsPerCategory }, createdRevisionId: null, createdAt: now, updatedAt: now,
    });
    await m.save(ImportBatchEntity, batch);
    await this.audit.record(m, { actorId: admin.user.id, action: 'IMPORT_PREVIEWED', entityType: 'IMPORT_BATCH', entityId: batch.id, afterHash: batch.uploadSha256, metadata: { status, totalRows: parsed.totalRows, errorCount: errors.length, drawCode: manifest.drawCode }, requestId: admin.requestId });
    return this.toPreview(batch, 1, 1);
  }

  async getPreview(id: string, errorsPage: number, rowsPage: number): Promise<ImportPreview> {
    const batch = await this.dataSource.manager.findOne(ImportBatchEntity, { where: { id } });
    if (!batch) throw ApiError.notFound('NOT_FOUND', 'No such import');
    return this.toPreview(batch, errorsPage, rowsPage);
  }

  /** LLD §5.2: PREVIEW_READY → DRAFT revision with every configured category materialised. Repeat calls return the existing draft. */
  async createDraft(admin: AdminContext, batchId: string): Promise<AdminRevision> {
    const revisionId = await this.dataSource.transaction(async (m) => {
      const batch = await m.createQueryBuilder(ImportBatchEntity, 'b').setLock('pessimistic_write').where('b.id = :id', { id: batchId }).getOne();
      if (!batch) throw ApiError.notFound('NOT_FOUND', 'No such import');
      if (batch.createdRevisionId) return batch.createdRevisionId;
      if (batch.status !== 'PREVIEW_READY' || !batch.drawId || !batch.ruleVersionId || !batch.lotteryId) throw ApiError.conflict('REVISION_CONFLICT', `Import is ${batch.status}; only PREVIEW_READY can become a draft`);
      const manifest = batch.manifest as ImportRequest['manifest'];

      await m.createQueryBuilder(LotteryEntity, 'l').setLock('pessimistic_write').where('l.id = :id', { id: batch.lotteryId }).getOne();
      const draw = await m.createQueryBuilder(DrawEntity, 'd').setLock('pessimistic_write').where('d.id = :id', { id: batch.drawId }).getOneOrFail();
      const rule = await m.findOneOrFail(RuleVersionEntity, { where: { id: batch.ruleVersionId } });
      if (rule.state !== 'APPROVED') throw ApiError.conflict('REVISION_CONFLICT', 'Rule version is no longer approved');
      if ((manifest.publicationKind === 'INITIAL') !== (draw.currentRevisionId === null)) throw ApiError.conflict('REVISION_CONFLICT', 'The draw publication state changed since the preview; re-import');

      const now = new Date();
      const snapshot: DrawSnapshot = { drawCode: draw.drawCode, scheduledDate: draw.scheduledDate, actualDate: draw.actualDate, scheduledAt: draw.scheduledAt?.toISOString() ?? null, actualAt: draw.actualAt?.toISOString() ?? null };
      const evidence = await insertSourceEvidence(m, manifest.source, this.deploymentMode.dataMode, now);
      const rows = batch.parsedRows as StoredRow[];
      const revisionId = randomUUID();
      const contentHash = this.revisions.computeContentHash({ snapshot, ruleVersionId: rule.id, completeness: manifest.completeness, categories: manifest.categories, entries: rows.map((r) => ({ categoryCode: r.categoryCode, series: r.series, number: r.number })), evidenceIds: [evidence.id] });
      await m.insert(ResultRevisionEntity, {
        id: revisionId, drawId: draw.id, lotteryId: draw.lotteryId, ruleVersionId: rule.id, revisionNo: draw.nextRevisionNo, drawSnapshot: snapshot, basedOnRevisionId: draw.currentRevisionId,
        workflowState: 'DRAFT', publicationKind: manifest.publicationKind, completeness: manifest.completeness, contentHash, reviewedHash: null, reviewedBy: null, reviewedAt: null,
        publishedBy: null, publishedAt: null, correctionReason: manifest.correctionReason, createdBy: admin.user.id, lastEditedBy: admin.user.id, createdAt: now, updatedAt: now, editVersion: 1,
      });
      for (const c of manifest.categories) {
        await m.insert(RevisionCategoryEntity, { revisionId, categoryCode: c.code, ruleVersionId: rule.id, state: c.state, amountMinor: c.amountMinor, sourceReviewedBy: null, sourceReviewedAt: null, sourceReviewNote: null });
      }
      await this.insertEntries(m, revisionId, rows);
      await m.insert(RevisionEvidenceEntity, { revisionId, evidenceId: evidence.id });
      await m.update(DrawEntity, { id: draw.id }, { nextRevisionNo: draw.nextRevisionNo + 1, updatedAt: now, editVersion: draw.editVersion + 1 });
      await m.update(ImportBatchEntity, { id: batch.id }, { status: 'DRAFT_CREATED', createdRevisionId: revisionId, updatedAt: now });
      await this.audit.record(m, { actorId: admin.user.id, action: 'REVISION_DRAFT_CREATED', entityType: 'RESULT_REVISION', entityId: revisionId, afterHash: contentHash, metadata: { importBatchId: batch.id, revisionNo: draw.nextRevisionNo, publicationKind: manifest.publicationKind }, requestId: admin.requestId });
      return revisionId;
    });
    return this.revisions.get(this.dataSource.manager, revisionId);
  }

  private async insertEntries(m: EntityManager, revisionId: string, rows: StoredRow[]): Promise<void> {
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await m.insert(WinningEntryEntity, rows.slice(i, i + CHUNK).map((r) => ({ revisionId, categoryCode: r.categoryCode, series: r.series, number: r.number, sourceRow: r.row })));
    }
  }

  private toPreview(batch: ImportBatchEntity, errorsPage: number, rowsPage: number): ImportPreview {
    const errors = batch.errors as ImportRowError[];
    const rows = batch.parsedRows as StoredRow[];
    const summary = batch.summary as { totalRows: number; validRows: number; errorCount: number; rowsPerCategory: Record<string, number> };
    const slice = <T>(items: T[], page: number) => ({ page, pageSize: PAGE, total: items.length, items: items.slice((page - 1) * PAGE, page * PAGE) });
    return {
      id: batch.id, status: batch.status, dataMode: this.deploymentMode.dataMode, drawId: batch.drawId, ruleVersionId: batch.ruleVersionId,
      manifest: batch.manifest as ImportPreview['manifest'], uploadSha256: batch.uploadSha256, createdAt: batch.createdAt.toISOString(), createdRevisionId: batch.createdRevisionId,
      summary: { totalRows: summary.totalRows ?? 0, validRows: summary.validRows ?? 0, errorCount: summary.errorCount ?? errors.length, rowsPerCategory: summary.rowsPerCategory ?? {} },
      errors: slice(errors, errorsPage),
      rows: slice(rows.map((r) => ({ row: r.row, categoryCode: r.categoryCode, series: r.series, number: r.number })), rowsPage),
    };
  }
}

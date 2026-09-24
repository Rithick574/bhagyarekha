import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  AdminDraw,
  AdminLottery,
  AdminRuleVersion,
  CreateDrawRequest,
  CreateLotteryRequest,
  CreateRuleVersionRequest,
  PatchDrawRequest,
  PatchLotteryRequest,
  SourceInput,
} from '@bhagyarekha/contracts';
import { compileRuleSet } from '@bhagyarekha/domain';
import { DataSource, IsNull, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/api-error.js';
import { canonicalHash } from '../../common/canonical-hash.js';
import { toKolkataDate } from '../../common/clock.js';
import { DrawEntity, LotteryEntity, RuleCategoryEntity, RuleEvidenceEntity, RuleVersionEntity, SourceEvidenceEntity } from '../../database/entities/index.js';
import { AuditService } from '../audit/audit.service.js';
import { IdempotencyService } from '../audit/idempotency.service.js';
import type { AdminContext } from '../auth/admin-context.js';
import { DeploymentModeService } from '../deployment-mode/deployment-mode.service.js';
import { RuleLoaderService } from '../rule-versions/rule-loader.service.js';

export function toAdminLottery(l: LotteryEntity): AdminLottery {
  return { id: l.id, code: l.code, slug: l.slug, name: { en: l.nameEn, ml: l.nameMl }, active: l.active, datasetVersion: l.datasetVersion, editVersion: l.editVersion };
}

export function toAdminDraw(d: DrawEntity, lotteryCode: string): AdminDraw {
  return {
    id: d.id, lotteryId: d.lotteryId, lotteryCode, drawCode: d.drawCode, scheduledDate: d.scheduledDate, actualDate: d.actualDate,
    scheduledAt: d.scheduledAt?.toISOString() ?? null, actualAt: d.actualAt?.toISOString() ?? null, phase: d.phase, visibility: d.visibility,
    suspensionReason: d.suspensionReason, currentRevisionId: d.currentRevisionId, nextRevisionNo: d.nextRevisionNo, editVersion: d.editVersion,
  };
}

/** Inserts a source_evidence row from operator input. Synthetic fixtures are only allowed in demo mode. */
export async function insertSourceEvidence(m: EntityManager, source: SourceInput, dataMode: 'demo' | 'live', now: Date): Promise<SourceEvidenceEntity> {
  if (source.kind === 'SYNTHETIC_FIXTURE' && dataMode !== 'demo') throw new ApiError(400, 'INVALID_INPUT', 'Synthetic evidence is not allowed in live mode', [{ path: 'source.kind', code: 'NOT_ALLOWED_IN_LIVE' }]);
  if (source.kind === 'SYNTHETIC_FIXTURE' && (source.url || source.documentHash)) throw new ApiError(400, 'INVALID_INPUT', 'Synthetic evidence cannot cite a document', [{ path: 'source.url', code: 'NOT_ALLOWED' }]);
  const row = m.create(SourceEvidenceEntity, {
    id: randomUUID(), kind: source.kind, url: source.url, title: source.title, documentHash: source.documentHash,
    reviewedBy: null, reviewedAt: null, reviewNote: source.note, acquiredAt: source.acquiredAt ? new Date(source.acquiredAt) : null, createdAt: now,
  });
  await m.insert(SourceEvidenceEntity, row);
  return row;
}

function assertIstAgreement(dates: { scheduledDate?: string | null; actualDate?: string | null; scheduledAt?: string | null; actualAt?: string | null }): void {
  const fields: { path: string; code: string }[] = [];
  if (dates.scheduledAt && dates.scheduledDate && toKolkataDate(new Date(dates.scheduledAt)) !== dates.scheduledDate) fields.push({ path: 'scheduledAt', code: 'IST_DATE_MISMATCH' });
  if (dates.actualAt && dates.actualDate && toKolkataDate(new Date(dates.actualAt)) !== dates.actualDate) fields.push({ path: 'actualAt', code: 'IST_DATE_MISMATCH' });
  if (dates.actualAt && !dates.actualDate) fields.push({ path: 'actualDate', code: 'REQUIRED_WITH_INSTANT' });
  if (fields.length) throw new ApiError(400, 'INVALID_INPUT', 'Instants must agree with their local date in Asia/Kolkata', fields);
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505';
}

@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    private readonly rules: RuleLoaderService,
    private readonly deploymentMode: DeploymentModeService,
  ) {}

  // ----- lotteries -----------------------------------------------------------

  async listLotteries(): Promise<AdminLottery[]> {
    return (await this.dataSource.manager.find(LotteryEntity, { order: { code: 'ASC' } })).map(toAdminLottery);
  }

  async createLottery(admin: AdminContext, body: CreateLotteryRequest): Promise<AdminLottery> {
    return this.dataSource.transaction(async (m) => {
      const now = new Date();
      const row = m.create(LotteryEntity, { id: randomUUID(), code: body.code, slug: body.slug, nameEn: body.name.en, nameMl: body.name.ml, active: body.active, datasetVersion: '0', archiveCoverage: 'UNKNOWN', createdAt: now, updatedAt: now, editVersion: 1 });
      try {
        await m.insert(LotteryEntity, row);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ApiError(409, 'ALREADY_EXISTS', 'A lottery with this code or slug already exists');
        throw error;
      }
      await this.audit.record(m, { actorId: admin.user.id, action: 'LOTTERY_CREATED', entityType: 'LOTTERY', entityId: row.id, afterHash: canonicalHash(toAdminLottery(row)), metadata: { code: row.code }, requestId: admin.requestId });
      return toAdminLottery(row);
    });
  }

  async patchLottery(admin: AdminContext, id: string, expectedEditVersion: number, body: PatchLotteryRequest): Promise<AdminLottery> {
    return this.dataSource.transaction(async (m) => {
      const row = await m.createQueryBuilder(LotteryEntity, 'l').setLock('pessimistic_write').where('l.id = :id', { id }).getOne();
      if (!row) throw ApiError.notFound('LOTTERY_NOT_FOUND', 'No such lottery');
      if (row.editVersion !== expectedEditVersion) throw ApiError.conflict('REVISION_CONFLICT', 'The lottery was modified by someone else; reload and retry');
      const before = canonicalHash(toAdminLottery(row));
      if (body.name) { row.nameEn = body.name.en; row.nameMl = body.name.ml; }
      if (body.active !== undefined) row.active = body.active;
      if (body.slug) row.slug = body.slug;
      row.editVersion += 1;
      row.updatedAt = new Date();
      try {
        await m.save(LotteryEntity, row);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ApiError(409, 'ALREADY_EXISTS', 'A lottery with this slug already exists');
        throw error;
      }
      await this.audit.record(m, { actorId: admin.user.id, action: 'LOTTERY_UPDATED', entityType: 'LOTTERY', entityId: row.id, beforeHash: before, afterHash: canonicalHash(toAdminLottery(row)), requestId: admin.requestId });
      return toAdminLottery(row);
    });
  }

  // ----- draws ---------------------------------------------------------------

  async listDraws(lotteryId: string | undefined, page: number, pageSize = 50): Promise<{ items: AdminDraw[]; total: number }> {
    const qb = this.dataSource.manager.createQueryBuilder(DrawEntity, 'd');
    if (lotteryId) qb.where('d.lottery_id = :lotteryId', { lotteryId });
    const total = await qb.getCount();
    const draws = await qb.orderBy('COALESCE(d.actual_date, d.scheduled_date)', 'DESC').addOrderBy('d.id', 'DESC').offset((page - 1) * pageSize).limit(pageSize).getMany();
    const lotteries = await this.dataSource.manager.find(LotteryEntity);
    const codeById = new Map(lotteries.map((l) => [l.id, l.code]));
    return { items: draws.map((d) => toAdminDraw(d, codeById.get(d.lotteryId) ?? '?')), total };
  }

  async getDraw(m: EntityManager, id: string): Promise<AdminDraw> {
    const draw = await m.findOne(DrawEntity, { where: { id } });
    if (!draw) throw ApiError.notFound('DRAW_NOT_FOUND', 'No such draw');
    const lottery = await m.findOneOrFail(LotteryEntity, { where: { id: draw.lotteryId } });
    return toAdminDraw(draw, lottery.code);
  }

  async createDraw(admin: AdminContext, body: CreateDrawRequest): Promise<AdminDraw> {
    assertIstAgreement(body);
    return this.dataSource.transaction(async (m) => {
      const lottery = await m.findOne(LotteryEntity, { where: { id: body.lotteryId } });
      if (!lottery) throw ApiError.notFound('LOTTERY_NOT_FOUND', 'No such lottery');
      const now = new Date();
      const row = m.create(DrawEntity, {
        id: randomUUID(), lotteryId: lottery.id, drawCode: body.drawCode, scheduledDate: body.scheduledDate, actualDate: body.actualDate,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, actualAt: body.actualAt ? new Date(body.actualAt) : null,
        phase: body.phase, visibility: 'ACTIVE', suspensionReason: null, currentRevisionId: null, nextRevisionNo: 1, createdAt: now, updatedAt: now, editVersion: 1,
      });
      try {
        await m.insert(DrawEntity, row);
      } catch (error) {
        if (isUniqueViolation(error)) throw new ApiError(409, 'ALREADY_EXISTS', 'This lottery already has a draw with that code');
        throw error;
      }
      await this.audit.record(m, { actorId: admin.user.id, action: 'DRAW_CREATED', entityType: 'DRAW', entityId: row.id, afterHash: canonicalHash(toAdminDraw(row, lottery.code)), metadata: { lotteryCode: lottery.code, drawCode: row.drawCode }, requestId: admin.requestId });
      return toAdminDraw(row, lottery.code);
    });
  }

  async patchDraw(admin: AdminContext, id: string, expectedEditVersion: number, body: PatchDrawRequest): Promise<AdminDraw> {
    return this.dataSource.transaction(async (m) => {
      const row = await m.createQueryBuilder(DrawEntity, 'd').setLock('pessimistic_write').where('d.id = :id', { id }).getOne();
      if (!row) throw ApiError.notFound('DRAW_NOT_FOUND', 'No such draw');
      if (row.editVersion !== expectedEditVersion) throw ApiError.conflict('REVISION_CONFLICT', 'The draw was modified by someone else; reload and retry');
      const lottery = await m.findOneOrFail(LotteryEntity, { where: { id: row.lotteryId } });
      const before = canonicalHash(toAdminDraw(row, lottery.code));
      const touchesDates = ['scheduledDate', 'actualDate', 'scheduledAt', 'actualAt'].some((k) => k in body);
      if (row.currentRevisionId && touchesDates) throw ApiError.conflict('REVISION_CONFLICT', 'Published draws change dates only through a reviewed correction revision');
      if (row.currentRevisionId && body.phase === 'CANCELLED') throw ApiError.conflict('REVISION_CONFLICT', 'A draw with a published result cannot be cancelled; suspend it instead');
      const merged = {
        scheduledDate: body.scheduledDate !== undefined ? body.scheduledDate : row.scheduledDate,
        actualDate: body.actualDate !== undefined ? body.actualDate : row.actualDate,
        scheduledAt: body.scheduledAt !== undefined ? body.scheduledAt : row.scheduledAt?.toISOString() ?? null,
        actualAt: body.actualAt !== undefined ? body.actualAt : row.actualAt?.toISOString() ?? null,
      };
      if (!merged.scheduledDate && !merged.actualDate) throw new ApiError(400, 'INVALID_INPUT', 'A draw needs at least one local date', [{ path: 'scheduledDate', code: 'REQUIRED' }]);
      assertIstAgreement(merged);
      row.scheduledDate = merged.scheduledDate;
      row.actualDate = merged.actualDate;
      row.scheduledAt = merged.scheduledAt ? new Date(merged.scheduledAt) : null;
      row.actualAt = merged.actualAt ? new Date(merged.actualAt) : null;
      if (body.phase) row.phase = body.phase;
      row.editVersion += 1;
      row.updatedAt = new Date();
      await m.save(DrawEntity, row);
      await this.audit.record(m, { actorId: admin.user.id, action: 'DRAW_UPDATED', entityType: 'DRAW', entityId: row.id, beforeHash: before, afterHash: canonicalHash(toAdminDraw(row, lottery.code)), requestId: admin.requestId });
      return toAdminDraw(row, lottery.code);
    });
  }

  // ----- rule versions -------------------------------------------------------

  async toAdminRule(m: EntityManager, id: string): Promise<AdminRuleVersion> {
    const loaded = await this.rules.load(m, id);
    if (!loaded) throw ApiError.notFound('NOT_FOUND', 'No such rule version');
    const compiled = loaded.ruleSet ? compileRuleSet(loaded.ruleSet) : null;
    const v = loaded.version;
    return {
      id: v.id, lotteryId: v.lotteryId, version: v.version, state: v.state, numberLength: v.numberLength, allowedSeries: v.allowedSeries, contentHash: v.contentHash,
      compiles: compiled?.ok === true, compileErrors: compiled && !compiled.ok ? compiled.errors : loaded.ruleSet ? [] : [{ code: 'INVALID_RULE_ROWS', path: '', message: 'Stored rows do not form a valid v1 rule set' }],
      ruleSet: loaded.ruleSet, approvedAt: v.approvedAt?.toISOString() ?? null, revokedAt: v.revokedAt?.toISOString() ?? null, revocationReason: v.revocationReason, editVersion: v.editVersion,
    };
  }

  async listRules(lotteryId: string): Promise<AdminRuleVersion[]> {
    const versions = await this.dataSource.manager.find(RuleVersionEntity, { where: { lotteryId }, order: { version: 'DESC' } });
    const out: AdminRuleVersion[] = [];
    for (const v of versions) out.push(await this.toAdminRule(this.dataSource.manager, v.id));
    return out;
  }

  async createRule(admin: AdminContext, lotteryId: string, body: CreateRuleVersionRequest): Promise<AdminRuleVersion> {
    return this.dataSource.transaction(async (m) => {
      const lottery = await m.createQueryBuilder(LotteryEntity, 'l').setLock('pessimistic_write').where('l.id = :id', { id: lotteryId }).getOne();
      if (!lottery) throw ApiError.notFound('LOTTERY_NOT_FOUND', 'No such lottery');
      if (body.ruleSet.lotteryCode !== lottery.code) throw new ApiError(400, 'INVALID_INPUT', 'ruleSet.lotteryCode must equal the lottery code', [{ path: 'ruleSet.lotteryCode', code: 'MISMATCH' }]);
      const existing = await m.findOne(RuleVersionEntity, { where: { lotteryId, version: body.ruleSet.ruleVersion } });
      if (existing) throw new ApiError(409, 'ALREADY_EXISTS', `Rule version ${body.ruleSet.ruleVersion} already exists for this lottery`);
      const now = new Date();
      const rs = body.ruleSet;
      const id = randomUUID();
      await m.insert(RuleVersionEntity, {
        id, lotteryId, version: rs.ruleVersion, schemaVersion: rs.schemaVersion, engineVersion: rs.engineVersion, numberLength: rs.numberLength,
        allowedFirstDigits: rs.allowedFirstDigits, allowedSeries: rs.allowedSeries, awardPolicy: rs.awardPolicy, state: 'DRAFT', contentHash: canonicalHash(rs),
        approvedBy: null, approvedAt: null, approvalNote: null, revokedBy: null, revokedAt: null, revocationReason: null, createdAt: now, updatedAt: now, editVersion: 1,
      });
      for (const c of rs.categories) {
        await m.insert(RuleCategoryEntity, {
          ruleVersionId: id, code: c.code, labelEn: c.labels.en, labelMl: c.labels.ml, priority: c.priority, metricRole: c.metricRole, matchKind: c.match.kind,
          seriesPolicy: c.match.seriesPolicy, suffixLength: c.match.kind === 'SUFFIX' ? c.match.suffixLength : null, excludedBy: c.excludedBy, expectedEntryCount: c.expectedEntryCount,
        });
      }
      const evidence = await insertSourceEvidence(m, body.source, this.deploymentMode.dataMode, now);
      await m.insert(RuleEvidenceEntity, { ruleVersionId: id, evidenceId: evidence.id });
      await this.audit.record(m, { actorId: admin.user.id, action: 'RULE_VERSION_CREATED', entityType: 'RULE_VERSION', entityId: id, afterHash: canonicalHash(rs), metadata: { lotteryCode: lottery.code, version: rs.ruleVersion }, requestId: admin.requestId });
      return this.toAdminRule(m, id);
    });
  }

  async approveRule(admin: AdminContext, id: string, key: string, note: string): Promise<{ status: number; body: AdminRuleVersion; replayed: boolean }> {
    return this.dataSource.transaction(async (m) =>
      this.idempotency.run(m, { actorId: admin.user.id, operation: 'RULE_APPROVE', key, request: { id, note } }, async () => {
        const version = await m.findOne(RuleVersionEntity, { where: { id } });
        if (!version) throw ApiError.notFound('NOT_FOUND', 'No such rule version');
        await m.createQueryBuilder(LotteryEntity, 'l').setLock('pessimistic_write').where('l.id = :id', { id: version.lotteryId }).getOne();
        const locked = await m.createQueryBuilder(RuleVersionEntity, 'r').setLock('pessimistic_write').where('r.id = :id', { id }).getOneOrFail();
        if (locked.state !== 'DRAFT') throw ApiError.conflict('REVISION_CONFLICT', `Rule version is ${locked.state}; only DRAFT can be approved`);
        const loaded = await this.rules.load(m, id);
        if (!loaded?.compiled) throw new ApiError(400, 'INVALID_INPUT', 'Rule version does not compile and cannot be approved', [{ path: 'ruleSet', code: 'NOT_COMPILABLE' }]);
        const evidenceLinks = await m.find(RuleEvidenceEntity, { where: { ruleVersionId: id } });
        if (evidenceLinks.length === 0) throw new ApiError(400, 'INVALID_INPUT', 'Approval requires reviewed source evidence', [{ path: 'source', code: 'REQUIRED' }]);
        const now = new Date();
        for (const link of evidenceLinks) {
          await m.update(SourceEvidenceEntity, { id: link.evidenceId, reviewedAt: IsNull() }, { reviewedBy: admin.user.id, reviewedAt: now });
        }
        await m.update(RuleVersionEntity, { id }, { state: 'APPROVED', approvedBy: admin.user.id, approvedAt: now, approvalNote: note, updatedAt: now, editVersion: locked.editVersion + 1 });
        await this.audit.record(m, { actorId: admin.user.id, action: 'RULE_VERSION_APPROVED', entityType: 'RULE_VERSION', entityId: id, afterHash: locked.contentHash, metadata: { note }, requestId: admin.requestId });
        return { status: 200, body: await this.toAdminRule(m, id) };
      }),
    );
  }

  /** Revocation locks the lottery first (LLD §5.3 lock order) and bumps dataset_version so statistics/caches notice. */
  async revokeRule(admin: AdminContext, id: string, key: string, reason: string): Promise<{ status: number; body: AdminRuleVersion; replayed: boolean }> {
    return this.dataSource.transaction(async (m) =>
      this.idempotency.run(m, { actorId: admin.user.id, operation: 'RULE_REVOKE', key, request: { id, reason } }, async () => {
        const version = await m.findOne(RuleVersionEntity, { where: { id } });
        if (!version) throw ApiError.notFound('NOT_FOUND', 'No such rule version');
        await m.createQueryBuilder(LotteryEntity, 'l').setLock('pessimistic_write').where('l.id = :id', { id: version.lotteryId }).getOne();
        const locked = await m.createQueryBuilder(RuleVersionEntity, 'r').setLock('pessimistic_write').where('r.id = :id', { id }).getOneOrFail();
        if (locked.state !== 'APPROVED') throw ApiError.conflict('REVISION_CONFLICT', `Rule version is ${locked.state}; only APPROVED can be revoked`);
        const now = new Date();
        await m.update(RuleVersionEntity, { id }, { state: 'REVOKED', revokedBy: admin.user.id, revokedAt: now, revocationReason: reason, updatedAt: now, editVersion: locked.editVersion + 1 });
        await m.createQueryBuilder().update(LotteryEntity).set({ datasetVersion: () => 'dataset_version + 1', updatedAt: now }).where('id = :id', { id: version.lotteryId }).execute();
        await this.audit.record(m, { actorId: admin.user.id, action: 'RULE_VERSION_REVOKED', entityType: 'RULE_VERSION', entityId: id, beforeHash: locked.contentHash, metadata: { reason }, requestId: admin.requestId });
        return { status: 200, body: await this.toAdminRule(m, id) };
      }),
    );
  }
}

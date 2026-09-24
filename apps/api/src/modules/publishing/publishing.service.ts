import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { AdminDraw, AdminRevision, CreateCorrectionRequest, PatchRevisionRequest, PublishResult, PublishRevisionRequest, ReviewRevisionRequest } from '@bhagyarekha/contracts';
import { DataSource, IsNull, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/api-error.js';
import { toKolkataDate } from '../../common/clock.js';
import { ENV, type Env } from '../../config/env.provider.js';
import {
  DrawEntity,
  LotteryEntity,
  ResultRevisionEntity,
  RevisionCategoryEntity,
  RevisionEvidenceEntity,
  RuleVersionEntity,
  SourceEvidenceEntity,
  WinningEntryEntity,
} from '../../database/entities/index.js';
import { insertSourceEvidence, toAdminDraw } from '../admin-catalog/admin-catalog.service.js';
import { AuditService } from '../audit/audit.service.js';
import { IdempotencyService } from '../audit/idempotency.service.js';
import type { AdminContext } from '../auth/admin-context.js';
import { DeploymentModeService } from '../deployment-mode/deployment-mode.service.js';
import { RuleLoaderService } from '../rule-versions/rule-loader.service.js';
import { RevisionReadService } from './revision-read.service.js';

@Injectable()
export class PublishingService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly dataSource: DataSource,
    private readonly reads: RevisionReadService,
    private readonly rules: RuleLoaderService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    private readonly deploymentMode: DeploymentModeService,
  ) {}

  // ----- helpers ---------------------------------------------------------------

  /** Lock order everywhere: lottery → draw → revision (LLD §5.3). */
  private async lockChain(m: EntityManager, revisionId: string): Promise<{ revision: ResultRevisionEntity; draw: DrawEntity; lottery: LotteryEntity }> {
    const peek = await m.findOne(ResultRevisionEntity, { where: { id: revisionId } });
    if (!peek) throw ApiError.notFound('NOT_FOUND', 'No such revision');
    const lottery = await m.createQueryBuilder(LotteryEntity, 'l').setLock('pessimistic_write').where('l.id = :id', { id: peek.lotteryId }).getOneOrFail();
    const draw = await m.createQueryBuilder(DrawEntity, 'd').setLock('pessimistic_write').where('d.id = :id', { id: peek.drawId }).getOneOrFail();
    const revision = await m.createQueryBuilder(ResultRevisionEntity, 'r').setLock('pessimistic_write').where('r.id = :id', { id: revisionId }).getOneOrFail();
    return { revision, draw, lottery };
  }

  private async assertEditVersion(revision: ResultRevisionEntity, expected: number): Promise<void> {
    if (revision.editVersion !== expected) throw ApiError.conflict('REVISION_CONFLICT', `Revision changed (edit version ${revision.editVersion}, expected ${expected}); reload and retry`);
  }

  // ----- DRAFT edits -----------------------------------------------------------

  async patch(admin: AdminContext, id: string, expectedEditVersion: number, body: PatchRevisionRequest): Promise<AdminRevision> {
    await this.dataSource.transaction(async (m) => {
      const { revision } = await this.lockChain(m, id);
      await this.assertEditVersion(revision, expectedEditVersion);
      if (revision.workflowState === 'READY') throw ApiError.conflict('REVISION_CONFLICT', 'Revision is READY; reopen it before editing');
      if (revision.workflowState !== 'DRAFT') throw ApiError.conflict('REVISION_CONFLICT', `Revision is ${revision.workflowState} and immutable`);
      const loaded = await this.rules.load(m, revision.ruleVersionId);
      if (!loaded?.compiled) throw ApiError.unavailable('RESULT_UNAVAILABLE', 'Rule version does not compile');
      const rules = loaded.compiled;
      const before = revision.contentHash;
      const now = new Date();

      if (body.categories) {
        const known = new Set(rules.categoriesByPriority.map((c) => c.spec.code));
        for (const c of body.categories) {
          if (!known.has(c.code)) throw new ApiError(400, 'INVALID_INPUT', `Unknown category ${c.code}`, [{ path: 'categories', code: 'UNKNOWN_CATEGORY' }]);
          await m.update(RevisionCategoryEntity, { revisionId: id, categoryCode: c.code }, { state: c.state, amountMinor: c.amountMinor, sourceReviewedAt: null, sourceReviewedBy: null, sourceReviewNote: null });
        }
      }
      if (body.replaceEntries) {
        for (const block of body.replaceEntries) {
          const spec = rules.categoriesByPriority.find((c) => c.spec.code === block.categoryCode)?.spec;
          if (!spec) throw new ApiError(400, 'INVALID_INPUT', `Unknown category ${block.categoryCode}`, [{ path: 'replaceEntries', code: 'UNKNOWN_CATEGORY' }]);
          const seen = new Set<string>();
          block.entries.forEach((e, i) => {
            const path = `replaceEntries.${block.categoryCode}[${i}]`;
            if (spec.match.kind === 'SUFFIX') {
              if (e.number.length !== spec.match.suffixLength || e.series !== '') throw new ApiError(400, 'INVALID_INPUT', `Suffix entries for ${spec.code} need ${spec.match.suffixLength} digits and no series`, [{ path, code: 'WRONG_LENGTH' }]);
            } else {
              if (e.number.length !== rules.numberLength) throw new ApiError(400, 'INVALID_INPUT', `Full numbers need ${rules.numberLength} digits`, [{ path, code: 'WRONG_LENGTH' }]);
              if (spec.match.seriesPolicy === 'ANY_ALLOWED' ? e.series !== '' : !rules.allowedSeries.has(e.series)) throw new ApiError(400, 'INVALID_INPUT', 'Series not allowed for this category', [{ path, code: 'SERIES_NOT_ALLOWED' }]);
            }
            const key = `${e.series}|${e.number}`;
            if (seen.has(key)) throw new ApiError(400, 'INVALID_INPUT', 'Duplicate entry', [{ path, code: 'DUPLICATE_ENTRY' }]);
            seen.add(key);
          });
          await m.delete(WinningEntryEntity, { revisionId: id, categoryCode: block.categoryCode });
          if (block.entries.length) await m.insert(WinningEntryEntity, block.entries.map((e, i) => ({ revisionId: id, categoryCode: block.categoryCode, series: e.series, number: e.number, sourceRow: i + 1 })));
        }
      }
      if (body.completeness) revision.completeness = body.completeness;
      if (body.correctionReason !== undefined) revision.correctionReason = body.correctionReason;
      if (body.drawSnapshot) {
        const next = { ...revision.drawSnapshot, ...body.drawSnapshot };
        if (next.scheduledAt && next.scheduledDate && toKolkataDate(new Date(next.scheduledAt)) !== next.scheduledDate) throw new ApiError(400, 'INVALID_INPUT', 'scheduledAt must agree with scheduledDate in IST', [{ path: 'drawSnapshot.scheduledAt', code: 'IST_DATE_MISMATCH' }]);
        if (next.actualAt && next.actualDate && toKolkataDate(new Date(next.actualAt)) !== next.actualDate) throw new ApiError(400, 'INVALID_INPUT', 'actualAt must agree with actualDate in IST', [{ path: 'drawSnapshot.actualAt', code: 'IST_DATE_MISMATCH' }]);
        if (!next.scheduledDate && !next.actualDate) throw new ApiError(400, 'INVALID_INPUT', 'A draw needs at least one local date', [{ path: 'drawSnapshot', code: 'REQUIRED' }]);
        revision.drawSnapshot = next;
      }
      if (revision.publicationKind === 'CORRECTION' && !revision.correctionReason) throw new ApiError(400, 'INVALID_INPUT', 'A correction needs a reason', [{ path: 'correctionReason', code: 'REQUIRED' }]);

      revision.contentHash = await this.reads.hashFromDatabase(m, revision);
      revision.reviewedHash = null;
      revision.reviewedAt = null;
      revision.reviewedBy = null;
      revision.lastEditedBy = admin.user.id;
      revision.editVersion += 1;
      revision.updatedAt = now;
      await m.save(ResultRevisionEntity, revision);
      await this.audit.record(m, { actorId: admin.user.id, action: 'REVISION_EDITED', entityType: 'RESULT_REVISION', entityId: id, beforeHash: before, afterHash: revision.contentHash, requestId: admin.requestId });
    });
    return this.reads.get(this.dataSource.manager, id);
  }

  async reopen(admin: AdminContext, id: string, expectedEditVersion: number): Promise<AdminRevision> {
    await this.dataSource.transaction(async (m) => {
      const { revision } = await this.lockChain(m, id);
      await this.assertEditVersion(revision, expectedEditVersion);
      if (revision.workflowState !== 'READY') throw ApiError.conflict('REVISION_CONFLICT', `Only READY revisions can be reopened (state ${revision.workflowState})`);
      await m.update(ResultRevisionEntity, { id }, { workflowState: 'DRAFT', reviewedHash: null, reviewedAt: null, reviewedBy: null, lastEditedBy: admin.user.id, editVersion: revision.editVersion + 1, updatedAt: new Date() });
      await this.audit.record(m, { actorId: admin.user.id, action: 'REVISION_REOPENED', entityType: 'RESULT_REVISION', entityId: id, beforeHash: revision.contentHash, requestId: admin.requestId });
    });
    return this.reads.get(this.dataSource.manager, id);
  }

  // ----- review ------------------------------------------------------------------

  async review(admin: AdminContext, id: string, expectedEditVersion: number, body: ReviewRevisionRequest): Promise<AdminRevision> {
    await this.dataSource.transaction(async (m) => {
      const { revision } = await this.lockChain(m, id);
      await this.assertEditVersion(revision, expectedEditVersion);
      if (revision.workflowState !== 'DRAFT') throw ApiError.conflict('REVISION_CONFLICT', `Only DRAFT revisions can be reviewed (state ${revision.workflowState})`);
      const recomputed = await this.reads.hashFromDatabase(m, revision);
      if (recomputed !== revision.contentHash) throw ApiError.unavailable('RESULT_UNAVAILABLE', 'Stored content hash does not match the rows; refusing to review');

      const lastEditor = revision.lastEditedBy ?? revision.createdBy;
      if (lastEditor === admin.user.id) {
        if (!this.env.ALLOW_SELF_REVIEW) throw new ApiError(403, 'FORBIDDEN', 'The last editor cannot review their own revision (ALLOW_SELF_REVIEW is off)');
        if (!body.confirmSelfReview) throw new ApiError(400, 'INVALID_INPUT', 'Self-review must be explicitly confirmed', [{ path: 'confirmSelfReview', code: 'REQUIRED' }]);
      }
      await this.assertPublishable(m, revision);

      const now = new Date();
      const links = await m.find(RevisionEvidenceEntity, { where: { revisionId: id } });
      for (const link of links) await m.update(SourceEvidenceEntity, { id: link.evidenceId, reviewedAt: IsNull() }, { reviewedBy: admin.user.id, reviewedAt: now, ...(body.note ? { reviewNote: body.note } : {}) });
      await m.update(RevisionCategoryEntity, { revisionId: id, state: 'COMPLETE' }, { sourceReviewedBy: admin.user.id, sourceReviewedAt: now });
      await m.update(ResultRevisionEntity, { id }, { workflowState: 'READY', reviewedHash: revision.contentHash, reviewedBy: admin.user.id, reviewedAt: now, editVersion: revision.editVersion + 1, updatedAt: now });
      await this.audit.record(m, { actorId: admin.user.id, action: 'REVISION_REVIEWED', entityType: 'RESULT_REVISION', entityId: id, afterHash: revision.contentHash, metadata: { selfReview: lastEditor === admin.user.id, note: body.note }, requestId: admin.requestId });
    });
    return this.reads.get(this.dataSource.manager, id);
  }

  /** Invariants shared by review and publish (LLD §5.3): manifests, counts, amounts, completeness, evidence, rules. */
  private async assertPublishable(m: EntityManager, revision: ResultRevisionEntity): Promise<void> {
    const loaded = await this.rules.load(m, revision.ruleVersionId);
    if (!loaded || loaded.version.state !== 'APPROVED' || !loaded.compiled) throw new ApiError(400, 'INVALID_INPUT', 'Rule version must be APPROVED and compilable', [{ path: 'ruleVersionId', code: 'RULE_NOT_APPROVED' }]);
    const manifests = await m.find(RevisionCategoryEntity, { where: { revisionId: revision.id } });
    const counts = new Map((await m.createQueryBuilder(WinningEntryEntity, 'w').select('w.category_code', 'code').addSelect('COUNT(*)', 'n').where('w.revision_id = :id', { id: revision.id }).groupBy('w.category_code').getRawMany<{ code: string; n: string }>()).map((r) => [r.code, Number(r.n)]));
    const fields: { path: string; code: string }[] = [];
    for (const { spec } of loaded.compiled.categoriesByPriority) {
      const man = manifests.find((x) => x.categoryCode === spec.code);
      if (!man) { fields.push({ path: `categories.${spec.code}`, code: 'MANIFEST_MISSING' }); continue; }
      const n = counts.get(spec.code) ?? 0;
      if (man.state === 'COMPLETE' && n === 0) fields.push({ path: `categories.${spec.code}`, code: 'COMPLETE_WITHOUT_ROWS' });
      if (man.state === 'COMPLETE' && man.amountMinor === null) fields.push({ path: `categories.${spec.code}.amountMinor`, code: 'AMOUNT_REQUIRED' });
      if (man.state === 'COMPLETE' && spec.expectedEntryCount !== null && n !== spec.expectedEntryCount) fields.push({ path: `categories.${spec.code}`, code: 'EXPECTED_COUNT_MISMATCH' });
      if (man.state === 'MISSING' && n > 0) fields.push({ path: `categories.${spec.code}`, code: 'ROWS_FOR_MISSING_CATEGORY' });
    }
    if (revision.completeness === 'COMPLETE' && manifests.some((x) => x.state !== 'COMPLETE')) fields.push({ path: 'completeness', code: 'INCOMPLETE_CATEGORY' });
    if (revision.publicationKind === 'CORRECTION' && !revision.correctionReason) fields.push({ path: 'correctionReason', code: 'REQUIRED' });
    if ((await m.count(RevisionEvidenceEntity, { where: { revisionId: revision.id } })) === 0) fields.push({ path: 'evidence', code: 'REQUIRED' });
    if (fields.length) throw new ApiError(400, 'INVALID_INPUT', 'Revision does not satisfy the publication invariants', fields);
  }

  // ----- publish ------------------------------------------------------------------

  async publish(admin: AdminContext, id: string, key: string, body: PublishRevisionRequest): Promise<{ status: number; body: PublishResult; replayed: boolean }> {
    const out = await this.dataSource.transaction(async (m) =>
      this.idempotency.run(m, { actorId: admin.user.id, operation: 'REVISION_PUBLISH', key, request: { id, ...body } }, async () => {
        const { revision, draw, lottery } = await this.lockChain(m, id);
        await this.assertEditVersion(revision, body.expectedEditVersion);
        if (draw.currentRevisionId !== body.expectedCurrentRevisionId || draw.currentRevisionId !== revision.basedOnRevisionId) {
          throw ApiError.conflict('REVISION_CONFLICT', 'The draw has a different current revision than this draft was based on; rebase, re-review and retry');
        }
        if (revision.workflowState !== 'READY') throw ApiError.conflict('REVISION_CONFLICT', `Only READY revisions can be published (state ${revision.workflowState})`);
        if (revision.reviewedHash !== revision.contentHash || (await this.reads.hashFromDatabase(m, revision)) !== revision.contentHash) throw ApiError.conflict('REVISION_CONFLICT', 'Reviewed content no longer matches; review again');
        await this.assertPublishable(m, revision);
        if (draw.visibility === 'SUSPENDED' && !body.reactivate) throw ApiError.conflict('REVISION_CONFLICT', 'The draw is suspended; set reactivate=true to publish and restore visibility');
        if (draw.phase === 'CANCELLED') throw ApiError.conflict('REVISION_CONFLICT', 'A cancelled draw cannot receive a published result');
        if (revision.basedOnRevisionId) {
          const prev = await m.findOneOrFail(ResultRevisionEntity, { where: { id: revision.basedOnRevisionId } });
          if (prev.completeness === 'COMPLETE' && revision.completeness === 'PARTIAL' && revision.publicationKind !== 'CORRECTION') throw ApiError.conflict('REVISION_CONFLICT', 'Downgrading completeness requires a CORRECTION with a reason');
        }

        const now = new Date();
        const superseded = draw.currentRevisionId;
        if (superseded) await m.update(ResultRevisionEntity, { id: superseded, workflowState: 'PUBLISHED' }, { workflowState: 'SUPERSEDED', updatedAt: now });
        await m.update(ResultRevisionEntity, { id }, { workflowState: 'PUBLISHED', publishedBy: admin.user.id, publishedAt: now, updatedAt: now, editVersion: revision.editVersion + 1 });
        const snap = revision.drawSnapshot;
        await m.update(DrawEntity, { id: draw.id }, {
          currentRevisionId: id, scheduledDate: snap.scheduledDate, actualDate: snap.actualDate, scheduledAt: snap.scheduledAt ? new Date(snap.scheduledAt) : null, actualAt: snap.actualAt ? new Date(snap.actualAt) : null,
          // A published result implies the draw took place; dates themselves are never invented.
          phase: 'HELD', visibility: body.reactivate ? 'ACTIVE' : draw.visibility, suspensionReason: body.reactivate ? null : draw.suspensionReason,
          editVersion: draw.editVersion + 1, updatedAt: now,
        });
        const bumped = await m.createQueryBuilder().update(LotteryEntity).set({ datasetVersion: () => 'dataset_version + 1', updatedAt: now }).where('id = :id', { id: lottery.id }).returning('dataset_version').execute();
        const datasetVersion = String((bumped.raw as { dataset_version: string }[])[0]?.dataset_version ?? '');
        const publicationId = randomUUID();
        await this.audit.record(m, {
          actorId: admin.user.id, action: 'REVISION_PUBLISHED', entityType: 'RESULT_REVISION', entityId: id, beforeHash: superseded ? (await m.findOneOrFail(ResultRevisionEntity, { where: { id: superseded } })).contentHash : null, afterHash: revision.contentHash,
          metadata: { publicationId, drawId: draw.id, supersededRevisionId: superseded, datasetVersion, publicationKind: revision.publicationKind, selfReview: revision.reviewedBy === (revision.lastEditedBy ?? revision.createdBy), reactivated: body.reactivate },
          requestId: admin.requestId,
        });
        await this.audit.record(m, { actorId: admin.user.id, action: 'DRAW_RESULT_PUBLISHED', entityType: 'DRAW', entityId: draw.id, afterHash: revision.contentHash, metadata: { revisionId: id, revisionNo: revision.revisionNo, publicationId }, requestId: admin.requestId });
        const result: PublishResult = { publicationId, revisionId: id, drawId: draw.id, supersededRevisionId: superseded, datasetVersion, publishedAt: now.toISOString(), replayed: false, isStillCurrent: true };
        return { status: 200, body: result };
      }),
    );
    if (out.replayed) {
      const draw = await this.dataSource.manager.findOne(DrawEntity, { where: { id: out.body.drawId } });
      return { ...out, body: { ...out.body, replayed: true, isStillCurrent: draw?.currentRevisionId === out.body.revisionId } };
    }
    return out;
  }

  // ----- suspend / resume ---------------------------------------------------------

  async setVisibility(admin: AdminContext, drawId: string, key: string, action: 'SUSPEND' | 'RESUME', reason: string, expectedEditVersion: number): Promise<{ status: number; body: AdminDraw; replayed: boolean }> {
    return this.dataSource.transaction(async (m) =>
      this.idempotency.run(m, { actorId: admin.user.id, operation: `DRAW_${action}`, key, request: { drawId, reason, expectedEditVersion } }, async () => {
        const peek = await m.findOne(DrawEntity, { where: { id: drawId } });
        if (!peek) throw ApiError.notFound('DRAW_NOT_FOUND', 'No such draw');
        const lottery = await m.createQueryBuilder(LotteryEntity, 'l').setLock('pessimistic_write').where('l.id = :id', { id: peek.lotteryId }).getOneOrFail();
        const draw = await m.createQueryBuilder(DrawEntity, 'd').setLock('pessimistic_write').where('d.id = :id', { id: drawId }).getOneOrFail();
        if (draw.editVersion !== expectedEditVersion) throw ApiError.conflict('REVISION_CONFLICT', 'The draw changed; reload and retry');
        const target = action === 'SUSPEND' ? 'SUSPENDED' : 'ACTIVE';
        if (draw.visibility === target) throw ApiError.conflict('REVISION_CONFLICT', `Draw is already ${target}`);
        const now = new Date();
        await m.update(DrawEntity, { id: drawId }, { visibility: target, suspensionReason: action === 'SUSPEND' ? reason : null, editVersion: draw.editVersion + 1, updatedAt: now });
        await m.createQueryBuilder().update(LotteryEntity).set({ datasetVersion: () => 'dataset_version + 1', updatedAt: now }).where('id = :id', { id: lottery.id }).execute();
        await this.audit.record(m, { actorId: admin.user.id, action: action === 'SUSPEND' ? 'DRAW_SUSPENDED' : 'DRAW_RESUMED', entityType: 'DRAW', entityId: drawId, metadata: { reason, currentRevisionId: draw.currentRevisionId }, requestId: admin.requestId });
        const updated = await m.findOneOrFail(DrawEntity, { where: { id: drawId } });
        return { status: 200, body: toAdminDraw(updated, lottery.code) };
      }),
    );
  }

  // ----- corrections --------------------------------------------------------------

  /** Clones the current revision into a new DRAFT of kind CORRECTION (LLD §5.4). Nothing public changes until it is reviewed and published. */
  async createCorrection(admin: AdminContext, drawId: string, body: CreateCorrectionRequest): Promise<AdminRevision> {
    const revisionId = await this.dataSource.transaction(async (m) => {
      const peek = await m.findOne(DrawEntity, { where: { id: drawId } });
      if (!peek) throw ApiError.notFound('DRAW_NOT_FOUND', 'No such draw');
      await m.createQueryBuilder(LotteryEntity, 'l').setLock('pessimistic_write').where('l.id = :id', { id: peek.lotteryId }).getOne();
      const draw = await m.createQueryBuilder(DrawEntity, 'd').setLock('pessimistic_write').where('d.id = :id', { id: drawId }).getOneOrFail();
      if (!draw.currentRevisionId) throw ApiError.conflict('REVISION_CONFLICT', 'The draw has no published result to correct; import an INITIAL result instead');
      const openDraft = await m.count(ResultRevisionEntity, { where: [{ drawId, workflowState: 'DRAFT' }, { drawId, workflowState: 'READY' }] });
      if (openDraft > 0) throw ApiError.conflict('REVISION_CONFLICT', 'This draw already has an open draft; finish or discard it first');
      const current = await m.findOneOrFail(ResultRevisionEntity, { where: { id: draw.currentRevisionId } });
      const rule = await m.findOneOrFail(RuleVersionEntity, { where: { id: current.ruleVersionId } });
      const now = new Date();
      const id = randomUUID();
      const evidence = await insertSourceEvidence(m, body.source, this.deploymentMode.dataMode, now);
      await m.insert(ResultRevisionEntity, {
        id, drawId, lotteryId: draw.lotteryId, ruleVersionId: rule.id, revisionNo: draw.nextRevisionNo, drawSnapshot: current.drawSnapshot, basedOnRevisionId: current.id, workflowState: 'DRAFT',
        publicationKind: 'CORRECTION', completeness: current.completeness, contentHash: current.contentHash, reviewedHash: null, reviewedBy: null, reviewedAt: null, publishedBy: null, publishedAt: null,
        correctionReason: body.reason, createdBy: admin.user.id, lastEditedBy: admin.user.id, createdAt: now, updatedAt: now, editVersion: 1,
      });
      const cats = await m.find(RevisionCategoryEntity, { where: { revisionId: current.id } });
      for (const c of cats) await m.insert(RevisionCategoryEntity, { revisionId: id, categoryCode: c.categoryCode, ruleVersionId: rule.id, state: c.state, amountMinor: c.amountMinor, sourceReviewedBy: null, sourceReviewedAt: null, sourceReviewNote: null });
      const entries = await m.find(WinningEntryEntity, { where: { revisionId: current.id }, order: { id: 'ASC' } });
      for (let i = 0; i < entries.length; i += 500) await m.insert(WinningEntryEntity, entries.slice(i, i + 500).map((e) => ({ revisionId: id, categoryCode: e.categoryCode, series: e.series, number: e.number, sourceRow: e.sourceRow })));
      const oldEvidence = await m.find(RevisionEvidenceEntity, { where: { revisionId: current.id } });
      for (const e of oldEvidence) await m.insert(RevisionEvidenceEntity, { revisionId: id, evidenceId: e.evidenceId });
      await m.insert(RevisionEvidenceEntity, { revisionId: id, evidenceId: evidence.id });
      const rev = await m.findOneOrFail(ResultRevisionEntity, { where: { id } });
      rev.contentHash = await this.reads.hashFromDatabase(m, rev);
      await m.save(ResultRevisionEntity, rev);
      await m.update(DrawEntity, { id: drawId }, { nextRevisionNo: draw.nextRevisionNo + 1, editVersion: draw.editVersion + 1, updatedAt: now });
      await this.audit.record(m, { actorId: admin.user.id, action: 'CORRECTION_DRAFT_CREATED', entityType: 'RESULT_REVISION', entityId: id, beforeHash: current.contentHash, afterHash: rev.contentHash, metadata: { basedOnRevisionId: current.id, reason: body.reason }, requestId: admin.requestId });
      return id;
    });
    return this.reads.get(this.dataSource.manager, revisionId);
  }
}

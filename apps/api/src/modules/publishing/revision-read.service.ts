import { Injectable } from '@nestjs/common';
import type { AdminRevision } from '@bhagyarekha/contracts';
import { In, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/api-error.js';
import { canonicalHash } from '../../common/canonical-hash.js';
import {
  DrawEntity,
  LotteryEntity,
  ResultRevisionEntity,
  RevisionCategoryEntity,
  RevisionEvidenceEntity,
  RuleCategoryEntity,
  RuleVersionEntity,
  SourceEvidenceEntity,
  WinningEntryEntity,
  type DrawSnapshot,
} from '../../database/entities/index.js';
import { DeploymentModeService } from '../deployment-mode/deployment-mode.service.js';

export interface ContentHashInput {
  snapshot: DrawSnapshot;
  ruleVersionId: string;
  completeness: string;
  categories: { code: string; state: string; amountMinor: string | null }[];
  entries: { categoryCode: string; series: string; number: string }[];
  evidenceIds: string[];
}

@Injectable()
export class RevisionReadService {
  constructor(private readonly deploymentMode: DeploymentModeService) {}

  /** Canonical hash of reviewable content: sorted categories/entries/evidence, no volatile timestamps (LLD §5.2). */
  computeContentHash(input: ContentHashInput): string {
    const categories = [...input.categories].map((c) => ({ code: c.code, state: c.state, amountMinor: c.amountMinor })).sort((a, b) => a.code.localeCompare(b.code));
    const entries = [...input.entries].sort((a, b) => `${a.categoryCode}|${a.series}|${a.number}`.localeCompare(`${b.categoryCode}|${b.series}|${b.number}`));
    return canonicalHash({ snapshot: input.snapshot, ruleVersionId: input.ruleVersionId, completeness: input.completeness, categories, entries, evidenceIds: [...input.evidenceIds].sort() });
  }

  /** Recomputes the hash from the database rows of a revision (used after edits and before review/publish). */
  async hashFromDatabase(m: EntityManager, revision: ResultRevisionEntity): Promise<string> {
    const categories = await m.find(RevisionCategoryEntity, { where: { revisionId: revision.id } });
    const entries = await m.find(WinningEntryEntity, { where: { revisionId: revision.id } });
    const evidence = await m.find(RevisionEvidenceEntity, { where: { revisionId: revision.id } });
    return this.computeContentHash({
      snapshot: revision.drawSnapshot, ruleVersionId: revision.ruleVersionId, completeness: revision.completeness,
      categories: categories.map((c) => ({ code: c.categoryCode, state: c.state, amountMinor: c.amountMinor })),
      entries: entries.map((e) => ({ categoryCode: e.categoryCode, series: e.series, number: e.number })),
      evidenceIds: evidence.map((e) => e.evidenceId),
    });
  }

  async get(m: EntityManager, id: string): Promise<AdminRevision> {
    const rev = await m.findOne(ResultRevisionEntity, { where: { id } });
    if (!rev) throw ApiError.notFound('NOT_FOUND', 'No such revision');
    const draw = await m.findOneOrFail(DrawEntity, { where: { id: rev.drawId } });
    const lottery = await m.findOneOrFail(LotteryEntity, { where: { id: rev.lotteryId } });
    const rule = await m.findOneOrFail(RuleVersionEntity, { where: { id: rev.ruleVersionId } });
    const ruleCategories = await m.find(RuleCategoryEntity, { where: { ruleVersionId: rev.ruleVersionId }, order: { priority: 'ASC' } });
    const manifests = await m.find(RevisionCategoryEntity, { where: { revisionId: rev.id } });
    const counts = await m.createQueryBuilder(WinningEntryEntity, 'w').select('w.category_code', 'code').addSelect('COUNT(*)', 'n').where('w.revision_id = :id', { id: rev.id }).groupBy('w.category_code').getRawMany<{ code: string; n: string }>();
    const countByCode = new Map(counts.map((c) => [c.code, Number(c.n)]));
    const links = await m.find(RevisionEvidenceEntity, { where: { revisionId: rev.id } });
    const evidence = links.length ? await m.find(SourceEvidenceEntity, { where: { id: In(links.map((l) => l.evidenceId)) }, order: { createdAt: 'ASC' } }) : [];
    return {
      id: rev.id, drawId: rev.drawId, lotteryId: rev.lotteryId, lotteryCode: lottery.code, drawCode: draw.drawCode, ruleVersionId: rev.ruleVersionId, ruleState: rule.state,
      revisionNo: rev.revisionNo, workflowState: rev.workflowState, publicationKind: rev.publicationKind, completeness: rev.completeness, basedOnRevisionId: rev.basedOnRevisionId,
      correctionReason: rev.correctionReason, drawSnapshot: rev.drawSnapshot, contentHash: rev.contentHash, reviewedHash: rev.reviewedHash, reviewedAt: rev.reviewedAt?.toISOString() ?? null,
      reviewedBy: rev.reviewedBy, publishedAt: rev.publishedAt?.toISOString() ?? null, publishedBy: rev.publishedBy, createdBy: rev.createdBy, editVersion: rev.editVersion,
      isCurrent: draw.currentRevisionId === rev.id, drawCurrentRevisionId: draw.currentRevisionId, drawEditVersion: draw.editVersion, drawVisibility: draw.visibility,
      categories: ruleCategories.map((rc) => {
        const man = manifests.find((x) => x.categoryCode === rc.code);
        return { code: rc.code, label: { en: rc.labelEn, ml: rc.labelMl }, priority: rc.priority, state: man?.state ?? 'MISSING', amountMinor: man?.amountMinor ?? null, expectedEntryCount: rc.expectedEntryCount, entryCount: countByCode.get(rc.code) ?? 0, sourceReviewedAt: man?.sourceReviewedAt?.toISOString() ?? null };
      }),
      evidence: evidence.map((e) => ({ id: e.id, kind: e.kind, title: e.title, url: e.url, documentHash: e.documentHash, reviewedAt: e.reviewedAt?.toISOString() ?? null, reviewedBy: e.reviewedBy, note: e.reviewNote })),
      dataMode: this.deploymentMode.dataMode,
    };
  }

  async list(m: EntityManager, filter: { state?: string; drawId?: string; page: number }, pageSize = 50) {
    const qb = m.createQueryBuilder(ResultRevisionEntity, 'r');
    if (filter.state) qb.andWhere('r.workflow_state = :state', { state: filter.state });
    if (filter.drawId) qb.andWhere('r.draw_id = :drawId', { drawId: filter.drawId });
    const revisions = await qb.orderBy('r.updated_at', 'DESC').offset((filter.page - 1) * pageSize).limit(pageSize).getMany();
    if (revisions.length === 0) return [];
    const draws = await m.find(DrawEntity, { where: { id: In([...new Set(revisions.map((r) => r.drawId))]) } });
    const lotteries = await m.find(LotteryEntity, { where: { id: In([...new Set(revisions.map((r) => r.lotteryId))]) } });
    const drawById = new Map(draws.map((d) => [d.id, d]));
    const lotteryById = new Map(lotteries.map((l) => [l.id, l]));
    return revisions.map((r) => ({
      id: r.id, drawId: r.drawId, drawCode: drawById.get(r.drawId)?.drawCode ?? '?', lotteryCode: lotteryById.get(r.lotteryId)?.code ?? '?', revisionNo: r.revisionNo,
      workflowState: r.workflowState, publicationKind: r.publicationKind, completeness: r.completeness, updatedAt: r.updatedAt.toISOString(), isCurrent: drawById.get(r.drawId)?.currentRevisionId === r.id,
    }));
  }

  async entries(m: EntityManager, revisionId: string, categoryCode: string, page: number, pageSize = 100) {
    const [items, total] = await m.findAndCount(WinningEntryEntity, { where: { revisionId, categoryCode }, order: { sourceRow: 'ASC', id: 'ASC' }, skip: (page - 1) * pageSize, take: pageSize });
    return { categoryCode, page, pageSize, total, items: items.map((e) => ({ series: e.series, number: e.number, sourceRow: e.sourceRow })) };
  }
}

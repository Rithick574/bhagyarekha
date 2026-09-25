import { Injectable } from '@nestjs/common';
import { type EntityManager, In } from 'typeorm';
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
} from '../../database/entities/index.js';
import type { DrawSummaryRows, FirstPrizeRows } from './mapping.js';

export interface DrawPageFilter {
  lotteryId?: string;
  from?: string;
  to?: string;
  drawCode?: string;
  page: number;
  pageSize: number;
}

const DISPLAY_DATE = 'COALESCE(d.actual_date, d.scheduled_date)';

/**
 * Persistence for public reads. Every method takes the caller's EntityManager so
 * a service can run several reads inside ONE repeatable-read transaction and
 * return a single consistent snapshot (INV-05).
 */
@Injectable()
export class ResultsRepository {
  async findLotteries(m: EntityManager, activeOnly: boolean | undefined): Promise<LotteryEntity[]> {
    return m.find(LotteryEntity, { where: activeOnly === undefined ? {} : { active: activeOnly }, order: { nameEn: 'ASC' } });
  }

  async findDrawById(m: EntityManager, drawId: string): Promise<DrawEntity | null> {
    return m.findOne(DrawEntity, { where: { id: drawId } });
  }

  async findDrawsPage(m: EntityManager, filter: DrawPageFilter): Promise<{ draws: DrawEntity[]; total: number }> {
    const qb = m.createQueryBuilder(DrawEntity, 'd');
    if (filter.lotteryId) qb.andWhere('d.lottery_id = :lotteryId', { lotteryId: filter.lotteryId });
    if (filter.from) qb.andWhere(`${DISPLAY_DATE} >= :from`, { from: filter.from });
    if (filter.to) qb.andWhere(`${DISPLAY_DATE} <= :to`, { to: filter.to });
    if (filter.drawCode) qb.andWhere('LOWER(d.draw_code) = LOWER(:drawCode)', { drawCode: filter.drawCode });
    const total = await qb.getCount();
    const draws = await qb
      .orderBy(DISPLAY_DATE, 'DESC')
      .addOrderBy('d.id', 'DESC')
      .offset((filter.page - 1) * filter.pageSize)
      .limit(filter.pageSize)
      .getMany();
    return { draws, total };
  }

  /** Newest draw (by display date) with an ACTIVE current revision. Suspended and cancelled draws are excluded. */
  async findLatestPublishedDraw(m: EntityManager, lotteryId: string | undefined): Promise<DrawEntity | null> {
    const qb = m
      .createQueryBuilder(DrawEntity, 'd')
      .where('d.current_revision_id IS NOT NULL')
      .andWhere(`d.visibility = 'ACTIVE'`)
      .andWhere(`d.phase <> 'CANCELLED'`);
    if (lotteryId) qb.andWhere('d.lottery_id = :lotteryId', { lotteryId });
    return qb.orderBy(DISPLAY_DATE, 'DESC').addOrderBy('d.id', 'DESC').limit(1).getOne();
  }

  /** Earliest non-cancelled draw on or after `today` (IST) without a published revision. */
  async findPendingDraw(m: EntityManager, lotteryId: string | undefined, today: string): Promise<DrawEntity | null> {
    const qb = m
      .createQueryBuilder(DrawEntity, 'd')
      .where('d.current_revision_id IS NULL')
      .andWhere(`d.phase <> 'CANCELLED'`)
      .andWhere(`${DISPLAY_DATE} >= :today`, { today });
    if (lotteryId) qb.andWhere('d.lottery_id = :lotteryId', { lotteryId });
    return qb.orderBy(DISPLAY_DATE, 'ASC').addOrderBy('d.id', 'ASC').limit(1).getOne();
  }

  /** Loads everything a DrawSummary needs for a batch of draws from the same snapshot. */
  async loadDrawSummaryRows(m: EntityManager, draws: DrawEntity[]): Promise<DrawSummaryRows[]> {
    if (draws.length === 0) return [];
    const lotteryIds = [...new Set(draws.map((d) => d.lotteryId))];
    const revisionIds = draws.map((d) => d.currentRevisionId).filter((id): id is string => id !== null);
    const drawIds = draws.map((d) => d.id);

    // Sequential on purpose: all reads share the caller's transaction connection.
    const lotteries = await m.find(LotteryEntity, { where: { id: In(lotteryIds) } });
    const revisions = revisionIds.length ? await m.find(ResultRevisionEntity, { where: { id: In(revisionIds) } }) : [];
    const supersededRows = await m
      .createQueryBuilder(ResultRevisionEntity, 'r')
      .select('r.draw_id', 'drawId')
      .addSelect('COUNT(*)', 'count')
      .where('r.draw_id IN (:...drawIds)', { drawIds })
      .andWhere(`r.workflow_state = 'SUPERSEDED'`)
      .groupBy('r.draw_id')
      .getRawMany<{ drawId: string; count: string }>();

    const firstPrizeByRevision = await this.loadFirstPrizeRows(m, revisions);
    const lotteryById = new Map(lotteries.map((l) => [l.id, l]));
    const revisionById = new Map(revisions.map((r) => [r.id, r]));
    const supersededByDraw = new Map(supersededRows.map((r) => [r.drawId, Number(r.count)]));

    return draws.map((draw) => {
      const lottery = lotteryById.get(draw.lotteryId);
      if (!lottery) throw new Error(`Draw ${draw.id} references missing lottery ${draw.lotteryId}`);
      const currentRevision = draw.currentRevisionId ? (revisionById.get(draw.currentRevisionId) ?? null) : null;
      return {
        draw,
        lottery,
        currentRevision,
        firstPrize: currentRevision ? (firstPrizeByRevision.get(currentRevision.id) ?? null) : null,
        supersededRevisionCount: supersededByDraw.get(draw.id) ?? 0,
      };
    });
  }

  private async loadFirstPrizeRows(m: EntityManager, revisions: ResultRevisionEntity[]): Promise<Map<string, FirstPrizeRows>> {
    const result = new Map<string, FirstPrizeRows>();
    if (revisions.length === 0) return result;
    const ruleVersionIds = [...new Set(revisions.map((r) => r.ruleVersionId))];
    const firstPrizeCategories = await m.find(RuleCategoryEntity, { where: { ruleVersionId: In(ruleVersionIds), metricRole: 'FIRST_PRIZE' } });
    const categoryByRule = new Map(firstPrizeCategories.map((c) => [c.ruleVersionId, c]));

    const pairs = revisions
      .map((r) => ({ revision: r, category: categoryByRule.get(r.ruleVersionId) }))
      .filter((p): p is { revision: ResultRevisionEntity; category: RuleCategoryEntity } => p.category !== undefined);
    if (pairs.length === 0) return result;

    const revisionIds = pairs.map((p) => p.revision.id);
    const revisionCategories = await m.find(RevisionCategoryEntity, { where: { revisionId: In(revisionIds) } });
    const entries = await m.find(WinningEntryEntity, { where: { revisionId: In(revisionIds) }, order: { id: 'ASC' } });

    for (const { revision, category } of pairs) {
      const revisionCategory = revisionCategories.find((rc) => rc.revisionId === revision.id && rc.categoryCode === category.code);
      if (!revisionCategory) continue;
      result.set(revision.id, {
        ruleCategory: category,
        revisionCategory,
        entries: entries.filter((e) => e.revisionId === revision.id && e.categoryCode === category.code),
      });
    }
    return result;
  }

  async findRuleVersion(m: EntityManager, ruleVersionId: string): Promise<RuleVersionEntity | null> {
    return m.findOne(RuleVersionEntity, { where: { id: ruleVersionId } });
  }

  async findRuleCategories(m: EntityManager, ruleVersionId: string): Promise<RuleCategoryEntity[]> {
    return m.find(RuleCategoryEntity, { where: { ruleVersionId }, order: { priority: 'ASC' } });
  }

  async findRevisionCategories(m: EntityManager, revisionId: string): Promise<RevisionCategoryEntity[]> {
    return m.find(RevisionCategoryEntity, { where: { revisionId } });
  }

  async countEntriesByCategory(m: EntityManager, revisionId: string): Promise<Map<string, number>> {
    const rows = await m
      .createQueryBuilder(WinningEntryEntity, 'w')
      .select('w.category_code', 'categoryCode')
      .addSelect('COUNT(*)', 'count')
      .where('w.revision_id = :revisionId', { revisionId })
      .groupBy('w.category_code')
      .getRawMany<{ categoryCode: string; count: string }>();
    return new Map(rows.map((r) => [r.categoryCode, Number(r.count)]));
  }

  async findEntriesPage(m: EntityManager, revisionId: string, categoryCode: string, page: number, pageSize: number): Promise<WinningEntryEntity[]> {
    return m.find(WinningEntryEntity, {
      where: { revisionId, categoryCode },
      order: { number: 'ASC', series: 'ASC', id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
  }

  /** Entries of one revision whose number is in `numbers` (full number or configured suffixes). Bounded by the candidate list. */
  async findEntriesByNumbers(m: EntityManager, revisionId: string, numbers: string[]): Promise<WinningEntryEntity[]> {
    if (numbers.length === 0) return [];
    return m.find(WinningEntryEntity, { where: { revisionId, number: In(numbers) }, order: { id: 'ASC' } });
  }

  async findRevisionEvidence(m: EntityManager, revisionId: string): Promise<SourceEvidenceEntity[]> {
    const links = await m.find(RevisionEvidenceEntity, { where: { revisionId } });
    if (links.length === 0) return [];
    return m.find(SourceEvidenceEntity, { where: { id: In(links.map((l) => l.evidenceId)) }, order: { createdAt: 'ASC' } });
  }
}

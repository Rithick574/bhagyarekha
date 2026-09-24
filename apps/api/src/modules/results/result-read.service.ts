import { Injectable } from '@nestjs/common';
import type {
  DrawDetail,
  DrawListQuery,
  DrawListResponse,
  LatestResponse,
  LotteryListResponse,
  ResultQuery,
  ResultResponse,
} from '@bhagyarekha/contracts';
import { RuleSetV1Schema } from '@bhagyarekha/contracts';
import { compileRuleSet } from '@bhagyarekha/domain';
import { DataSource, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/api-error.js';
import { Clock } from '../../common/clock.js';
import type { DrawEntity, ResultRevisionEntity, RevisionCategoryEntity, RuleCategoryEntity, RuleVersionEntity } from '../../database/entities/index.js';
import { DeploymentModeService } from '../deployment-mode/deployment-mode.service.js';
import {
  deriveCheckingCapability,
  payloadVisible,
  toCategoryResult,
  toDrawSummary,
  toLotterySummary,
  toRevisionSummary,
  toSourceReference,
  toWinningEntry,
} from './mapping.js';
import { ResultsRepository } from './results.repository.js';
import { withReadSnapshot } from './snapshot.js';

@Injectable()
export class ResultReadService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly repo: ResultsRepository,
    private readonly clock: Clock,
    private readonly deploymentMode: DeploymentModeService,
  ) {}

  async listLotteries(activeOnly: boolean | undefined): Promise<LotteryListResponse> {
    const lotteries = await this.repo.findLotteries(this.dataSource.manager, activeOnly);
    return { dataMode: this.deploymentMode.dataMode, items: lotteries.map(toLotterySummary) };
  }

  async listDraws(query: DrawListQuery): Promise<DrawListResponse> {
    return withReadSnapshot(this.dataSource, async (m) => {
      const { draws, total } = await this.repo.findDrawsPage(m, query);
      const rows = await this.repo.loadDrawSummaryRows(m, draws);
      return { dataMode: this.deploymentMode.dataMode, items: rows.map(toDrawSummary), page: query.page, pageSize: query.pageSize, total };
    });
  }

  /** AC-02: the latest published draw and the pending draw are separate objects; a stale result is never relabelled. */
  async latest(lotteryId: string | undefined): Promise<LatestResponse> {
    const today = this.clock.todayInKolkata();
    return withReadSnapshot(this.dataSource, async (m) => {
      const latestDraw = await this.repo.findLatestPublishedDraw(m, lotteryId);
      const pendingDraw = await this.repo.findPendingDraw(m, lotteryId, today);
      const rows = await this.repo.loadDrawSummaryRows(m, [latestDraw, pendingDraw].filter((d): d is DrawEntity => d !== null));
      const byId = new Map(rows.map((r) => [r.draw.id, toDrawSummary(r)]));
      return {
        dataMode: this.deploymentMode.dataMode,
        latestPublished: latestDraw ? (byId.get(latestDraw.id) ?? null) : null,
        pendingDraw: pendingDraw ? (byId.get(pendingDraw.id) ?? null) : null,
        asOfDate: today,
      };
    });
  }

  async getDraw(drawId: string): Promise<DrawDetail> {
    return withReadSnapshot(this.dataSource, async (m) => {
      const draw = await this.repo.findDrawById(m, drawId);
      if (!draw) throw ApiError.notFound('DRAW_NOT_FOUND', 'No draw with this identifier');
      const [rows] = await this.repo.loadDrawSummaryRows(m, [draw]);
      if (!rows) throw ApiError.unavailable('RESULT_UNAVAILABLE', 'Draw context could not be loaded');
      const revision = rows.currentRevision;
      const visible = payloadVisible(draw, revision);
      const ruleVersion = visible ? await this.repo.findRuleVersion(m, revision.ruleVersionId) : null;
      const sources = visible ? (await this.repo.findRevisionEvidence(m, revision.id)).map(toSourceReference) : [];
      return {
        ...toDrawSummary(rows),
        dataMode: this.deploymentMode.dataMode,
        checking: deriveCheckingCapability(draw, revision, ruleVersion, ruleVersion ? await this.ruleCompiles(m, ruleVersion) : false),
        sources,
      };
    });
  }

  async getResult(drawId: string, query: ResultQuery): Promise<ResultResponse> {
    return withReadSnapshot(this.dataSource, async (m) => {
      const draw = await this.repo.findDrawById(m, drawId);
      if (!draw) throw ApiError.notFound('DRAW_NOT_FOUND', 'No draw with this identifier');
      const [rows] = await this.repo.loadDrawSummaryRows(m, [draw]);
      if (!rows) throw ApiError.unavailable('RESULT_UNAVAILABLE', 'Draw context could not be loaded');
      const revision = rows.currentRevision;
      if (draw.visibility === 'SUSPENDED') throw ApiError.conflict('RESULT_SUSPENDED', 'This result is temporarily withheld pending review');
      if (!payloadVisible(draw, revision)) throw ApiError.notFound('RESULT_NOT_PUBLISHED', 'No published result for this draw');
      if (query.revisionId && query.revisionId !== revision.id) {
        throw ApiError.conflict('RESULT_CHANGED', 'The result has been revised since it was loaded; refresh to see the current revision');
      }

      const ruleVersion = await this.repo.findRuleVersion(m, revision.ruleVersionId);
      if (!ruleVersion) throw ApiError.unavailable('RESULT_UNAVAILABLE', 'Rule version for this result is missing');
      const ruleCategories = await this.repo.findRuleCategories(m, ruleVersion.id);
      const revisionCategories = await this.repo.findRevisionCategories(m, revision.id);
      const counts = await this.repo.countEntriesByCategory(m, revision.id);
      const evidence = await this.repo.findRevisionEvidence(m, revision.id);
      const categories = this.buildCategories(revision, ruleCategories, revisionCategories, counts);

      const targetCodes = query.categoryCode ? [query.categoryCode] : categories.map((c) => c.code);
      if (query.categoryCode && !categories.some((c) => c.code === query.categoryCode)) {
        throw ApiError.notFound('CATEGORY_NOT_FOUND', 'This result has no such prize category');
      }
      const page = query.categoryCode ? query.page : 1;
      const entries = [];
      for (const code of targetCodes) {
        entries.push({
          categoryCode: code,
          page,
          pageSize: query.pageSize,
          total: counts.get(code) ?? 0,
          items: (await this.repo.findEntriesPage(m, revision.id, code, page, query.pageSize)).map(toWinningEntry),
        });
      }

      return {
        dataMode: this.deploymentMode.dataMode,
        draw: toDrawSummary(rows),
        revision: toRevisionSummary(revision, rows.supersededRevisionCount),
        rule: { ruleVersionId: ruleVersion.id, ruleVersion: ruleVersion.version, state: ruleVersion.state, numberLength: ruleVersion.numberLength, allowedSeries: ruleVersion.allowedSeries },
        checking: deriveCheckingCapability(draw, revision, ruleVersion, await this.ruleCompiles(m, ruleVersion)),
        sources: evidence.map(toSourceReference),
        categories,
        entries,
      };
    });
  }

  /** Every configured category appears; a category without a manifest row is an integrity failure, not "missing". */
  private buildCategories(
    revision: ResultRevisionEntity,
    ruleCategories: RuleCategoryEntity[],
    revisionCategories: RevisionCategoryEntity[],
    counts: Map<string, number>,
  ) {
    return ruleCategories.map((rc) => {
      const manifest = revisionCategories.find((c) => c.categoryCode === rc.code);
      if (!manifest) throw ApiError.unavailable('RESULT_UNAVAILABLE', `Revision ${revision.id} lacks a manifest row for category ${rc.code}`);
      return toCategoryResult(rc, manifest, counts.get(rc.code) ?? 0);
    });
  }

  private async ruleCompiles(m: EntityManager, ruleVersion: RuleVersionEntity): Promise<boolean> {
    const categories = await this.repo.findRuleCategories(m, ruleVersion.id);
    const parsed = RuleSetV1Schema.safeParse({
      schemaVersion: ruleVersion.schemaVersion,
      engineVersion: ruleVersion.engineVersion,
      lotteryCode: 'X',
      ruleVersion: ruleVersion.version,
      numberLength: ruleVersion.numberLength,
      allowedFirstDigits: ruleVersion.allowedFirstDigits,
      allowedSeries: ruleVersion.allowedSeries,
      awardPolicy: ruleVersion.awardPolicy,
      categories: categories.map((c) => ({
        code: c.code,
        labels: { en: c.labelEn, ml: c.labelMl },
        metricRole: c.metricRole,
        priority: c.priority,
        match: c.matchKind === 'SUFFIX' ? { kind: 'SUFFIX', seriesPolicy: 'ANY_ALLOWED', suffixLength: c.suffixLength } : { kind: 'FULL_NUMBER', seriesPolicy: c.seriesPolicy },
        excludedBy: c.excludedBy,
        expectedEntryCount: c.expectedEntryCount,
      })),
    });
    return parsed.success && compileRuleSet(parsed.data).ok;
  }
}

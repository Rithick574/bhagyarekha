import { Injectable } from '@nestjs/common';
import type { StatisticsQuery, StatisticsResponse, StatisticsScope } from '@bhagyarekha/contracts';
import { computeDescriptiveStatistics, type Observation } from '@bhagyarekha/domain';
import { DataSource, In, type EntityManager } from 'typeorm';
import { ApiError } from '../../common/api-error.js';
import { Clock } from '../../common/clock.js';
import { DrawEntity, LotteryEntity, ResultRevisionEntity, RevisionCategoryEntity, RuleCategoryEntity, WinningEntryEntity } from '../../database/entities/index.js';
import { DeploymentModeService } from '../deployment-mode/deployment-mode.service.js';
import { withReadSnapshot } from '../results/snapshot.js';
import { RuleLoaderService, type LoadedRule } from '../rule-versions/rule-loader.service.js';

type Exclusion = keyof StatisticsScope['excludedDrawCounts'];

interface EligibleDraw {
  draw: DrawEntity;
  revision: ResultRevisionEntity;
  rule: LoadedRule;
  categoryCodes: string[];
}

const NOTES = [
  'Observation unit: one published first-prize entry (draw, category, series and number). A draw with several first-prize entries contributes several observations; the draw count is shown separately.',
  'Only the current, active, published revision of each draw is counted. Superseded (corrected) revisions, suspended draws, cancelled draws and unpublished draws are excluded and counted under exclusions.',
  'A first-prize category is counted only when it is marked complete and its source was reviewed by this application\'s operator, even if other prize categories of the same draw are still partial.',
  'Digit positions are counted from the left of the full number; leading zeros are digits. Each position sums to the observation count.',
  '"Last two" and "last three" digits are the final characters of the number string. Share means count divided by the observation count (historical share), not a probability.',
  'Repeated numbers count identical full number strings; repeated tickets additionally require the same series. Collision pairs are c×(c−1)/2 per group, not the number of occurrences.',
  'Odd/even uses the final digit. Digit sum adds all digits (zeros add zero). Duplicate digits means fewer distinct digits than positions. Adjacent equal digits means two identical neighbours.',
  'A consecutive run is at least three adjacent digits stepping +1 or −1 in one direction (e.g. 345 or 876); 9→0 does not count as a step. Each number is counted once even with several runs.',
  'This archive is not guaranteed to be a complete calendar of draws; known draws are the draws recorded here, not every draw that took place.',
  'These figures describe past published results. They are not probabilities for any future draw, not evidence that any number is "due", and not a recommendation to buy any ticket.',
];

@Injectable()
export class StatisticsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly rules: RuleLoaderService,
    private readonly clock: Clock,
    private readonly deploymentMode: DeploymentModeService,
  ) {}

  async compute(q: StatisticsQuery): Promise<StatisticsResponse> {
    return withReadSnapshot(this.dataSource, async (m) => {
      const lottery = await m.findOne(LotteryEntity, { where: { id: q.lotteryId } });
      if (!lottery) throw ApiError.notFound('LOTTERY_NOT_FOUND', 'No such lottery');

      const draws = await m
        .createQueryBuilder(DrawEntity, 'd')
        .where('d.lottery_id = :lotteryId', { lotteryId: q.lotteryId })
        .andWhere('COALESCE(d.actual_date, d.scheduled_date) BETWEEN :from AND :to', { from: q.from, to: q.to })
        .orderBy('COALESCE(d.actual_date, d.scheduled_date)', 'ASC')
        .getMany();

      const excluded: Record<Exclusion, number> = { NOT_PUBLISHED: 0, SUSPENDED: 0, CANCELLED: 0, FIRST_PRIZE_INCOMPLETE: 0, RULE_UNSUPPORTED: 0, INCOMPATIBLE_RULE_VERSION: 0 };
      const eligible = await this.selectEligible(m, draws, excluded);

      // One number domain per computation (LLD §8.1). Mixed lengths need an explicit rule-version filter.
      let selected = eligible;
      if (q.ruleVersionId) {
        selected = eligible.filter((e) => e.rule.version.id === q.ruleVersionId);
        excluded.INCOMPATIBLE_RULE_VERSION += eligible.length - selected.length;
      }
      const lengths = new Set(selected.map((e) => e.rule.version.numberLength));
      if (lengths.size > 1) {
        throw new ApiError(400, 'INVALID_INPUT', 'The range mixes rule versions with different number lengths; choose one with ruleVersionId or narrow the dates', [{ path: 'ruleVersionId', code: 'REQUIRED_MIXED_DOMAINS' }]);
      }
      const numberLength: number | null = [...lengths][0] ?? null;

      const observations: Observation[] = [];
      const seen = new Set<string>();
      let drawCount = 0;
      const ruleVersionIds = new Set<string>();
      const categoryCodes = new Set<string>();
      for (const e of selected) {
        const entries = await m.find(WinningEntryEntity, { where: { revisionId: e.revision.id, categoryCode: In(e.categoryCodes) } });
        let contributed = false;
        for (const entry of entries) {
          const key = `${e.draw.id}|${entry.categoryCode}|${entry.series}|${entry.number}`;
          if (seen.has(key)) continue; // duplicate citations never double-count
          seen.add(key);
          observations.push({ number: entry.number, series: entry.series });
          contributed = true;
        }
        if (contributed) drawCount += 1;
        ruleVersionIds.add(e.rule.version.id);
        for (const c of e.categoryCodes) categoryCodes.add(c);
      }

      const stats = computeDescriptiveStatistics(observations, numberLength ?? (observations[0]?.number.length ?? 0));
      const incompatible = q.ruleVersionId ? [...new Set(eligible.filter((e) => e.rule.version.id !== q.ruleVersionId).map((e) => e.rule.version.id))] : [];

      const scope: StatisticsScope = {
        lotteryId: lottery.id,
        lotteryName: { en: lottery.nameEn, ml: lottery.nameMl },
        from: q.from,
        to: q.to,
        metric: 'FIRST_PRIZE',
        observationUnit: 'FIRST_PRIZE_ENTRY',
        categoryCodes: [...categoryCodes].sort(),
        numberLength: numberLength ?? null,
        drawCount,
        observationCount: observations.length,
        knownDrawCount: draws.length,
        excludedDrawCounts: excluded,
        ruleVersionIds: [...ruleVersionIds],
        incompatibleRuleVersionIds: incompatible,
        calendarCoverage: lottery.archiveCoverage,
        datasetVersion: lottery.datasetVersion,
        computedAt: this.clock.now().toISOString(),
        dataMode: this.deploymentMode.dataMode,
      };
      return {
        scope,
        positionDigitCounts: stats.positionDigitCounts,
        lastTwo: stats.lastTwo,
        lastThree: stats.lastThree,
        repeated: stats.repeated,
        parity: stats.parity,
        digitSum: stats.digitSum,
        duplicateDigits: stats.duplicateDigits,
        adjacentEqualDigits: stats.adjacentEqualDigits,
        consecutiveRuns: stats.consecutiveRuns,
        notes: NOTES,
      };
    });
  }

  /** LLD §8.1 observation selection with per-reason exclusion counts. */
  private async selectEligible(m: EntityManager, draws: DrawEntity[], excluded: Record<Exclusion, number>): Promise<EligibleDraw[]> {
    const out: EligibleDraw[] = [];
    const ruleCache = new Map<string, LoadedRule | null>();
    for (const draw of draws) {
      if (draw.phase === 'CANCELLED') { excluded.CANCELLED += 1; continue; }
      if (draw.visibility === 'SUSPENDED') { excluded.SUSPENDED += 1; continue; }
      if (!draw.currentRevisionId) { excluded.NOT_PUBLISHED += 1; continue; }
      const revision = await m.findOne(ResultRevisionEntity, { where: { id: draw.currentRevisionId, workflowState: 'PUBLISHED' } });
      if (!revision) { excluded.NOT_PUBLISHED += 1; continue; }
      let rule = ruleCache.get(revision.ruleVersionId);
      if (rule === undefined) {
        rule = await this.rules.load(m, revision.ruleVersionId);
        ruleCache.set(revision.ruleVersionId, rule);
      }
      if (!rule || rule.version.state !== 'APPROVED' || !rule.compiled) { excluded.RULE_UNSUPPORTED += 1; continue; }
      const firstPrizeCodes = rule.categories.filter((c: RuleCategoryEntity) => c.metricRole === 'FIRST_PRIZE').map((c) => c.code);
      if (firstPrizeCodes.length === 0) { excluded.RULE_UNSUPPORTED += 1; continue; }
      const manifests = await m.find(RevisionCategoryEntity, { where: { revisionId: revision.id, categoryCode: In(firstPrizeCodes) } });
      const complete = firstPrizeCodes.every((code) => {
        const man = manifests.find((x) => x.categoryCode === code);
        return man?.state === 'COMPLETE' && man.sourceReviewedAt !== null;
      });
      if (!complete) { excluded.FIRST_PRIZE_INCOMPLETE += 1; continue; }
      out.push({ draw, revision, rule, categoryCodes: firstPrizeCodes });
    }
    return out;
  }
}

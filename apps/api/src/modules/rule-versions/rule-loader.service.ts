import { Injectable } from '@nestjs/common';
import { RuleSetV1Schema, type RuleSetV1 } from '@bhagyarekha/contracts';
import { compileRuleSet, type CompiledRuleSet } from '@bhagyarekha/domain';
import { type EntityManager } from 'typeorm';
import { LotteryEntity, RuleCategoryEntity, RuleVersionEntity } from '../../database/entities/index.js';

export interface LoadedRule {
  version: RuleVersionEntity;
  categories: RuleCategoryEntity[];
  /** Wire form rebuilt from the normalized rows (the rows are the source of truth). */
  ruleSet: RuleSetV1 | null;
  /** Null when the rows do not form a valid, compilable v1 rule set. */
  compiled: CompiledRuleSet | null;
}

/** Loads a rule version from the caller's snapshot and compiles it. Fails closed: any problem yields `compiled: null`. */
@Injectable()
export class RuleLoaderService {
  async load(m: EntityManager, ruleVersionId: string): Promise<LoadedRule | null> {
    const version = await m.findOne(RuleVersionEntity, { where: { id: ruleVersionId } });
    if (!version) return null;
    const lottery = await m.findOne(LotteryEntity, { where: { id: version.lotteryId } });
    const categories = await m.find(RuleCategoryEntity, { where: { ruleVersionId }, order: { priority: 'ASC' } });
    const parsed = RuleSetV1Schema.safeParse({
      schemaVersion: version.schemaVersion,
      engineVersion: version.engineVersion,
      lotteryCode: lottery?.code ?? 'UNKNOWN',
      ruleVersion: version.version,
      numberLength: version.numberLength,
      allowedFirstDigits: version.allowedFirstDigits,
      allowedSeries: version.allowedSeries,
      awardPolicy: version.awardPolicy,
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
    if (!parsed.success) return { version, categories, ruleSet: null, compiled: null };
    const compiled = compileRuleSet(parsed.data);
    return { version, categories, ruleSet: parsed.data, compiled: compiled.ok ? compiled.compiled : null };
  }

  /** Latest APPROVED rule version of a lottery, for form hints only. */
  async findLatestApproved(m: EntityManager, lotteryId: string): Promise<RuleVersionEntity | null> {
    return m.findOne(RuleVersionEntity, { where: { lotteryId, state: 'APPROVED' }, order: { version: 'DESC' } });
  }
}

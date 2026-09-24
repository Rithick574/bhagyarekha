import { compileRuleSet } from '@bhagyarekha/domain';
import type { DataSource, EntityManager } from 'typeorm';
import { canonicalHash } from '../common/canonical-hash.js';
import {
  DeploymentMetadataEntity,
  DrawEntity,
  LotteryEntity,
  ResultRevisionEntity,
  RevisionCategoryEntity,
  RevisionEvidenceEntity,
  RuleCategoryEntity,
  RuleEvidenceEntity,
  RuleVersionEntity,
  SourceEvidenceEntity,
  WinningEntryEntity,
  type DrawSnapshot,
} from '../database/entities/index.js';
import { demoFixtures, type DemoFixtures, type FixtureRevision } from './demo-fixtures.js';

export class SeedRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeedRefusedError';
  }
}

export interface SeedSummary {
  lotteriesInserted: number;
  ruleVersionsInserted: number;
  drawsInserted: number;
  revisionsInserted: number;
  entriesInserted: number;
  skippedExisting: number;
}

export interface SeedOptions {
  /** DATA_MODE from the environment. Must be 'demo'; anything else is refused. */
  configuredMode: string;
  fixtures?: DemoFixtures;
}

/**
 * Idempotently writes the synthetic demo dataset. Refuses unless BOTH the
 * configured mode and the database's immutable mode marker are 'demo'
 * (AC-09 / T26). Runs in one transaction: either everything new lands or nothing.
 */
export async function seedDemo(dataSource: DataSource, options: SeedOptions): Promise<SeedSummary> {
  if (options.configuredMode !== 'demo') {
    throw new SeedRefusedError(`Refusing to seed: DATA_MODE is "${options.configuredMode}", not "demo". Flags cannot override this.`);
  }
  const fixtures = options.fixtures ?? demoFixtures;
  for (const rule of fixtures.ruleVersions) {
    const compiled = compileRuleSet(rule.ruleSet);
    if (!compiled.ok) {
      throw new Error(`Fixture rule set ${rule.ruleSet.lotteryCode} v${rule.ruleSet.ruleVersion} does not compile: ${compiled.errors.map((e) => e.code).join(', ')}`);
    }
  }

  return dataSource.transaction(async (m) => {
    const meta = await m.getRepository(DeploymentMetadataEntity).createQueryBuilder('d').setLock('pessimistic_read').where('d.id = 1').getOne();
    if (!meta) throw new SeedRefusedError('Refusing to seed: database has no deployment_metadata row. Run `pnpm env:init -- --mode demo` first.');
    if (meta.dataMode !== 'demo') throw new SeedRefusedError(`Refusing to seed: database is marked "${meta.dataMode}". Synthetic fixtures never enter a live database.`);

    const summary: SeedSummary = { lotteriesInserted: 0, ruleVersionsInserted: 0, drawsInserted: 0, revisionsInserted: 0, entriesInserted: 0, skippedExisting: 0 };
    const now = new Date();

    for (const l of fixtures.lotteries) {
      if (await m.existsBy(LotteryEntity, { id: l.id })) {
        summary.skippedExisting += 1;
        continue;
      }
      await m.insert(LotteryEntity, { id: l.id, code: l.code, slug: l.slug, nameEn: l.nameEn, nameMl: l.nameMl, active: l.active, datasetVersion: '0', archiveCoverage: 'UNKNOWN', createdAt: now, updatedAt: now, editVersion: 1 });
      summary.lotteriesInserted += 1;
    }

    for (const e of fixtures.evidence) {
      if (await m.existsBy(SourceEvidenceEntity, { id: e.id })) continue;
      await m.insert(SourceEvidenceEntity, { id: e.id, kind: 'SYNTHETIC_FIXTURE', url: null, title: e.title, documentHash: null, reviewedBy: null, reviewedAt: new Date(e.reviewedAt), reviewNote: e.reviewNote, acquiredAt: null, createdAt: now });
    }

    for (const r of fixtures.ruleVersions) {
      if (await m.existsBy(RuleVersionEntity, { id: r.id })) {
        summary.skippedExisting += 1;
        continue;
      }
      const rs = r.ruleSet;
      await m.insert(RuleVersionEntity, {
        id: r.id, lotteryId: r.lotteryId, version: rs.ruleVersion, schemaVersion: rs.schemaVersion, engineVersion: rs.engineVersion,
        numberLength: rs.numberLength, allowedFirstDigits: rs.allowedFirstDigits, allowedSeries: rs.allowedSeries, awardPolicy: rs.awardPolicy,
        state: 'DRAFT', contentHash: canonicalHash(rs), approvedBy: null, approvedAt: null, approvalNote: null, revokedBy: null, revokedAt: null, revocationReason: null,
        createdAt: now, updatedAt: now, editVersion: 1,
      });
      for (const c of rs.categories) {
        await m.insert(RuleCategoryEntity, {
          ruleVersionId: r.id, code: c.code, labelEn: c.labels.en, labelMl: c.labels.ml, priority: c.priority, metricRole: c.metricRole,
          matchKind: c.match.kind, seriesPolicy: c.match.seriesPolicy, suffixLength: c.match.kind === 'SUFFIX' ? c.match.suffixLength : null,
          excludedBy: c.excludedBy, expectedEntryCount: c.expectedEntryCount,
        });
      }
      await m.insert(RuleEvidenceEntity, { ruleVersionId: r.id, evidenceId: r.evidenceId });
      await m.update(RuleVersionEntity, { id: r.id }, { state: 'APPROVED', approvedAt: new Date(r.approvedAt), approvalNote: 'Synthetic demo fixture approval. Not an independent review of any real scheme.', updatedAt: now, editVersion: 2 });
      if (r.state === 'REVOKED') {
        await m.update(RuleVersionEntity, { id: r.id }, { state: 'REVOKED', revokedAt: new Date(r.revokedAt ?? now.toISOString()), revocationReason: r.revocationReason, updatedAt: now, editVersion: 3 });
      }
      summary.ruleVersionsInserted += 1;
    }

    for (const d of fixtures.draws) {
      if (await m.existsBy(DrawEntity, { id: d.id })) {
        summary.skippedExisting += 1;
        continue;
      }
      await m.insert(DrawEntity, {
        id: d.id, lotteryId: d.lotteryId, drawCode: d.drawCode, scheduledDate: d.scheduledDate, actualDate: d.actualDate,
        scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null, actualAt: d.actualAt ? new Date(d.actualAt) : null,
        phase: d.phase, visibility: 'ACTIVE', suspensionReason: null, currentRevisionId: null, nextRevisionNo: 1, createdAt: now, updatedAt: now, editVersion: 1,
      });
      summary.drawsInserted += 1;
    }

    for (const rev of fixtures.revisions) {
      if (await m.existsBy(ResultRevisionEntity, { id: rev.id })) {
        summary.skippedExisting += 1;
        continue;
      }
      summary.entriesInserted += await publishFixtureRevision(m, fixtures, rev, now);
      summary.revisionsInserted += 1;
    }

    // Apply suspensions after publication so the withheld payload exists but is hidden.
    for (const d of fixtures.draws) {
      if (d.visibility === 'SUSPENDED') {
        await m.update(DrawEntity, { id: d.id, visibility: 'ACTIVE' }, { visibility: 'SUSPENDED', suspensionReason: d.suspensionReason, updatedAt: now });
      }
    }

    return summary;
  });
}

async function publishFixtureRevision(m: EntityManager, fixtures: DemoFixtures, rev: FixtureRevision, now: Date): Promise<number> {
  const draw = fixtures.draws.find((d) => d.id === rev.drawId);
  if (!draw) throw new Error(`Fixture revision ${rev.id} references unknown draw ${rev.drawId}`);
  const snapshot: DrawSnapshot = { drawCode: draw.drawCode, scheduledDate: draw.scheduledDate, actualDate: draw.actualDate, scheduledAt: draw.scheduledAt, actualAt: draw.actualAt };
  const contentHash = canonicalHash({ snapshot, ruleVersionId: rev.ruleVersionId, completeness: rev.completeness, categories: rev.categories, evidence: [rev.evidenceId] });

  await m.insert(ResultRevisionEntity, {
    id: rev.id, drawId: rev.drawId, lotteryId: rev.lotteryId, ruleVersionId: rev.ruleVersionId, revisionNo: rev.revisionNo, drawSnapshot: snapshot,
    basedOnRevisionId: rev.basedOnRevisionId, workflowState: 'DRAFT', publicationKind: rev.publicationKind, completeness: rev.completeness, contentHash,
    reviewedHash: null, reviewedBy: null, reviewedAt: null, publishedBy: null, publishedAt: null, correctionReason: rev.correctionReason, createdAt: now, updatedAt: now, editVersion: 1,
  });

  let entries = 0;
  for (const c of rev.categories) {
    await m.insert(RevisionCategoryEntity, {
      revisionId: rev.id, categoryCode: c.code, ruleVersionId: rev.ruleVersionId, state: c.state, amountMinor: c.amountMinor,
      sourceReviewedBy: null, sourceReviewedAt: c.sourceReviewedAt ? new Date(c.sourceReviewedAt) : null,
      sourceReviewNote: c.sourceReviewedAt ? 'Synthetic fixture — reviewed against nothing real.' : null,
    });
    for (const [i, e] of c.entries.entries()) {
      await m.insert(WinningEntryEntity, { revisionId: rev.id, categoryCode: c.code, series: e.series, number: e.number, sourceRow: i + 1 });
      entries += 1;
    }
  }
  await m.insert(RevisionEvidenceEntity, { revisionId: rev.id, evidenceId: rev.evidenceId });

  const publishedAt = new Date(rev.publishedAt);
  await m.update(ResultRevisionEntity, { id: rev.id }, { workflowState: 'PUBLISHED', reviewedHash: contentHash, reviewedAt: publishedAt, publishedAt, updatedAt: now, editVersion: 2 });

  const drawRow = await m.findOneOrFail(DrawEntity, { where: { id: rev.drawId } });
  if (drawRow.currentRevisionId) {
    await m.update(ResultRevisionEntity, { id: drawRow.currentRevisionId, workflowState: 'PUBLISHED' }, { workflowState: 'SUPERSEDED', updatedAt: now });
  }
  await m.update(DrawEntity, { id: rev.drawId }, { currentRevisionId: rev.id, nextRevisionNo: rev.revisionNo + 1, updatedAt: now, editVersion: drawRow.editVersion + 1 });
  await m.createQueryBuilder().update(LotteryEntity).set({ datasetVersion: () => 'dataset_version + 1', updatedAt: now }).where('id = :id', { id: rev.lotteryId }).execute();
  return entries;
}

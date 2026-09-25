import { Injectable } from '@nestjs/common';
import type { CheckMessageCode, CheckOutcome, TicketCheckRequest, TicketCheckResponse } from '@bhagyarekha/contracts';
import { candidateNumbers, evaluateTicket, normalizeTicketInput, validateTicketDomain, type ResultSnapshot, type TicketFieldError } from '@bhagyarekha/domain';
import { DataSource } from 'typeorm';
import { ApiError } from '../../common/api-error.js';
import { Clock } from '../../common/clock.js';
import { payloadVisible, toDrawSummary, toSourceReference } from '../results/mapping.js';
import { DeploymentModeService } from '../deployment-mode/deployment-mode.service.js';
import { ResultsRepository } from '../results/results.repository.js';
import { withReadSnapshot } from '../results/snapshot.js';
import { RuleLoaderService } from '../rule-versions/rule-loader.service.js';

const MESSAGE_BY_OUTCOME: Record<CheckOutcome, CheckMessageCode> = {
  MATCH: 'CHECK_MATCH_INFORMATIONAL',
  NO_MATCH: 'CHECK_NO_MATCH_COMPLETE',
  PARTIAL_MATCH: 'CHECK_PARTIAL_MATCH_PROVISIONAL',
  RESULT_INCOMPLETE: 'CHECK_RESULT_INCOMPLETE',
  RESULT_NOT_PUBLISHED: 'CHECK_RESULT_NOT_PUBLISHED',
  RULES_UNSUPPORTED: 'CHECK_RULES_UNSUPPORTED',
  RESULT_SUSPENDED: 'CHECK_RESULT_SUSPENDED',
  DRAW_CANCELLED: 'CHECK_DRAW_CANCELLED',
};

/**
 * LLD §4.2. One short read-only repeatable-read snapshot; the pure engine does
 * the matching; the entered ticket is never persisted, logged or echoed.
 */
@Injectable()
export class TicketCheckService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly repo: ResultsRepository,
    private readonly rules: RuleLoaderService,
    private readonly clock: Clock,
    private readonly deploymentMode: DeploymentModeService,
  ) {}

  async check(request: TicketCheckRequest): Promise<TicketCheckResponse> {
    // Step 1: envelope-level normalisation before touching the database.
    const normalized = normalizeTicketInput({ series: request.series, number: request.number });
    if ('errors' in normalized) throw fieldError(normalized.errors);
    const ticket = normalized.ticket;

    return withReadSnapshot(this.dataSource, async (m) => {
      const draw = await this.repo.findDrawById(m, request.drawId);
      if (!draw) throw ApiError.notFound('DRAW_NOT_FOUND', 'No draw with this identifier');
      if (draw.lotteryId !== request.lotteryId) throw new ApiError(400, 'DRAW_MISMATCH', 'The draw does not belong to the selected lottery');

      const [rows] = await this.repo.loadDrawSummaryRows(m, [draw]);
      if (!rows) throw ApiError.unavailable('RESULT_UNAVAILABLE', 'Draw context could not be loaded');
      const checkedAt = this.clock.now().toISOString();
      const base = (outcome: CheckOutcome, extra: Partial<TicketCheckResponse> = {}): TicketCheckResponse => ({
        outcome,
        dataMode: this.deploymentMode.dataMode,
        draw: toDrawSummary(rows),
        resultRevisionId: null,
        ruleVersionId: null,
        checkedAt,
        completeness: null,
        categories: [],
        checkedCategoryCodes: [],
        unresolvedCategoryCodes: [],
        matches: [],
        basis: 'PUBLISHED_SNAPSHOT_ONLY',
        sources: [],
        messageCode: MESSAGE_BY_OUTCOME[outcome],
        ...extra,
      });

      // Step 3: non-verdict states come before any attempt at matching.
      if (draw.phase === 'CANCELLED') return base('DRAW_CANCELLED');
      if (draw.visibility === 'SUSPENDED') return base('RESULT_SUSPENDED');
      const revision = rows.currentRevision;
      if (!payloadVisible(draw, revision)) return base('RESULT_NOT_PUBLISHED');

      // Step 4: the user must be looking at the current revision.
      if (request.expectedRevisionId && request.expectedRevisionId !== revision.id) {
        throw ApiError.conflict('RESULT_CHANGED', 'The result has been revised since it was loaded; refresh and check again');
      }

      const sources = (await this.repo.findRevisionEvidence(m, revision.id)).map(toSourceReference);
      const loaded = await this.rules.load(m, revision.ruleVersionId);
      const revisionCategories = await this.repo.findRevisionCategories(m, revision.id);
      const categoriesOut = (loaded?.categories ?? []).map((c) => ({
        code: c.code,
        label: { en: c.labelEn, ml: c.labelMl },
        state: revisionCategories.find((rc) => rc.categoryCode === c.code)?.state ?? ('MISSING' as const),
      }));
      const withRevision = { resultRevisionId: revision.id, ruleVersionId: revision.ruleVersionId, completeness: revision.completeness, sources, categories: categoriesOut };

      if (!loaded || loaded.version.state !== 'APPROVED' || !loaded.compiled) return base('RULES_UNSUPPORTED', withRevision);
      const compiled = loaded.compiled;

      // Step 5: ticket domain against THIS revision's rule.
      const domain = validateTicketDomain(compiled, ticket);
      if ('errors' in domain) throw fieldError(domain.errors);

      // Step 6: bounded entry lookup — only rows that could match this ticket.
      const entries = await this.repo.findEntriesByNumbers(m, revision.id, candidateNumbers(compiled, ticket));
      const snapshot: ResultSnapshot = {
        completeness: revision.completeness,
        categories: revisionCategories.map((rc) => ({
          code: rc.categoryCode,
          state: rc.state,
          amountMinor: rc.amountMinor,
          entries: entries.filter((e) => e.categoryCode === rc.categoryCode).map((e) => ({ series: e.series, number: e.number })),
        })),
      };
      const evaluated = evaluateTicket(compiled, snapshot, ticket);
      if ('integrity' in evaluated) throw ApiError.unavailable('RESULT_UNAVAILABLE', `Result integrity check failed: ${evaluated.integrity}`);
      const { evaluation } = evaluated;

      return base(evaluation.outcome, {
        ...withRevision,
        checkedCategoryCodes: evaluation.checkedCategoryCodes,
        unresolvedCategoryCodes: evaluation.unresolvedCategoryCodes,
        matches: evaluation.matches.map((match) => ({ ...match, currency: 'INR' as const })),
      });
    });
  }
}

function fieldError(errors: TicketFieldError[]): ApiError {
  const codes = new Set(errors.map((e) => e.code));
  const fields = errors.map((e) => ({ path: e.path, code: e.code }));
  if (codes.has('SERIES_NOT_ALLOWED') || codes.has('SERIES_REQUIRED')) return new ApiError(400, 'INVALID_SERIES', 'The series is not valid for this draw', fields);
  if (codes.has('WRONG_LENGTH')) return new ApiError(400, 'INVALID_NUMBER_LENGTH', 'The ticket number has the wrong length for this draw', fields);
  return new ApiError(400, 'INVALID_INPUT', 'The ticket details are not valid', fields);
}

import type { CategoryState, Completeness, RuleCategorySpec, TicketFieldErrorCode } from '@bhagyarekha/contracts';
import type { CompiledRuleSet } from '../rules/compile.js';
import type { NormalizedTicket, TicketFieldError } from './normalize.js';

/** One published category from a single revision snapshot. */
export interface SnapshotCategory {
  code: string;
  state: CategoryState;
  amountMinor: string | null;
  /** Entries whose number equals the ticket number or one of its configured suffixes. Other entries may be omitted. */
  entries: readonly { series: string; number: string }[];
}

export interface ResultSnapshot {
  completeness: Completeness;
  categories: readonly SnapshotCategory[];
}

export type DomainValidation = { ok: true } | { ok: false; errors: TicketFieldError[] };

/**
 * LLD §4.2 step 5: ticket length, first digit and series against the rule
 * domain. Runs before any matching so EXCEPT_ENTRY can never admit an invalid series.
 */
export function validateTicketDomain(rules: CompiledRuleSet, ticket: NormalizedTicket): DomainValidation {
  const errors: TicketFieldError[] = [];
  const usesSeries = rules.categoriesByPriority.some((c) => c.spec.match.kind === 'FULL_NUMBER' && c.spec.match.seriesPolicy !== 'ANY_ALLOWED');
  if (usesSeries && ticket.series === '') errors.push({ path: 'series', code: 'SERIES_REQUIRED' });
  else if (ticket.series !== '' && !rules.allowedSeries.has(ticket.series)) errors.push({ path: 'series', code: 'SERIES_NOT_ALLOWED' });

  if (ticket.number.length !== rules.numberLength) errors.push({ path: 'number', code: 'WRONG_LENGTH' });
  else if (!rules.allowedFirstDigits.has(ticket.number[0] as string)) errors.push({ path: 'number', code: 'FIRST_DIGIT_NOT_ALLOWED' });

  return errors.length ? { ok: false, errors } : { ok: true };
}

export interface EvaluatedMatch {
  categoryCode: string;
  awardConfirmed: boolean;
  amountMinor: string | null;
}

export type Verdict = 'MATCH' | 'NO_MATCH' | 'PARTIAL_MATCH' | 'RESULT_INCOMPLETE';

export interface Evaluation {
  outcome: Verdict;
  /** At most one entry (SINGLE_BY_PRIORITY). */
  matches: EvaluatedMatch[];
  /** Codes of categories with a raw number/series match, in priority order (transparency, not awards). */
  rawMatchCategoryCodes: string[];
  checkedCategoryCodes: string[];
  unresolvedCategoryCodes: string[];
}

export type EvaluateResult = { ok: true; evaluation: Evaluation } | { ok: false; integrity: string };

/**
 * LLD §4.2 steps 6–8 over ONE revision snapshot. Pure and deterministic.
 *
 * - Raw matches are computed per category from that snapshot only.
 * - Under SINGLE_BY_PRIORITY the award is the highest-priority raw match not
 *   excluded by a higher-priority raw match. Amounts are never summed.
 * - Any category that is not COMPLETE makes the verdict provisional:
 *   PARTIAL_MATCH when a raw match exists, otherwise RESULT_INCOMPLETE. Never NO_MATCH.
 * - A snapshot labelled COMPLETE with a non-complete category, or a category
 *   missing from the manifest, is an integrity failure (caller answers 503).
 */
export function evaluateTicket(rules: CompiledRuleSet, snapshot: ResultSnapshot, ticket: NormalizedTicket): EvaluateResult {
  const byCode = new Map(snapshot.categories.map((c) => [c.code, c]));
  for (const { spec } of rules.categoriesByPriority) {
    const cat = byCode.get(spec.code);
    if (!cat) return { ok: false, integrity: `Category ${spec.code} has no manifest row in the revision` };
    if (snapshot.completeness === 'COMPLETE' && cat.state !== 'COMPLETE') {
      return { ok: false, integrity: `Revision is labelled COMPLETE but category ${spec.code} is ${cat.state}` };
    }
  }

  const rawMatched = new Set<string>();
  const rawMatchCategoryCodes: string[] = [];
  for (const { spec } of rules.categoriesByPriority) {
    const cat = byCode.get(spec.code) as SnapshotCategory;
    if (cat.entries.some((entry) => entryMatches(spec, rules.numberLength, entry, ticket))) {
      rawMatched.add(spec.code);
      rawMatchCategoryCodes.push(spec.code);
    }
  }

  const checkedCategoryCodes = rules.categoriesByPriority.filter((c) => (byCode.get(c.spec.code) as SnapshotCategory).state === 'COMPLETE').map((c) => c.spec.code);
  const unresolvedCategoryCodes = rules.categoriesByPriority.filter((c) => (byCode.get(c.spec.code) as SnapshotCategory).state !== 'COMPLETE').map((c) => c.spec.code);
  const allComplete = unresolvedCategoryCodes.length === 0 && snapshot.completeness === 'COMPLETE';

  let awarded: RuleCategorySpec | null = null;
  for (const { spec, excludedBy } of rules.categoriesByPriority) {
    if (!rawMatched.has(spec.code)) continue;
    const excluded = [...excludedBy].some((code) => rawMatched.has(code));
    if (!excluded) {
      awarded = spec;
      break;
    }
  }

  if (!allComplete) {
    const provisional = awarded ?? (rawMatchCategoryCodes[0] ? (rules.categoriesByPriority.find((c) => c.spec.code === rawMatchCategoryCodes[0])?.spec ?? null) : null);
    return {
      ok: true,
      evaluation: {
        outcome: provisional ? 'PARTIAL_MATCH' : 'RESULT_INCOMPLETE',
        matches: provisional ? [{ categoryCode: provisional.code, awardConfirmed: false, amountMinor: null }] : [],
        rawMatchCategoryCodes,
        checkedCategoryCodes,
        unresolvedCategoryCodes,
      },
    };
  }

  if (awarded) {
    const cat = byCode.get(awarded.code) as SnapshotCategory;
    return {
      ok: true,
      evaluation: {
        outcome: 'MATCH',
        matches: [{ categoryCode: awarded.code, awardConfirmed: true, amountMinor: cat.amountMinor }],
        rawMatchCategoryCodes,
        checkedCategoryCodes,
        unresolvedCategoryCodes,
      },
    };
  }
  return { ok: true, evaluation: { outcome: 'NO_MATCH', matches: [], rawMatchCategoryCodes, checkedCategoryCodes, unresolvedCategoryCodes } };
}

function entryMatches(spec: RuleCategorySpec, numberLength: number, entry: { series: string; number: string }, ticket: NormalizedTicket): boolean {
  const match = spec.match;
  if (match.kind === 'SUFFIX') {
    if (entry.number.length !== match.suffixLength || ticket.number.length !== numberLength) return false;
    return ticket.number.endsWith(entry.number);
  }
  if (entry.number !== ticket.number) return false;
  switch (match.seriesPolicy) {
    case 'MATCH_ENTRY':
      return entry.series !== '' && entry.series === ticket.series;
    case 'EXCEPT_ENTRY':
      // Series membership was validated before matching; here only "differs from the entry" remains.
      return entry.series !== '' && ticket.series !== '' && ticket.series !== entry.series;
    case 'ANY_ALLOWED':
      return true;
  }
}

/** Distinct number strings a lookup must load for this ticket: the full number plus each configured suffix length. */
export function candidateNumbers(rules: CompiledRuleSet, ticket: NormalizedTicket): string[] {
  const candidates = new Set<string>([ticket.number]);
  for (const { spec } of rules.categoriesByPriority) {
    if (spec.match.kind === 'SUFFIX' && spec.match.suffixLength <= ticket.number.length) {
      candidates.add(ticket.number.slice(ticket.number.length - spec.match.suffixLength));
    }
  }
  return [...candidates];
}

export type { TicketFieldErrorCode };

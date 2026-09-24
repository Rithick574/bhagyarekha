import type { DrawSummary, MatchSpec } from '@bhagyarekha/contracts';
import type { Messages } from '@/i18n';
import { t } from '@/i18n';

export type StatusKey = 'scheduled' | 'awaiting' | 'partial' | 'published' | 'suspended' | 'cancelled';

/**
 * Maps the server-derived publication status (plus phase and date) to the label
 * a visitor sees. `asOfDate` is the IST calendar date the server used; when
 * missing we fall back to comparing against nothing and treat NOT_PUBLISHED as awaiting.
 */
export function statusKeyFor(draw: Pick<DrawSummary, 'publicationStatus' | 'phase' | 'displayDate'>, asOfDate?: string): StatusKey {
  switch (draw.publicationStatus) {
    case 'CANCELLED':
      return 'cancelled';
    case 'SUSPENDED':
      return 'suspended';
    case 'PARTIAL':
      return 'partial';
    case 'COMPLETE':
      return 'published';
    case 'NOT_PUBLISHED': {
      const upcoming = (draw.phase === 'SCHEDULED' || draw.phase === 'POSTPONED') && asOfDate !== undefined && draw.displayDate >= asOfDate;
      return upcoming ? 'scheduled' : 'awaiting';
    }
  }
}

export function statusLabel(messages: Messages, key: StatusKey): string {
  return messages.status[key];
}

export function isCorrected(draw: Pick<DrawSummary, 'currentRevision'>): boolean {
  return draw.currentRevision?.isCorrection === true;
}

/** Plain-language matching requirement derived from the configured match spec. Never invents rules. */
export function describeMatch(messages: Messages, match: MatchSpec, numberLength: number): string {
  if (match.kind === 'SUFFIX') return t(messages.details.matchSuffix, { n: match.suffixLength });
  switch (match.seriesPolicy) {
    case 'MATCH_ENTRY':
      return t(messages.details.matchFullSeries, { n: numberLength });
    case 'EXCEPT_ENTRY':
      return t(messages.details.matchFullExcept, { n: numberLength });
    case 'ANY_ALLOWED':
      return t(messages.details.matchFullAny, { n: numberLength });
  }
}

/**
 * Filters loaded entries by a typed digit string: exact number match or the
 * number ending with the typed digits. Leading zeros are significant. Non-digit
 * input matches nothing rather than being silently cleaned.
 */
export function filterEntries<T extends { series: string; number: string }>(entries: readonly T[], query: string): T[] {
  const trimmed = query.trim();
  if (trimmed === '') return [...entries];
  if (!/^[0-9]+$/.test(trimmed)) return [];
  return entries.filter((e) => e.number === trimmed || e.number.endsWith(trimmed));
}

import type { StatisticsScope } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import { formatInstant, formatLocalDate } from '@/lib/format';
import { formatCount } from '@/lib/history-stats';
import { TABLE_HEAD_CELL_CLASS, TABLE_HEAD_ROW_CLASS } from '../form-styles';

const REASONS = ['NOT_PUBLISHED', 'SUSPENDED', 'CANCELLED', 'FIRST_PRIZE_INCOMPLETE', 'RULE_UNSUPPORTED', 'INCOMPATIBLE_RULE_VERSION'] as const;

function Item({ label, value, help, testId }: { label: string; value: React.ReactNode; help?: string; testId?: string }) {
  return (
    <div>
      <dt className="text-[0.9rem] font-semibold text-ink-secondary">{label}</dt>
      <dd className="font-semibold" data-testid={testId}>
        {value}
        {help ? <span className="block text-[0.9rem] font-normal text-ink-secondary">{help}</span> : null}
      </dd>
    </div>
  );
}

/** Scope first: what was counted, what was left out and why, before any chart. */
export function ScopePanel({ scope, locale, messages }: { scope: StatisticsScope; locale: Locale; messages: Messages }) {
  const m = messages.statistics;
  return (
    <section aria-labelledby="stats-scope-title" data-testid="stats-scope" className="card px-5 py-5 sm:px-7 sm:py-6">
      <h2 id="stats-scope-title" className="text-[1.35rem] font-bold leading-tight sm:text-[1.5rem]">
        {m.scopeTitle}
      </h2>
      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Item label={m.lottery} value={scope.lotteryName[locale]} />
        <Item label={m.period} value={t(m.periodValue, { from: formatLocalDate(scope.from, locale), to: formatLocalDate(scope.to, locale) })} />
        <Item label={m.observationUnit} value={m.observationUnitValue} testId="stats-observation-unit" />
        <Item label={m.categories} value={<span className="tabular">{scope.categoryCodes.join(', ') || '—'}</span>} />
        <Item label={m.numberLength} value={scope.numberLength === null ? m.numberLengthUnknown : t(m.numberLengthValue, { n: scope.numberLength })} />
        <Item label={m.drawCount} value={<span className="tabular">{formatCount(scope.drawCount, locale)}</span>} testId="stats-draw-count" />
        <Item label={m.observationCount} value={<span className="tabular">{formatCount(scope.observationCount, locale)}</span>} testId="stats-observation-count" />
        <Item label={m.knownDrawCount} value={<span className="tabular">{formatCount(scope.knownDrawCount, locale)}</span>} help={m.knownDrawHelp} testId="stats-known-draw-count" />
      </dl>

      <h3 className="mt-6 text-[1.1rem] font-bold">{m.exclusionsTitle}</h3>
      <table className="mt-2 w-full max-w-xl border-collapse text-left" data-testid="stats-exclusions">
        <caption className="sr-only">{m.exclusionsCaption}</caption>
        <thead>
          <tr className={TABLE_HEAD_ROW_CLASS}>
            <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{m.exclusionReason}</th>
            <th scope="col" className={`${TABLE_HEAD_CELL_CLASS} whitespace-nowrap text-right`}>{m.exclusionCount}</th>
          </tr>
        </thead>
        <tbody>
          {REASONS.map((reason) => (
            <tr key={reason} className="border-b border-line last:border-b-0" data-testid={`exclusion-${reason}`}>
              <th scope="row" className="px-3 py-2.5 font-normal">
                {m.reasons[reason]}
              </th>
              <td className="tabular px-3 py-2.5 text-right font-semibold" data-testid={`exclusion-count-${reason}`}>
                {formatCount(scope.excludedDrawCounts[reason] ?? 0, locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 font-semibold" data-testid="stats-coverage">
        {scope.calendarCoverage === 'UNKNOWN' ? m.coverageUnknown : m.coverageComplete}
      </p>
      <p className="mt-2 text-[0.9rem] text-ink-secondary">
        {m.datasetVersion}: <span className="tabular">{scope.datasetVersion}</span>
        <span aria-hidden="true"> · </span>
        {m.computedAt}: {formatInstant(scope.computedAt, locale)}
      </p>
    </section>
  );
}

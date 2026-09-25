import type { StatisticsResponse } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import { formatCount, formatDecimal, formatShare } from '@/lib/history-stats';
import { TABLE_HEAD_CELL_CLASS, TABLE_HEAD_ROW_CLASS } from '../form-styles';
import { ChartFrame, HorizontalBars, VerticalBars } from './BarChart';
import type { Bar } from './BarChart';

interface SectionProps {
  data: StatisticsResponse;
  locale: Locale;
  messages: Messages;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const ROW_TH = 'px-3 py-2.5 font-semibold';
const CELL = 'tabular px-3 py-2.5 text-right';

function Section({ id, title, children, testId }: { id: string; title: string; children: React.ReactNode; testId: string }) {
  return (
    <section aria-labelledby={`${id}-title`} data-testid={testId} className="card px-5 py-5 sm:px-7 sm:py-6">
      <h2 id={`${id}-title`} className="text-[1.35rem] font-bold leading-tight sm:text-[1.5rem]">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DigitPositionSection({ data, locale, messages }: SectionProps) {
  const m = messages.statistics;
  const n = data.scope.observationCount;
  const positions = data.positionDigitCounts;
  return (
    <Section id="stats-positions" title={m.positionsTitle} testId="stats-positions">
      <p className="mt-3 text-[0.95rem] text-ink-secondary">{t(m.positionsCaption, { n: formatCount(n, locale) })}</p>
      {/* `relative` keeps the sr-only header text inside the scroll container so it cannot widen the page; focusable so keyboard users can scroll it. */}
      <div className="relative mt-3 overflow-x-auto rounded-lg" tabIndex={0} role="region" aria-label={m.positionsTitle}>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{t(m.positionsCaption, { n: formatCount(n, locale) })}</caption>
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              <th scope="col" className={`${TABLE_HEAD_CELL_CLASS} whitespace-nowrap`}>
                {m.position}
              </th>
              {DIGITS.map((d) => (
                <th key={d} scope="col" className={`${TABLE_HEAD_CELL_CLASS} tabular px-1.5 text-right sm:px-3`}>
                  <span className="sr-only">{m.digit} </span>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((counts, index) => (
              <tr key={index} className="border-b border-line last:border-b-0">
                <th scope="row" className={`${ROW_TH} whitespace-nowrap`}>
                  {t(m.positionLabel, { n: index + 1 })}
                </th>
                {DIGITS.map((d, digit) => (
                  <td key={d} className={`${CELL} px-1.5 sm:px-3`}>
                    {formatCount(counts[digit] ?? 0, locale)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ChartFrame label={m.chartLabel}>
        <div className="grid gap-x-6 gap-y-2 md:grid-cols-2">
          {positions.map((counts, index) => (
            <div key={index}>
              <p className="mt-2 text-[0.85rem] font-semibold">{t(m.positionLabel, { n: index + 1 })}</p>
              <VerticalBars height={140} bars={DIGITS.map((d, digit) => ({ label: d, value: counts[digit] ?? 0, valueText: formatCount(counts[digit] ?? 0, locale) }))} />
            </div>
          ))}
        </div>
      </ChartFrame>
    </Section>
  );
}

function CountShareTable({ caption, keyHeader, rows, locale, messages, footnote }: { caption: string; keyHeader: string; rows: { key: string; count: number; share: number | null }[]; locale: Locale; messages: Messages; footnote?: string }) {
  const m = messages.statistics;
  return (
    <table className="mt-4 w-full max-w-2xl border-collapse text-left">
      <caption className="mb-2 text-left text-[0.95rem] text-ink-secondary">
        {caption}
        {footnote ? <span className="block">{footnote}</span> : null}
      </caption>
      <thead>
        <tr className={TABLE_HEAD_ROW_CLASS}>
          <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{keyHeader}</th>
          <th scope="col" className={`${TABLE_HEAD_CELL_CLASS} text-right`}>{m.colCount}</th>
          <th scope="col" className={`${TABLE_HEAD_CELL_CLASS} text-right`}>{m.colShare}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-line last:border-b-0">
            <th scope="row" className={`${ROW_TH} tabular`}>
              {row.key}
            </th>
            <td className={CELL}>{formatCount(row.count, locale)}</td>
            <td className={CELL}>{formatShare(row.share, locale)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function toBars(rows: { key: string; count: number; share: number | null }[], locale: Locale): Bar[] {
  return rows.map((r) => ({ label: r.key, value: r.count, valueText: `${formatCount(r.count, locale)} · ${formatShare(r.share, locale)}` }));
}

export function EndingsSection({ data, locale, messages, which }: SectionProps & { which: 'lastTwo' | 'lastThree' }) {
  const m = messages.statistics;
  const n = formatCount(data.scope.observationCount, locale);
  const block = data[which];
  const title = which === 'lastTwo' ? m.lastTwoTitle : m.lastThreeTitle;
  const caption = t(which === 'lastTwo' ? m.lastTwoCaption : m.lastThreeCaption, { n, distinct: formatCount(block.distinct, locale) });
  const testId = which === 'lastTwo' ? 'stats-last-two' : 'stats-last-three';
  const rows = block.top.slice(0, 20);
  return (
    <Section id={testId} title={title} testId={testId}>
      <CountShareTable caption={caption} keyHeader={m.colEnding} rows={block.top} locale={locale} messages={messages} footnote={block.top.length > 20 ? m.topNote : undefined} />
      {rows.length > 0 ? (
        <ChartFrame label={m.chartLabel}>
          <HorizontalBars bars={toBars(rows, locale)} />
        </ChartFrame>
      ) : null}
    </Section>
  );
}

export function RepeatedSection({ data, locale, messages }: SectionProps) {
  const m = messages.statistics;
  const n = formatCount(data.scope.observationCount, locale);
  const r = data.repeated;
  return (
    <Section id="stats-repeated" title={m.repeatedTitle} testId="stats-repeated">
      <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {[
          [m.distinctNumbers, r.distinctNumbers],
          [m.distinctTickets, r.distinctTickets],
          [m.numberCollisionPairs, r.numberCollisionPairs],
          [m.ticketCollisionPairs, r.ticketCollisionPairs],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt className="text-[0.9rem] font-semibold text-ink-secondary">{label}</dt>
            <dd className="tabular font-semibold">{formatCount(Number(value), locale)}</dd>
          </div>
        ))}
      </dl>
      {r.repeatedNumbers.length > 0 ? (
        <>
          <CountShareTable caption={t(m.repeatedCaption, { n })} keyHeader={m.colNumber} rows={r.repeatedNumbers} locale={locale} messages={messages} />
          <ChartFrame label={m.chartLabel}>
            <HorizontalBars bars={toBars(r.repeatedNumbers.slice(0, 20), locale)} />
          </ChartFrame>
        </>
      ) : (
        <p className="mt-4 text-ink-secondary">{m.noRepeated}</p>
      )}
    </Section>
  );
}

export function ParitySection({ data, locale, messages }: SectionProps) {
  const m = messages.statistics;
  const total = data.scope.observationCount;
  const evenShare = total > 0 ? data.parity.even / total : null;
  const rows = [
    { key: m.odd, count: data.parity.odd, share: data.parity.oddShare },
    { key: m.even, count: data.parity.even, share: evenShare },
  ];
  return (
    <Section id="stats-parity" title={m.parityTitle} testId="stats-parity">
      <CountShareTable caption={t(m.parityCaption, { n: formatCount(total, locale) })} keyHeader={m.parity} rows={rows} locale={locale} messages={messages} />
      <ChartFrame label={m.chartLabel}>
        <HorizontalBars bars={toBars(rows, locale)} />
      </ChartFrame>
    </Section>
  );
}

export function DigitSumSection({ data, locale, messages }: SectionProps) {
  const m = messages.statistics;
  const n = formatCount(data.scope.observationCount, locale);
  const s = data.digitSum;
  return (
    <Section id="stats-digit-sum" title={m.digitSumTitle} testId="stats-digit-sum">
      <dl className="mt-4 grid grid-cols-3 gap-x-6 gap-y-3">
        {[
          [m.min, s.min === null ? '—' : formatCount(s.min, locale)],
          [m.max, s.max === null ? '—' : formatCount(s.max, locale)],
          [m.mean, formatDecimal(s.mean, locale)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[0.9rem] font-semibold text-ink-secondary">{label}</dt>
            <dd className="tabular font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {s.distribution.length > 0 ? (
        <>
          <CountShareTable caption={t(m.digitSumCaption, { n })} keyHeader={m.colSum} rows={s.distribution} locale={locale} messages={messages} />
          <ChartFrame label={m.chartLabel}>
            <HorizontalBars bars={toBars(s.distribution, locale)} rowHeight={26} />
          </ChartFrame>
        </>
      ) : null}
    </Section>
  );
}

export function PatternTiles({ data, locale, messages }: SectionProps) {
  const m = messages.statistics;
  const n = formatCount(data.scope.observationCount, locale);
  const tiles = [
    { id: 'duplicate-digits', label: m.duplicateDigits, ...data.duplicateDigits },
    { id: 'adjacent-equal-digits', label: m.adjacentEqualDigits, ...data.adjacentEqualDigits },
    { id: 'consecutive-runs', label: m.consecutiveRuns, ...data.consecutiveRuns },
  ];
  return (
    <Section id="stats-patterns" title={m.patternsTitle} testId="stats-tiles">
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <li key={tile.id} data-testid={`stats-tile-${tile.id}`} className="rounded-card border border-line bg-[#fbfcfd] px-4 py-4">
            <p className="text-[0.95rem] font-semibold text-ink-secondary">{tile.label}</p>
            <p className="tabular mt-1 text-[1.5rem] font-bold leading-tight">
              {t(m.tileValue, { count: formatCount(tile.count, locale), n })}
              <span className="text-[1.05rem] font-semibold text-ink-secondary">
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, {m.colShare} </span>
                {formatShare(tile.share, locale)}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function NotesSection({ notes, messages }: { notes: string[]; messages: Messages }) {
  const m = messages.statistics;
  return (
    <Section id="stats-notes" title={m.notesTitle} testId="stats-notes">
      {/* Server-supplied definitions and exclusions, rendered verbatim. */}
      <ul className="mt-3 list-disc space-y-2 pl-6 text-ink-secondary" lang="en">
        {notes.map((note, index) => (
          <li key={index}>{note}</li>
        ))}
      </ul>
    </Section>
  );
}

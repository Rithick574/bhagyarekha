import Link from 'next/link';
import type { DrawSummary } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import { formatLocalDate, formatLocalDateShort } from '@/lib/format';
import { isCorrected, statusKeyFor } from '@/lib/status';
import { DrawStatusBadge } from '../DrawStatusBadge';
import { TABLE_HEAD_CELL_CLASS, TABLE_HEAD_ROW_CLASS } from '../form-styles';
import { ArrowRightIcon } from '../Icons';
import { Pagination } from '../Pagination';
import { EmptyState } from '../States';
import { TicketNumber } from '../TicketNumber';

interface Props {
  draws: DrawSummary[];
  total: number;
  page: number;
  pageSize: number;
  locale: Locale;
  messages: Messages;
  dataMode: 'demo' | 'live';
  asOfDate?: string;
  hrefFor: (page: number) => string;
}

function FirstPrizeCell({ draw, messages, size }: { draw: DrawSummary; messages: Messages; size: 'large' | 'medium' }) {
  const entry = draw.firstPrize?.entries[0];
  if (entry) return <TicketNumber series={entry.series} number={entry.number} messages={messages} size={size} />;
  if (draw.publicationStatus === 'SUSPENDED') return <span className="text-ink-secondary">{messages.home.withheld}</span>;
  return <span className="text-ink-secondary">{messages.home.notAvailable}</span>;
}

export function HistoryList({ draws, total, page, pageSize, locale, messages, dataMode, asOfDate, hrefFor }: Props) {
  const m = messages.history;
  if (draws.length === 0) {
    return (
      <div data-testid="history-empty">
        <EmptyState title={m.emptyTitle} body={m.emptyBody} />
      </div>
    );
  }
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = first + draws.length - 1;
  const viewLabel = (draw: DrawSummary) => `${messages.home.viewResult}: ${draw.lotteryName[locale]} ${draw.drawCode}`;

  return (
    <section aria-labelledby="history-results-title" data-testid="history-list" className="card px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="history-results-title" className="text-[1.35rem] font-bold leading-tight sm:text-[1.5rem]">
          {m.resultsTitle}
        </h2>
        <p className="text-[0.95rem] text-ink-secondary" data-testid="history-count">
          {total === 1 ? m.resultCountOne : t(m.resultCount, { total })}
          {total > draws.length ? <span> · {t(m.showing, { first, last, total })}</span> : null}
        </p>
      </div>

      {/* Desktop table */}
      <div className="mt-4 hidden lg:block">
        <table className="w-full border-collapse text-left" data-testid="history-table">
          <caption className="sr-only">{m.resultsTitle}</caption>
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASS}>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{messages.home.colLottery}</th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{m.colDrawCode}</th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{messages.home.colDate}</th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{messages.home.colStatus}</th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{dataMode === 'demo' ? messages.home.colFirstPrizeSample : messages.home.colFirstPrize}</th>
              <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{messages.home.colAction}</th>
            </tr>
          </thead>
          <tbody>
            {draws.map((draw) => (
              <tr key={draw.id} data-testid="history-row" className="border-b border-line last:border-b-0">
                <th scope="row" className="px-3 py-4 align-middle font-semibold">
                  {draw.lotteryName[locale]}
                </th>
                <td className="tabular whitespace-nowrap px-3 py-4 align-middle">{draw.drawCode}</td>
                <td className="px-3 py-4 align-middle">{formatLocalDate(draw.displayDate, locale)}</td>
                <td className="px-3 py-4 align-middle">
                  <DrawStatusBadge status={statusKeyFor(draw, asOfDate)} messages={messages} corrected={isCorrected(draw)} />
                </td>
                <td className="px-3 py-4 align-middle">
                  <FirstPrizeCell draw={draw} messages={messages} size="medium" />
                </td>
                <td className="px-3 py-4 align-middle">
                  <Link href={`/${locale}/results/${draw.id}`} aria-label={viewLabel(draw)} className="touch-target inline-flex items-center gap-2 whitespace-nowrap rounded-control border border-line bg-card px-4 font-semibold text-ink no-underline hover:border-primary hover:text-primary">
                    {messages.home.viewResult}
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile and tablet cards */}
      <ul className="mt-3 divide-y divide-line lg:hidden">
        {draws.map((draw) => (
          <li key={draw.id} data-testid="history-card">
            <Link href={`/${locale}/results/${draw.id}`} aria-label={viewLabel(draw)} className="block py-3 no-underline">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-bold leading-tight text-ink">{draw.lotteryName[locale]}</span>
                  <span className="block text-[0.9rem] text-ink-secondary">
                    <span className="tabular">{draw.drawCode}</span> · {formatLocalDateShort(draw.displayDate, locale)}
                  </span>
                </span>
                <ArrowRightIcon className="mt-1 h-5 w-5 shrink-0 text-ink-secondary" />
              </span>
              <span className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <DrawStatusBadge status={statusKeyFor(draw, asOfDate)} messages={messages} corrected={isCorrected(draw)} />
                <span className="text-right">
                  <FirstPrizeCell draw={draw} messages={messages} size="medium" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Pagination page={page} pages={pages} hrefFor={hrefFor} messages={messages} label={m.pagination} testId="history-pagination" />
    </section>
  );
}

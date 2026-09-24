import Link from 'next/link';
import type { DrawSummary } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { formatLocalDate, formatLocalDateShort } from '@/lib/format';
import { isCorrected, statusKeyFor } from '@/lib/status';
import { DrawStatusBadge } from './DrawStatusBadge';
import { ArrowRightIcon } from './Icons';
import { TicketNumber } from './TicketNumber';

interface Props {
  draws: DrawSummary[];
  locale: Locale;
  messages: Messages;
  dataMode: 'demo' | 'live';
  asOfDate?: string;
}

function FirstPrizeCell({ draw, messages, size = 'large' }: { draw: DrawSummary; messages: Messages; size?: 'large' | 'medium' }) {
  const entry = draw.firstPrize?.entries[0];
  if (entry) return <TicketNumber series={entry.series} number={entry.number} messages={messages} size={size} />;
  if (draw.publicationStatus === 'SUSPENDED') return <span className="text-ink-secondary">{messages.home.withheld}</span>;
  return <span className="text-ink-secondary">{messages.home.notAvailable}</span>;
}

export function RecentDraws({ draws, locale, messages, dataMode, asOfDate }: Props) {
  return (
    <section aria-labelledby="recent-title" data-testid="recent-draws" className="card px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 id="recent-title" className="min-w-0 text-[1.35rem] font-bold leading-tight sm:text-[1.5rem]">
          {messages.home.recentTitle}
        </h2>
        <Link href={`/${locale}/history`} className="touch-target inline-flex items-center gap-1 font-semibold text-primary underline decoration-2 underline-offset-4">
          {messages.home.viewHistory}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </div>

      {draws.length === 0 ? (
        <p className="mt-4 text-ink-secondary">{messages.home.noRecent}</p>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="mt-4 hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#f3f6f8] text-[0.9rem] text-ink-secondary">
                  <th scope="col" className="rounded-l-lg px-4 py-3 font-semibold">{messages.home.colLottery}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{messages.home.colDate}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{dataMode === 'demo' ? messages.home.colFirstPrizeSample : messages.home.colFirstPrize}</th>
                  <th scope="col" className="px-4 py-3 font-semibold">{messages.home.colStatus}</th>
                  <th scope="col" className="rounded-r-lg px-4 py-3 font-semibold">{messages.home.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((draw) => (
                  <tr key={draw.id} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-4 py-4 align-middle font-semibold">
                      <span className="block">{draw.lotteryName[locale]}</span>
                      <span className="block text-[0.85rem] font-normal text-ink-secondary">{draw.drawCode}</span>
                    </th>
                    <td className="px-4 py-4 align-middle">{formatLocalDate(draw.displayDate, locale)}</td>
                    <td className="px-4 py-4 align-middle">
                      <FirstPrizeCell draw={draw} messages={messages} />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <DrawStatusBadge status={statusKeyFor(draw, asOfDate)} messages={messages} corrected={isCorrected(draw)} />
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <Link
                        href={`/${locale}/results/${draw.id}`}
                        className="touch-target inline-flex items-center gap-2 rounded-control border border-line bg-card px-4 font-semibold text-ink no-underline hover:border-primary hover:text-primary"
                      >
                        {messages.home.viewResult}
                        <ArrowRightIcon className="h-4 w-4" />
                        <span className="sr-only">
                          : {draw.lotteryName[locale]} {draw.drawCode}
                        </span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="mt-3 divide-y divide-line lg:hidden">
            {draws.map((draw) => (
              <li key={draw.id}>
                <Link href={`/${locale}/results/${draw.id}`} className="block py-3 no-underline">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-bold leading-tight text-ink">{draw.lotteryName[locale]}</span>
                      <span className="block text-[0.9rem] text-ink-secondary">
                        {draw.drawCode} · {formatLocalDateShort(draw.displayDate, locale)}
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
        </>
      )}
    </section>
  );
}

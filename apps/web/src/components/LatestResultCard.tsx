import Link from 'next/link';
import type { DrawSummary, SourceReference } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import { formatInstant, formatLocalDate, formatMinorAmount } from '@/lib/format';
import { isCorrected, statusKeyFor } from '@/lib/status';
import { DrawStatusBadge, SampleBadge } from './DrawStatusBadge';
import { ArrowRightIcon, ExternalIcon } from './Icons';
import { TicketNumber } from './TicketNumber';

interface Props {
  draw: DrawSummary;
  locale: Locale;
  messages: Messages;
  dataMode: 'demo' | 'live';
  asOfDate?: string;
  source?: SourceReference | null;
  heading?: string;
}

export function LatestResultCard({ draw, locale, messages, dataMode, asOfDate, source, heading }: Props) {
  const status = statusKeyFor(draw, asOfDate);
  const corrected = isCorrected(draw);
  const firstEntry = draw.firstPrize?.entries[0];
  const detailsHref = `/${locale}/results/${draw.id}`;
  const dateLabel = draw.actualDate && draw.scheduledDate && draw.actualDate !== draw.scheduledDate ? messages.home.actualDate : messages.home.drawDate;

  return (
    <article aria-labelledby="latest-title" data-testid="latest-result-card" className="card bg-[linear-gradient(180deg,#f7fbfa_0%,#ffffff_45%)] px-5 py-6 sm:px-7 sm:py-7">
      {heading ? <p className="text-[0.9rem] font-semibold uppercase tracking-wide text-ink-secondary">{heading}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="latest-title" className="text-[1.75rem] font-bold leading-tight sm:text-[2rem]">
            {draw.lotteryName[locale]}
          </h2>
          <p className="mt-1 text-ink-secondary">
            <span>{t(messages.home.draw, { code: draw.drawCode })}</span>
            <span aria-hidden="true"> · </span>
            <span>
              <span className="sr-only">{dateLabel}: </span>
              {formatLocalDate(draw.displayDate, locale)}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dataMode === 'demo' ? <SampleBadge messages={messages} /> : null}
          <DrawStatusBadge status={status} messages={messages} corrected={corrected} />
        </div>
      </div>

      <hr className="my-5 border-line" />

      {draw.firstPrize && firstEntry ? (
        <div>
          <p className="text-[1.05rem] font-semibold text-ink-secondary">
            {messages.home.firstPrizeTicket}
            {draw.firstPrize.amountMinor ? <span className="font-normal"> · {formatMinorAmount(draw.firstPrize.amountMinor, locale)}</span> : null}
          </p>
          <div className="mt-2 flex justify-center py-2 sm:justify-start">
            <TicketNumber series={firstEntry.series} number={firstEntry.number} messages={messages} size="hero" />
          </div>
          {draw.firstPrize.entries.length > 1 ? (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {draw.firstPrize.entries.slice(1).map((entry) => (
                <li key={`${entry.series}-${entry.number}`}>
                  <TicketNumber series={entry.series} number={entry.number} messages={messages} size="large" />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-ink-secondary">{status === 'suspended' ? messages.details.suspendedBody : messages.home.notAvailable}</p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <Link
          href={detailsHref}
          data-testid="view-all-prizes"
          className="touch-target inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-control bg-primary px-6 text-[1.1rem] font-bold text-white no-underline shadow-[0_2px_6px_rgb(8_127_117/0.25)] transition-colors hover:bg-primary-hover"
        >
          {messages.home.viewAllPrizes}
          <ArrowRightIcon className="h-5 w-5" />
        </Link>
        {source?.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer external"
            className="touch-target inline-flex items-center justify-center gap-2 font-semibold text-primary underline decoration-2 underline-offset-4"
          >
            <ExternalIcon className="h-5 w-5" />
            {dataMode === 'demo' ? messages.home.viewSourceSample : messages.home.viewSource}
            <span className="sr-only"> ({messages.a11y.externalLink})</span>
          </a>
        ) : (
          <Link href={`${detailsHref}#sources`} className="touch-target inline-flex items-center justify-center gap-2 font-semibold text-primary underline decoration-2 underline-offset-4">
            <ExternalIcon className="h-5 w-5" />
            {dataMode === 'demo' ? messages.home.viewSourceSample : messages.home.viewSource}
          </Link>
        )}
      </div>

      {draw.currentRevision ? (
        <p className="mt-5 text-[0.9rem] text-ink-secondary">
          {t(messages.home.revisionInfo, { revision: draw.currentRevision.revisionNo, when: formatInstant(draw.currentRevision.publishedAt, locale) })}
        </p>
      ) : null}
    </article>
  );
}

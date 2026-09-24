import Link from 'next/link';
import type { DrawSummary } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import { formatLocalDate } from '@/lib/format';
import { statusKeyFor } from '@/lib/status';
import { DrawStatusBadge } from './DrawStatusBadge';
import { ArrowRightIcon, CalendarIcon, SearchIcon } from './Icons';

export function CheckTicketEntryCard({ locale, messages, drawId }: { locale: Locale; messages: Messages; drawId?: string }) {
  const href = drawId ? `/${locale}/check?draw=${encodeURIComponent(drawId)}` : `/${locale}/check`;
  return (
    <Link href={href} data-testid="check-entry-card" className="card group flex items-center gap-4 px-5 py-5 no-underline transition-shadow hover:shadow-[0_6px_20px_rgb(16_37_47/0.1)]">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <SearchIcon className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[1.25rem] font-bold leading-tight text-ink">{messages.home.checkTitle}</span>
        <span className="mt-1 block text-[0.95rem] leading-snug text-ink-secondary">{messages.home.checkBody}</span>
      </span>
      <ArrowRightIcon className="h-6 w-6 shrink-0 text-ink-secondary transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function PendingDrawCard({ draw, locale, messages, asOfDate }: { draw: DrawSummary; locale: Locale; messages: Messages; asOfDate: string }) {
  const status = statusKeyFor(draw, asOfDate);
  const line = status === 'scheduled' ? t(messages.home.pendingScheduled, { date: formatLocalDate(draw.displayDate, locale) }) : t(messages.home.pendingAwaiting, { date: formatLocalDate(draw.displayDate, locale) });
  return (
    <section aria-labelledby="pending-title" data-testid="pending-draw-card" className="card px-5 py-5">
      <div className="flex items-start gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#eef2f5] text-ink-secondary">
          <CalendarIcon className="h-7 w-7" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="pending-title" className="text-[0.9rem] font-semibold uppercase tracking-wide text-ink-secondary">
            {messages.home.pendingTitle}
          </h2>
          <p className="mt-0.5 text-[1.2rem] font-bold leading-tight">{draw.lotteryName[locale]}</p>
          <p className="text-ink-secondary">{t(messages.home.draw, { code: draw.drawCode })}</p>
          <p className="mt-1 text-[0.95rem] text-ink-secondary">{line}</p>
          <div className="mt-2">
            <DrawStatusBadge status={status} messages={messages} />
          </div>
        </div>
      </div>
    </section>
  );
}

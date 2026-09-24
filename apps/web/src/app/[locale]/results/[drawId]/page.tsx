import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { DrawDetail } from '@bhagyarekha/contracts';
import { DrawStatusBadge, SampleBadge } from '@/components/DrawStatusBadge';
import { ArrowLeftIcon } from '@/components/Icons';
import { Notice } from '@/components/Notices';
import { PrizeCategoryPanel } from '@/components/PrizeCategoryPanel';
import { SourceEvidencePanel } from '@/components/SourceEvidencePanel';
import { EmptyState, UnavailableState } from '@/components/States';
import { TicketNumber } from '@/components/TicketNumber';
import { getMessages, isLocale, t } from '@/i18n';
import type { Locale, Messages } from '@/i18n';
import { getDraw, getResult } from '@/lib/api';
import { formatInstant, formatLocalDate } from '@/lib/format';
import { isCorrected, statusKeyFor } from '@/lib/status';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; drawId: string }>;
type Search = Promise<{ category?: string | string[]; page?: string | string[] }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getMessages(locale).details.title };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function IdentityPanel({ draw, locale, messages, dataMode }: { draw: DrawDetail; locale: Locale; messages: Messages; dataMode: 'demo' | 'live' }) {
  const status = statusKeyFor(draw);
  const postponed = draw.scheduledDate && draw.actualDate && draw.scheduledDate !== draw.actualDate;
  return (
    <header className="card px-5 py-6 sm:px-7" data-testid="draw-identity">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.9rem] font-semibold uppercase tracking-wide text-ink-secondary">{messages.details.title}</p>
          <h1 className="mt-1 text-[1.75rem] font-bold leading-tight sm:text-[2rem]">{draw.lotteryName[locale]}</h1>
          <p className="mt-1 text-[1.1rem] text-ink-secondary">{t(messages.home.draw, { code: draw.drawCode })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dataMode === 'demo' ? <SampleBadge messages={messages} /> : null}
          <DrawStatusBadge status={status} messages={messages} corrected={isCorrected(draw)} />
        </div>
      </div>
      <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {postponed ? (
          <>
            <div>
              <dt className="text-[0.9rem] font-semibold text-ink-secondary">{messages.home.scheduledDate}</dt>
              <dd className="font-semibold">{formatLocalDate(draw.scheduledDate as string, locale)}</dd>
            </div>
            <div>
              <dt className="text-[0.9rem] font-semibold text-ink-secondary">{messages.home.actualDate}</dt>
              <dd className="font-semibold">{formatLocalDate(draw.actualDate as string, locale)}</dd>
            </div>
          </>
        ) : (
          <div>
            <dt className="text-[0.9rem] font-semibold text-ink-secondary">{messages.home.drawDate}</dt>
            <dd className="font-semibold">{formatLocalDate(draw.displayDate, locale)}</dd>
          </div>
        )}
        {draw.actualAt ? (
          <div>
            <dt className="text-[0.9rem] font-semibold text-ink-secondary">{messages.home.actualDate}</dt>
            <dd className="font-semibold">{formatInstant(draw.actualAt, locale)}</dd>
          </div>
        ) : null}
        {draw.currentRevision ? (
          <>
            <div>
              <dt className="text-[0.9rem] font-semibold text-ink-secondary">{messages.details.revision}</dt>
              <dd className="font-semibold">
                {draw.currentRevision.revisionNo}
                {draw.currentRevision.supersededRevisionCount > 0 ? <span className="block text-[0.9rem] font-normal text-ink-secondary">{t(messages.details.supersededCount, { count: draw.currentRevision.supersededRevisionCount })}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-[0.9rem] font-semibold text-ink-secondary">{messages.details.publishedAt}</dt>
              <dd className="font-semibold">{formatInstant(draw.currentRevision.publishedAt, locale)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[0.9rem] font-semibold text-ink-secondary">{messages.details.completeness}</dt>
              <dd className="font-semibold">{draw.currentRevision.completeness === 'COMPLETE' ? messages.details.complete : messages.details.partial}</dd>
            </div>
          </>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-[0.9rem] font-semibold text-ink-secondary">{messages.details.checking}</dt>
          <dd>
            {draw.checking.capability === 'SUPPORTED'
              ? messages.details.checkingSupported
              : draw.checking.capability === 'NOT_APPLICABLE'
                ? messages.details.checkingNotApplicable
                : draw.checking.reasonCode === 'CHECKER_NOT_AVAILABLE'
                  ? messages.details.checkingNotBuilt
                  : messages.details.checkingUnsupported}
          </dd>
        </div>
      </dl>
    </header>
  );
}

export default async function ResultDetailsPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { locale, drawId } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const back = (
    <Link href={`/${locale}`} className="touch-target inline-flex items-center gap-2 font-semibold text-primary underline decoration-2 underline-offset-4">
      <ArrowLeftIcon className="h-5 w-5" />
      {messages.details.backToResults}
    </Link>
  );

  if (!UUID.test(drawId)) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState title={messages.states.drawNotFoundTitle} body={messages.states.drawNotFoundBody} />
      </div>
    );
  }

  const sp = await searchParams;
  const category = first(sp.category);
  const pageRaw = Number.parseInt(first(sp.page) ?? '1', 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const expanded = category !== undefined && /^[A-Z0-9_]{1,32}$/.test(category);

  const detail = await getDraw(drawId);
  if (!detail.ok) {
    if (detail.kind === 'http' && detail.status === 404) {
      return (
        <div className="space-y-4">
          {back}
          <EmptyState title={messages.states.drawNotFoundTitle} body={messages.states.drawNotFoundBody} />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {back}
        <UnavailableState messages={messages} retryHref={`/${locale}/results/${drawId}`} />
      </div>
    );
  }
  const draw = detail.data;
  const dataMode = draw.dataMode;
  const detailsHref = `/${locale}/results/${draw.id}`;

  // Non-result states first: nothing below may look like a verdict.
  if (draw.publicationStatus === 'CANCELLED' || draw.publicationStatus === 'SUSPENDED' || draw.publicationStatus === 'NOT_PUBLISHED') {
    const notice =
      draw.publicationStatus === 'CANCELLED'
        ? { title: messages.details.cancelledTitle, body: messages.details.cancelledBody, tone: 'neutral' as const }
        : draw.publicationStatus === 'SUSPENDED'
          ? { title: messages.details.suspendedTitle, body: messages.details.suspendedBody, tone: 'error' as const }
          : { title: messages.details.notPublishedTitle, body: messages.details.notPublishedBody, tone: 'neutral' as const };
    return (
      <div className="space-y-4">
        {back}
        <IdentityPanel draw={draw} locale={locale} messages={messages} dataMode={dataMode} />
        <Notice tone={notice.tone} title={notice.title} iconTitle={messages.a11y.warningIcon} testId="result-state-notice">
          {notice.body}
        </Notice>
        <SourceEvidencePanel sources={draw.sources} locale={locale} messages={messages} />
      </div>
    );
  }

  const result = await getResult(draw.id, expanded ? { categoryCode: category, page, pageSize: 100 } : { pageSize: 30 });
  if (!result.ok) {
    const changed = result.kind === 'http' && result.status === 409;
    return (
      <div className="space-y-4">
        {back}
        <IdentityPanel draw={draw} locale={locale} messages={messages} dataMode={dataMode} />
        {changed ? (
          <Notice tone="warning" title={messages.details.changedTitle} iconTitle={messages.a11y.warningIcon}>
            {messages.details.changedBody}{' '}
            <Link href={detailsHref} className="font-semibold underline">
              {messages.details.reload}
            </Link>
          </Notice>
        ) : (
          <UnavailableState messages={messages} retryHref={detailsHref} />
        )}
        <SourceEvidencePanel sources={draw.sources} locale={locale} messages={messages} />
      </div>
    );
  }

  const { revision, rule, categories, entries, sources } = result.data;
  const entriesByCode = new Map(entries.map((e) => [e.categoryCode, e]));
  const firstPrize = draw.firstPrize;

  return (
    <div className="space-y-4">
      {back}
      <IdentityPanel draw={draw} locale={locale} messages={messages} dataMode={dataMode} />

      {revision.completeness === 'PARTIAL' ? (
        <Notice tone="warning" title={messages.details.partialTitle} iconTitle={messages.a11y.warningIcon} testId="partial-notice">
          {messages.details.partialBody}
        </Notice>
      ) : null}
      {revision.isCorrection ? (
        <Notice tone="warning" title={messages.details.correctedTitle} iconTitle={messages.a11y.warningIcon} testId="corrected-notice">
          {revision.correctionReason ? t(messages.details.correctedBody, { reason: revision.correctionReason }) : messages.details.correctedNoReason}
        </Notice>
      ) : null}

      {firstPrize && firstPrize.entries.length > 0 ? (
        <section aria-labelledby="fp-title" className="card bg-[linear-gradient(180deg,#f7fbfa_0%,#ffffff_45%)] px-5 py-6 sm:px-7">
          <h2 id="fp-title" className="text-[1.05rem] font-semibold text-ink-secondary">
            {messages.home.firstPrizeTicket}
          </h2>
          <div className="mt-2 flex flex-wrap justify-center gap-x-8 gap-y-2 py-2 sm:justify-start">
            {firstPrize.entries.map((entry) => (
              <TicketNumber key={`${entry.series}-${entry.number}`} series={entry.series} number={entry.number} messages={messages} size="hero" />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="prizes-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="prizes-title" className="text-[1.5rem] font-bold leading-tight">
            {messages.details.prizes}
          </h2>
          <p className="text-[0.95rem] text-ink-secondary">
            {messages.details.numberLength}: {t(messages.details.digits, { n: rule.numberLength })}
            <span aria-hidden="true"> · </span>
            {messages.details.allowedSeries}: <span className="tabular font-semibold text-ink">{rule.allowedSeries.join(', ')}</span>
          </p>
        </div>
        {categories.map((cat) => (
          <div key={cat.code} id={`category-${cat.code}`}>
            <PrizeCategoryPanel category={cat} entries={entriesByCode.get(cat.code) ?? null} numberLength={rule.numberLength} locale={locale} messages={messages} detailsHref={detailsHref} expanded={expanded && category === cat.code} />
          </div>
        ))}
        {expanded ? (
          <Link href={detailsHref} className="touch-target inline-flex items-center gap-2 font-semibold text-primary underline decoration-2 underline-offset-4">
            <ArrowLeftIcon className="h-5 w-5" />
            {messages.details.prizes}
          </Link>
        ) : null}
      </section>

      <SourceEvidencePanel sources={sources.length > 0 ? sources : draw.sources} locale={locale} messages={messages} />

      <Notice tone="info" iconTitle={messages.a11y.infoIcon}>
        {messages.home.pastResultsNotice}
      </Notice>
    </div>
  );
}

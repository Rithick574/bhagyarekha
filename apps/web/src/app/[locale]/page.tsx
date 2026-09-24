import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LatestResultCard } from '@/components/LatestResultCard';
import { Notice } from '@/components/Notices';
import { RecentDraws } from '@/components/RecentDraws';
import { CheckTicketEntryCard, PendingDrawCard } from '@/components/SmallCards';
import { EmptyState, UnavailableState } from '@/components/States';
import { getMessages, isLocale } from '@/i18n';
import { getDraw, getLatest, listDraws } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getMessages(locale).home.title };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);

  const [latest, recent] = await Promise.all([getLatest(), listDraws({ pageSize: 6 })]);

  if (!latest.ok) {
    return (
      <div className="space-y-4">
        <h1 className="sr-only">{messages.home.title}</h1>
        <UnavailableState messages={messages} retryHref={`/${locale}`} />
        <CheckTicketEntryCard locale={locale} messages={messages} />
      </div>
    );
  }

  const { dataMode, latestPublished, pendingDraw, asOfDate } = latest.data;
  // Source reference for the latest card comes from the detail endpoint; failure there is non-fatal.
  const detail = latestPublished ? await getDraw(latestPublished.id) : null;
  const source = detail && detail.ok ? (detail.data.sources[0] ?? null) : null;

  return (
    <div className="space-y-5 lg:space-y-6">
      <h1 className="sr-only">{messages.home.title}</h1>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6">
        <div>
          {latestPublished ? (
            <LatestResultCard draw={latestPublished} locale={locale} messages={messages} dataMode={dataMode} asOfDate={asOfDate} source={source} />
          ) : (
            <EmptyState title={messages.home.noLatestTitle} body={dataMode === 'live' ? messages.states.liveEmptyBody : messages.home.noLatestBody} />
          )}
        </div>
        <div className="flex flex-col gap-5">
          <CheckTicketEntryCard locale={locale} messages={messages} />
          {pendingDraw ? <PendingDrawCard draw={pendingDraw} locale={locale} messages={messages} asOfDate={asOfDate} /> : null}
        </div>
      </div>

      {recent.ok ? (
        <RecentDraws draws={recent.data.items} locale={locale} messages={messages} dataMode={dataMode} asOfDate={asOfDate} />
      ) : (
        <Notice tone="warning" iconTitle={messages.a11y.warningIcon} title={messages.states.unavailableTitle}>
          {messages.states.unavailableBody}
        </Notice>
      )}

      <Notice tone="info" iconTitle={messages.a11y.infoIcon}>
        {messages.home.pastResultsNotice}
      </Notice>
    </div>
  );
}

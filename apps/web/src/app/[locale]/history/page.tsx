import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HistoryFilters } from '@/components/history/HistoryFilters';
import { HistoryList } from '@/components/history/HistoryList';
import { HistoryNumberSearch } from '@/components/history/HistoryNumberSearch';
import { Notice } from '@/components/Notices';
import { UnavailableState } from '@/components/States';
import { getMessages, isLocale, t } from '@/i18n';
import { getLatest, listDraws, listLotteries } from '@/lib/api';
import { buildQuery, firstParam, parseDrawCodeParam, parseLocalDateParam, parsePageParam, parseUuidParam, rangeProblem } from '@/lib/history-stats';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

type Search = Promise<Record<'lottery' | 'from' | 'to' | 'code' | 'page', string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getMessages(locale).history.title };
}

export default async function HistoryPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const m = messages.history;
  const sp = await searchParams;

  // Only identifiers, dates and a draw code are accepted from the URL. Invalid values are dropped, never guessed.
  const raw = { lottery: firstParam(sp.lottery), from: firstParam(sp.from), to: firstParam(sp.to), code: firstParam(sp.code), page: firstParam(sp.page) };
  const lotteryId = parseUuidParam(raw.lottery);
  let from = parseLocalDateParam(raw.from);
  let to = parseLocalDateParam(raw.to);
  const drawCode = parseDrawCodeParam(raw.code);
  const page = parsePageParam(raw.page);

  const ignored: string[] = [];
  if (raw.lottery && !lotteryId) ignored.push(m.lottery);
  if (raw.from && !from) ignored.push(m.from);
  if (raw.to && !to) ignored.push(m.to);
  if (raw.code?.trim() && !drawCode) ignored.push(m.drawCode);
  const fromAfterTo = rangeProblem(from, to) === 'FROM_AFTER_TO';
  if (fromAfterTo) {
    from = undefined;
    to = undefined;
  }

  const filters = { lotteryId, from, to, drawCode };
  const hrefFor = (p: number) => `/${locale}/history${buildQuery({ lottery: lotteryId, from, to, code: drawCode, page: p > 1 ? p : undefined })}`;

  const [lotteries, draws, latest] = await Promise.all([listLotteries({ active: true }), listDraws({ ...filters, page, pageSize: PAGE_SIZE }), getLatest()]);
  const lotteryItems = lotteries.ok ? lotteries.data.items : [];
  const selectedLottery = lotteryId ? lotteryItems.find((l) => l.id === lotteryId) : undefined;
  const asOfDate = latest.ok ? latest.data.asOfDate : undefined;

  return (
    <div className="space-y-4">
      <header className="card px-5 py-6 sm:px-7">
        <h1 className="text-[1.75rem] font-bold leading-tight">{m.title}</h1>
        <p className="mt-2 text-ink-secondary">{m.intro}</p>
      </header>

      <HistoryFilters locale={locale} messages={messages} lotteries={lotteryItems} values={filters} />

      {ignored.length > 0 ? (
        <Notice tone="warning" iconTitle={messages.a11y.warningIcon} testId="history-ignored">
          {t(m.ignoredFilters, { fields: ignored.join(', ') })}
        </Notice>
      ) : null}
      {fromAfterTo ? (
        <Notice tone="warning" iconTitle={messages.a11y.warningIcon} testId="history-from-after-to">
          {m.fromAfterTo}
        </Notice>
      ) : null}
      {selectedLottery ? (
        <Notice tone={selectedLottery.archiveCoverage === 'UNKNOWN' ? 'neutral' : 'info'} iconTitle={messages.a11y.infoIcon} testId="history-coverage-notice">
          {selectedLottery.archiveCoverage === 'UNKNOWN' ? m.coverageUnknown : m.coverageComplete}
        </Notice>
      ) : null}

      {draws.ok ? (
        <HistoryList draws={draws.data.items} total={draws.data.total} page={draws.data.page} pageSize={draws.data.pageSize} locale={locale} messages={messages} dataMode={draws.data.dataMode} asOfDate={asOfDate} hrefFor={hrefFor} />
      ) : (
        <UnavailableState messages={messages} retryHref={hrefFor(page)} />
      )}

      <HistoryNumberSearch locale={locale} messages={messages} lotteries={lotteryItems} initialLotteryId={lotteryId} initialFrom={from} initialTo={to} />

      <Notice tone="info" iconTitle={messages.a11y.infoIcon}>
        {messages.home.pastResultsNotice}
      </Notice>
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Notice } from '@/components/Notices';
import { EmptyState, UnavailableState } from '@/components/States';
import { DigitPositionSection, DigitSumSection, EndingsSection, NotesSection, ParitySection, PatternTiles, RepeatedSection } from '@/components/statistics/MetricSections';
import { ScopePanel } from '@/components/statistics/ScopePanel';
import { StatisticsFilters } from '@/components/statistics/StatisticsFilters';
import { getMessages, isLocale } from '@/i18n';
import type { ApiFailure } from '@/lib/api';
import { getStatistics, listLotteries } from '@/lib/api';
import { buildQuery, defaultStatisticsWindow, firstParam, parseLocalDateParam, parseUuidParam, rangeProblem } from '@/lib/history-stats';

export const dynamic = 'force-dynamic';

type Search = Promise<Record<'lottery' | 'from' | 'to' | 'rule', string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getMessages(locale).statistics.title };
}

type FailureKind = 'mixed-domains' | 'invalid-range' | 'lottery-not-found' | 'unavailable';

function classifyFailure(failure: ApiFailure): FailureKind {
  if (failure.kind !== 'http') return 'unavailable';
  if (failure.status === 404) return 'lottery-not-found';
  if (failure.status === 400) {
    return failure.fields.some((f) => f.path === 'ruleVersionId' && f.code === 'REQUIRED_MIXED_DOMAINS') ? 'mixed-domains' : 'invalid-range';
  }
  return 'unavailable';
}

export default async function StatisticsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Search }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const m = messages.statistics;
  const sp = await searchParams;

  const header = (
    <header className="card px-5 py-6 sm:px-7">
      <h1 className="text-[1.75rem] font-bold leading-tight">{m.title}</h1>
      <p className="mt-2 text-ink-secondary">{m.intro}</p>
    </header>
  );

  const lotteries = await listLotteries({ active: true });
  if (!lotteries.ok) {
    return (
      <div className="space-y-4">
        {header}
        <UnavailableState messages={messages} retryHref={`/${locale}/statistics`} />
      </div>
    );
  }
  const items = lotteries.data.items;
  const defaults = defaultStatisticsWindow();
  const lotteryId = parseUuidParam(firstParam(sp.lottery)) ?? items[0]?.id;
  const from = parseLocalDateParam(firstParam(sp.from)) ?? defaults.from;
  const to = parseLocalDateParam(firstParam(sp.to)) ?? defaults.to;
  const ruleVersionId = parseUuidParam(firstParam(sp.rule));

  if (!lotteryId) {
    return (
      <div className="space-y-4">
        {header}
        <Notice tone="neutral" iconTitle={messages.a11y.infoIcon}>
          {m.noLotteries}
        </Notice>
      </div>
    );
  }

  const filters = <StatisticsFilters locale={locale} messages={messages} lotteries={items} values={{ lotteryId, from, to }} />;
  const nonPredictive = (
    <Notice tone="info" title={m.nonPredictive} iconTitle={messages.a11y.infoIcon} testId="stats-non-predictive" />
  );
  const retryHref = `/${locale}/statistics${buildQuery({ lottery: lotteryId, from, to, rule: ruleVersionId })}`;

  // Mirror the API limits locally so an impossible range gets a plain-language notice, not a raw 400.
  const problem = rangeProblem(from, to);
  const stats = problem ? null : await getStatistics({ lotteryId, from, to, ruleVersionId });

  if (problem || !stats) {
    return (
      <div className="space-y-4">
        {header}
        {filters}
        <Notice tone="warning" iconTitle={messages.a11y.warningIcon} testId="stats-invalid-range">
          {m.invalidRange}
        </Notice>
        {nonPredictive}
      </div>
    );
  }

  if (!stats.ok) {
    const kind = classifyFailure(stats);
    return (
      <div className="space-y-4">
        {header}
        {filters}
        {kind === 'mixed-domains' ? (
          <Notice tone="warning" iconTitle={messages.a11y.warningIcon} testId="stats-mixed-domains">
            {m.mixedDomains}
          </Notice>
        ) : kind === 'invalid-range' ? (
          <Notice tone="warning" iconTitle={messages.a11y.warningIcon} testId="stats-invalid-range">
            {m.invalidRange}
          </Notice>
        ) : kind === 'lottery-not-found' ? (
          <Notice tone="warning" iconTitle={messages.a11y.warningIcon} testId="stats-lottery-not-found">
            {m.lotteryNotFound}
          </Notice>
        ) : (
          <UnavailableState messages={messages} retryHref={retryHref} />
        )}
        {nonPredictive}
      </div>
    );
  }

  const data = stats.data;
  const empty = data.scope.observationCount === 0;
  const sectionProps = { data, locale, messages };

  return (
    <div className="space-y-4">
      {header}
      {filters}
      <ScopePanel scope={data.scope} locale={locale} messages={messages} />
      {nonPredictive}
      {empty ? (
        <div data-testid="stats-empty">
          <EmptyState title={m.emptyTitle} body={m.emptyBody} />
        </div>
      ) : (
        <>
          <DigitPositionSection {...sectionProps} />
          <div className="grid gap-4 lg:grid-cols-2">
            <EndingsSection {...sectionProps} which="lastTwo" />
            <EndingsSection {...sectionProps} which="lastThree" />
          </div>
          <RepeatedSection {...sectionProps} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ParitySection {...sectionProps} />
            <DigitSumSection {...sectionProps} />
          </div>
          <PatternTiles {...sectionProps} />
        </>
      )}
      <NotesSection notes={data.notes} messages={messages} />
    </div>
  );
}

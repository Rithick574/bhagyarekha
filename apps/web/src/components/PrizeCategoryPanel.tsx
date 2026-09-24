'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import type { CategoryEntriesPage, CategoryResult } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import { formatInstant, formatMinorAmount } from '@/lib/format';
import { describeMatch, filterEntries } from '@/lib/status';
import { CheckIcon, WarningIcon } from './Icons';
import { TicketNumber } from './TicketNumber';

interface Props {
  category: CategoryResult;
  entries: CategoryEntriesPage | null;
  numberLength: number;
  locale: Locale;
  messages: Messages;
  detailsHref: string;
  expanded: boolean;
}

function StateChip({ state, messages }: { state: CategoryResult['state']; messages: Messages }) {
  if (state === 'COMPLETE') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe1dd] bg-primary-soft px-3 py-1 text-[0.9rem] font-semibold text-info-ink">
        <CheckIcon className="h-4 w-4" />
        {messages.details.stateComplete}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f1dfae] bg-warning-bg px-3 py-1 text-[0.9rem] font-semibold text-warning-ink">
      <WarningIcon className="h-4 w-4" />
      {state === 'PARTIAL' ? messages.details.statePartial : messages.details.stateMissing}
    </span>
  );
}

export function PrizeCategoryPanel({ category, entries, numberLength, locale, messages, detailsHref, expanded }: Props) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const helpId = useId();
  const items = entries?.items ?? [];
  const filtered = filterEntries(items, query);
  const total = entries?.total ?? category.entryCount;
  const loaded = items.length;
  const pages = entries ? Math.max(1, Math.ceil(entries.total / entries.pageSize)) : 1;
  const page = entries?.page ?? 1;

  return (
    <section aria-labelledby={`${inputId}-title`} data-testid={`category-${category.code}`} className="card px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`${inputId}-title`} className="text-[1.35rem] font-bold leading-tight">
            {category.label[locale]}
          </h3>
          <p className="mt-1 text-ink-secondary">
            <span className="sr-only">{messages.details.amount}: </span>
            {category.amountMinor ? <span className="font-semibold text-ink">{formatMinorAmount(category.amountMinor, locale)}</span> : <span>{messages.details.amountNotRecorded}</span>}
            <span aria-hidden="true"> · </span>
            <span>{total === 1 ? messages.details.entryCountOne : t(messages.details.entryCount, { count: total })}</span>
            {category.expectedEntryCount !== null && category.expectedEntryCount !== total ? <span className="text-warning-ink"> ({t(messages.details.expectedCount, { count: category.expectedEntryCount })})</span> : null}
          </p>
        </div>
        <div>
          <span className="sr-only">{messages.details.categoryState}: </span>
          <StateChip state={category.state} messages={messages} />
        </div>
      </div>

      <p className="mt-3 text-[0.95rem] text-ink-secondary">
        <span className="font-semibold text-ink">{messages.details.matching}: </span>
        {describeMatch(messages, category.match, numberLength)}
      </p>
      {category.sourceReviewedAt ? <p className="mt-1 text-[0.9rem] text-ink-secondary">{t(messages.details.sourceReviewed, { when: formatInstant(category.sourceReviewedAt, locale) })}</p> : null}

      {loaded === 0 ? (
        <p className="mt-4 rounded-control bg-[#f3f6f8] px-4 py-3 text-ink-secondary">{messages.details.noEntries}</p>
      ) : (
        <div className="mt-4">
          {loaded > 3 ? (
            <div className="mb-3">
              <label htmlFor={inputId} className="block font-semibold">
                {messages.details.searchLabel}
              </label>
              <input
                id={inputId}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]*"
                aria-describedby={helpId}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="tabular mt-1 w-full max-w-sm rounded-control border border-line bg-card px-4 py-3 text-[1.1rem] text-ink placeholder:text-ink-secondary"
              />
              <p id={helpId} className="mt-1 text-[0.9rem] text-ink-secondary">
                {messages.details.searchHelp}
              </p>
              <p className="sr-only" aria-live="polite">
                {t(messages.details.searchCount, { shown: filtered.length, total: loaded })}
              </p>
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <p className="rounded-control bg-[#f3f6f8] px-4 py-3 text-ink-secondary" role="status">
              {messages.details.searchNoMatch}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((entry) => (
                <li key={`${entry.series}-${entry.number}`} className="rounded-control border border-line bg-[#fbfcfd] px-4 py-2.5">
                  <TicketNumber series={entry.series} number={entry.number} messages={messages} size="large" />
                  {!entry.series ? <span className="block text-[0.8rem] text-ink-secondary">{messages.a11y.noSeries}</span> : null}
                </li>
              ))}
            </ul>
          )}

          {entries && entries.total > loaded && !expanded ? (
            <Link href={`${detailsHref}?category=${encodeURIComponent(category.code)}&page=1#category-${category.code}`} className="touch-target mt-3 inline-flex items-center rounded-control border border-line px-4 font-semibold text-primary no-underline hover:bg-primary-soft">
              {t(messages.details.showMore, { total: entries.total })}
            </Link>
          ) : null}

          {entries && expanded && pages > 1 ? (
            <nav aria-label={`${category.label[locale]} — ${t(messages.details.pageInfo, { page, pages })}`} className="mt-4 flex flex-wrap items-center gap-3">
              {page > 1 ? (
                <Link href={`${detailsHref}?category=${encodeURIComponent(category.code)}&page=${page - 1}#category-${category.code}`} className="touch-target inline-flex items-center rounded-control border border-line px-4 font-semibold text-primary no-underline hover:bg-primary-soft">
                  {messages.details.prevPage}
                </Link>
              ) : null}
              <span className="text-ink-secondary">{t(messages.details.pageInfo, { page, pages })}</span>
              {page < pages ? (
                <Link href={`${detailsHref}?category=${encodeURIComponent(category.code)}&page=${page + 1}#category-${category.code}`} className="touch-target inline-flex items-center rounded-control border border-line px-4 font-semibold text-primary no-underline hover:bg-primary-soft">
                  {messages.details.nextPage}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </div>
      )}
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { HistorySearchItem, HistorySearchRequest, HistorySearchResponse, LotterySummary } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import type { ClientFailure } from '@/lib/client-api';
import { searchHistory } from '@/lib/client-api';
import { formatLocalDate, formatLocalDateShort } from '@/lib/format';
import { rangeProblem, totalPages } from '@/lib/history-stats';
import { DIGITS_INPUT_CLASS, HELP_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS, SELECT_CLASS, TABLE_HEAD_CELL_CLASS, TABLE_HEAD_ROW_CLASS } from '../form-styles';
import { ArrowLeftIcon, ArrowRightIcon, SearchIcon } from '../Icons';
import { TicketNumber } from '../TicketNumber';

interface Props {
  locale: Locale;
  messages: Messages;
  lotteries: LotterySummary[];
  initialLotteryId?: string;
  initialFrom?: string;
  initialTo?: string;
}

type SearchType = HistorySearchRequest['searchType'];
type FieldError = 'DIGITS' | 'RANGE_TOO_LONG' | 'FROM_AFTER_TO';
type SearchState = { kind: 'idle' } | { kind: 'searching'; page: number } | { kind: 'result'; data: HistorySearchResponse } | { kind: 'failure'; failure: ClientFailure };

const PAGE_SIZE = 20;
const DIGITS = /^[0-9]{1,12}$/;

/**
 * Number search over published results. The digits live only in component
 * memory and travel once in a POST body: never in the URL, storage, history
 * entries or telemetry. A response for an older submission never overwrites a
 * newer one (generation counter), and results are announced politely.
 */
export function HistoryNumberSearch({ locale, messages, lotteries, initialLotteryId, initialFrom, initialTo }: Props) {
  const m = messages.history.search;
  const ids = { type: useId(), number: useId(), lottery: useId(), from: useId(), to: useId(), status: useId() };

  const [searchType, setSearchType] = useState<SearchType>('FULL');
  const [number, setNumber] = useState('');
  const [lotteryId, setLotteryId] = useState(initialLotteryId ?? '');
  const [from, setFrom] = useState(initialFrom ?? '');
  const [to, setTo] = useState(initialTo ?? '');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [state, setState] = useState<SearchState>({ kind: 'idle' });

  const generation = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => inflight.current?.abort(), []);

  const validate = (): FieldError[] => {
    const found: FieldError[] = [];
    if (!DIGITS.test(number.trim())) found.push('DIGITS');
    const problem = rangeProblem(from || undefined, to || undefined);
    if (problem === 'RANGE_TOO_LONG') found.push('RANGE_TOO_LONG');
    if (problem === 'FROM_AFTER_TO') found.push('FROM_AFTER_TO');
    return found;
  };

  const run = async (page: number) => {
    const found = validate();
    setErrors(found);
    if (found.length > 0) return;
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    generation.current += 1;
    const myGeneration = generation.current;
    setState({ kind: 'searching', page });

    const body: HistorySearchRequest = { searchType, number: number.trim(), page, pageSize: PAGE_SIZE };
    if (lotteryId) body.lotteryId = lotteryId;
    if (from) body.from = from;
    if (to) body.to = to;
    const result = await searchHistory(body, controller.signal);
    if (myGeneration !== generation.current || controller.signal.aborted) return;
    inflight.current = null;
    if (result.ok) setState({ kind: 'result', data: result.data });
    else if (result.kind === 'aborted') setState({ kind: 'idle' });
    else setState({ kind: 'failure', failure: result });
    requestAnimationFrame(() => resultsRef.current?.focus());
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(1);
  };

  const errorText = (error: FieldError) => (error === 'DIGITS' ? m.errorDigits : error === 'RANGE_TOO_LONG' ? m.errorRange : m.errorFromAfterTo);
  const busy = state.kind === 'searching';
  const numberError = errors.includes('DIGITS');
  const rangeError = errors.includes('RANGE_TOO_LONG') || errors.includes('FROM_AFTER_TO');

  const statusText = (() => {
    switch (state.kind) {
      case 'idle':
        return '';
      case 'searching':
        return m.searching;
      case 'failure':
        return state.failure.kind === 'http' && state.failure.status === 429 ? m.rateLimited : state.failure.kind === 'http' && state.failure.status === 400 ? m.invalidInput : m.unavailable;
      case 'result': {
        const { total, from: f, to: tt } = state.data;
        const range = { from: formatLocalDate(f, locale), to: formatLocalDate(tt, locale) };
        if (total === 0) return t(m.noMatches, range);
        return total === 1 ? t(m.summaryOne, range) : t(m.summary, { total, ...range });
      }
    }
  })();

  return (
    <section aria-labelledby="history-search-title" data-testid="history-search" className="card px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex items-start gap-3">
        <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary sm:flex">
          <SearchIcon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 id="history-search-title" className="text-[1.35rem] font-bold leading-tight sm:text-[1.5rem]">
            {m.title}
          </h2>
          <p className="mt-1 text-ink-secondary">{m.intro}</p>
        </div>
      </div>

      <form onSubmit={onSubmit} noValidate data-testid="history-search-form" className="mt-5 space-y-4">
        <fieldset>
          <legend className={LABEL_CLASS}>{m.searchType}</legend>
          <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
            {(['FULL', 'SUFFIX'] as const).map((type) => (
              <label key={type} className="inline-flex min-h-12 items-center gap-2 font-medium">
                <input type="radio" name={ids.type} value={type} checked={searchType === type} onChange={() => setSearchType(type)} data-testid={`history-search-type-${type.toLowerCase()}`} className="h-6 w-6 accent-primary" disabled={busy} />
                {type === 'FULL' ? m.full : m.suffix}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor={ids.number} className={LABEL_CLASS}>
              {m.number}
            </label>
            <input
              id={ids.number}
              data-testid="history-search-number"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                setErrors((prev) => prev.filter((x) => x !== 'DIGITS'));
              }}
              aria-describedby={`${ids.number}-help`}
              aria-invalid={numberError || undefined}
              className={DIGITS_INPUT_CLASS}
              disabled={busy}
            />
            <p id={`${ids.number}-help`} className={HELP_CLASS}>
              {numberError ? <span className="font-semibold text-error">{m.errorDigits}</span> : searchType === 'FULL' ? m.numberHelpFull : m.numberHelpSuffix}
            </p>
          </div>
          <div>
            <label htmlFor={ids.lottery} className={LABEL_CLASS}>
              {m.lottery}
            </label>
            <select id={ids.lottery} value={lotteryId} onChange={(e) => setLotteryId(e.target.value)} className={SELECT_CLASS} disabled={busy}>
              <option value="">{messages.history.allLotteries}</option>
              {lotteries.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name[locale]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.from} className={LABEL_CLASS}>
              {m.from}
            </label>
            <input
              id={ids.from}
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setErrors((prev) => prev.filter((x) => x === 'DIGITS'));
              }}
              aria-describedby={`${ids.to}-help`}
              aria-invalid={rangeError || undefined}
              className={INPUT_CLASS}
              disabled={busy}
            />
          </div>
          <div>
            <label htmlFor={ids.to} className={LABEL_CLASS}>
              {m.to}
            </label>
            <input
              id={ids.to}
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setErrors((prev) => prev.filter((x) => x === 'DIGITS'));
              }}
              aria-describedby={`${ids.to}-help`}
              aria-invalid={rangeError || undefined}
              className={INPUT_CLASS}
              disabled={busy}
            />
            <p id={`${ids.to}-help`} className={HELP_CLASS}>
              {rangeError ? <span className="font-semibold text-error">{errorText(errors.find((x) => x !== 'DIGITS') ?? 'RANGE_TOO_LONG')}</span> : m.rangeHelp}
            </p>
          </div>
        </div>

        <button type="submit" disabled={busy} aria-busy={busy || undefined} data-testid="history-search-submit" className={`${PRIMARY_BUTTON_CLASS} w-full sm:w-auto`}>
          <SearchIcon className="h-5 w-5" />
          {m.submit}
        </button>
      </form>

      <div ref={resultsRef} tabIndex={-1} className="mt-5 outline-none" data-testid="history-search-results">
        <p id={ids.status} aria-live="polite" aria-atomic="true" data-testid="history-search-status" className={`min-h-6 font-semibold ${state.kind === 'failure' ? 'text-error' : ''}`}>
          {statusText}
        </p>
        {state.kind === 'result' ? <SearchResults data={state.data} locale={locale} messages={messages} onPage={(p) => void run(p)} busy={busy} /> : null}
      </div>
    </section>
  );
}

function SearchResults({ data, locale, messages, onPage, busy }: { data: HistorySearchResponse; locale: Locale; messages: Messages; onPage: (page: number) => void; busy: boolean }) {
  const m = messages.history.search;
  const pages = totalPages(data.total, data.pageSize);
  const viewLabel = (item: HistorySearchItem) => `${messages.home.viewResult}: ${item.lotteryName[locale]} ${item.drawCode}`;
  return (
    <div className="mt-2 space-y-4">
      {data.total === 0 ? <p className="text-ink-secondary">{m.noMatchesNote}</p> : null}

      {data.items.length > 0 ? (
        <>
          <div className="hidden lg:block">
            <table className="w-full border-collapse text-left" data-testid="history-search-table">
              <caption className="sr-only">{m.resultsTitle}</caption>
              <thead>
                <tr className={TABLE_HEAD_ROW_CLASS}>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{m.colDraw}</th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{m.colDate}</th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{m.colCategory}</th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{m.colEntry}</th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{m.colRevision}</th>
                  <th scope="col" className={TABLE_HEAD_CELL_CLASS}>{m.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={`${item.drawId}-${item.categoryCode}-${item.series}-${item.number}`} data-testid="history-search-row" className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-3 py-3 align-middle font-semibold">
                      <span className="block">{item.lotteryName[locale]}</span>
                      <span className="tabular block text-[0.9rem] font-normal text-ink-secondary">{item.drawCode}</span>
                    </th>
                    <td className="px-3 py-3 align-middle">{formatLocalDate(item.displayDate, locale)}</td>
                    <td className="px-3 py-3 align-middle">{item.categoryLabel[locale]}</td>
                    <td className="px-3 py-3 align-middle">
                      <TicketNumber series={item.series} number={item.number} messages={messages} size="medium" />
                    </td>
                    <td className="tabular px-3 py-3 align-middle">{item.revisionNo}</td>
                    <td className="px-3 py-3 align-middle">
                      <Link href={`/${locale}/results/${item.drawId}`} aria-label={viewLabel(item)} className="touch-target inline-flex items-center gap-2 whitespace-nowrap rounded-control border border-line bg-card px-4 font-semibold text-ink no-underline hover:border-primary hover:text-primary">
                        {messages.home.viewResult}
                        <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line lg:hidden">
            {data.items.map((item) => (
              <li key={`${item.drawId}-${item.categoryCode}-${item.series}-${item.number}`} data-testid="history-search-card">
                <Link href={`/${locale}/results/${item.drawId}`} aria-label={viewLabel(item)} className="block py-3 no-underline">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-bold leading-tight text-ink">{item.lotteryName[locale]}</span>
                      <span className="block text-[0.9rem] text-ink-secondary">
                        <span className="tabular">{item.drawCode}</span> · {formatLocalDateShort(item.displayDate, locale)} · {t(m.revision, { n: item.revisionNo })}
                      </span>
                    </span>
                    <ArrowRightIcon className="mt-1 h-5 w-5 shrink-0 text-ink-secondary" />
                  </span>
                  <span className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="text-ink">{item.categoryLabel[locale]}</span>
                    <TicketNumber series={item.series} number={item.number} messages={messages} size="medium" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {pages > 1 ? (
        <nav aria-label={messages.history.pagination} className="flex flex-wrap items-center justify-between gap-3" data-testid="history-search-pagination">
          <button type="button" onClick={() => onPage(data.page - 1)} disabled={busy || data.page <= 1} className={SECONDARY_BUTTON_CLASS}>
            <ArrowLeftIcon className="h-4 w-4" />
            {messages.details.prevPage}
          </button>
          <p className="text-[0.95rem] text-ink-secondary">{t(messages.details.pageInfo, { page: data.page, pages })}</p>
          <button type="button" onClick={() => onPage(data.page + 1)} disabled={busy || data.page >= pages} className={SECONDARY_BUTTON_CLASS}>
            {messages.details.nextPage}
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </nav>
      ) : null}

      <p className="text-[0.95rem] text-ink-secondary" data-testid="history-search-unsearchable">
        {t(m.unsearchable, { n: data.unsearchableDrawCount })}
      </p>
    </div>
  );
}

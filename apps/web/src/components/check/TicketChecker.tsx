'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { DrawDetail, DrawSummary, LotterySummary, TicketCheckRequest } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import { checkTicket, fetchDrawDetail, fetchLotteryDraws } from '@/lib/client-api';
import { formatLocalDate } from '@/lib/format';
import { statusKeyFor } from '@/lib/status';
import { validateTicketInput, type TicketFieldError, type TicketFormatHint } from '@/lib/ticket-input';
import { SearchIcon } from '../Icons';
import { TicketCheckOutcome, type OutcomeState } from './TicketCheckOutcome';

interface Props {
  locale: Locale;
  messages: Messages;
  lotteries: LotterySummary[];
  initialLotteryId?: string;
  initialDraws?: DrawSummary[];
  initialDraw?: DrawDetail | null;
  /** Lock lottery and draw to `initialDraw` (home page panel). */
  fixedDraw?: boolean;
  asOfDate?: string;
  compact?: boolean;
}

type FormError = TicketFieldError | { path: 'lottery' | 'draw'; code: 'LOTTERY_REQUIRED' | 'DRAW_REQUIRED' };
type ListState = { status: 'idle' | 'loading' | 'ready' | 'error'; items: DrawSummary[] };

const SELECT_CLASS = 'mt-1 w-full rounded-control border border-[#8a9ba8] bg-card px-4 py-3 text-[1.05rem] text-ink';
const INPUT_CLASS = 'tabular mt-1 w-full rounded-control border border-[#8a9ba8] bg-card px-4 py-3 text-[1.25rem] text-ink placeholder:text-ink-secondary';

function formatOf(detail: DrawDetail | null): TicketFormatHint | null {
  return detail?.ticketFormat ? { numberLength: detail.ticketFormat.numberLength, allowedSeries: detail.ticketFormat.allowedSeries } : null;
}

/**
 * Draw context selection + ticket form + outcome. All ticket state lives in
 * component memory only: nothing is written to the URL, storage or logs.
 */
export function TicketChecker({ locale, messages, lotteries, initialLotteryId, initialDraws, initialDraw, fixedDraw = false, asOfDate, compact = false }: Props) {
  const m = messages.check;
  const ids = { lottery: useId(), draw: useId(), series: useId(), number: useId(), errors: useId(), help: useId() };

  const [lotteryId, setLotteryId] = useState(initialDraw?.lotteryId ?? initialLotteryId ?? '');
  const [draws, setDraws] = useState<ListState>({ status: initialDraws ? 'ready' : 'idle', items: initialDraws ?? [] });
  const [drawId, setDrawId] = useState(initialDraw?.id ?? '');
  const [detail, setDetail] = useState<DrawDetail | null>(initialDraw ?? null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [series, setSeries] = useState('');
  const [number, setNumber] = useState('');
  const [errors, setErrors] = useState<FormError[]>([]);
  const [outcome, setOutcome] = useState<OutcomeState>({ kind: 'idle' });

  const generation = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const outcomeRef = useRef<HTMLDivElement>(null);

  const format = formatOf(detail);
  const seriesMode: 'select' | 'none' | 'text' = format ? (format.allowedSeries.length > 0 ? 'select' : 'none') : 'text';

  const invalidateOutcome = useCallback(() => {
    inflight.current?.abort();
    inflight.current = null;
    generation.current += 1;
    setOutcome((prev) => (prev.kind === 'result' || prev.kind === 'failure' ? { kind: 'cleared' } : prev.kind === 'checking' ? { kind: 'idle' } : prev));
  }, []);

  const drawsRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);

  const loadDraws = useCallback((nextLotteryId: string) => {
    drawsRequest.current?.abort();
    if (!nextLotteryId) {
      setDraws({ status: 'idle', items: [] });
      return;
    }
    const controller = new AbortController();
    drawsRequest.current = controller;
    setDraws({ status: 'loading', items: [] });
    void fetchLotteryDraws(nextLotteryId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setDraws(result.ok ? { status: 'ready', items: result.data.items } : { status: 'error', items: [] });
    });
  }, []);

  const loadDetail = useCallback((nextDrawId: string) => {
    detailRequest.current?.abort();
    if (!nextDrawId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    const controller = new AbortController();
    detailRequest.current = controller;
    setDetailLoading(true);
    void fetchDrawDetail(nextDrawId, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      setDetail(result.ok ? result.data : null);
      setDetailLoading(false);
    });
  }, []);

  useEffect(
    () => () => {
      inflight.current?.abort();
      drawsRequest.current?.abort();
      detailRequest.current?.abort();
    },
    [],
  );

  const onLotteryChange = (value: string) => {
    setLotteryId(value);
    setDrawId('');
    setDetail(null);
    setSeries('');
    setErrors([]);
    invalidateOutcome();
    loadDraws(value);
  };
  const onDrawChange = (value: string) => {
    setDrawId(value);
    setDetail(null);
    setSeries('');
    setErrors([]);
    invalidateOutcome();
    loadDetail(value);
  };
  const onSeriesChange = (value: string) => {
    setSeries(value);
    setErrors((prev) => prev.filter((e) => e.path !== 'series'));
    invalidateOutcome();
  };
  const onNumberChange = (value: string) => {
    setNumber(value);
    setErrors((prev) => prev.filter((e) => e.path !== 'number'));
    invalidateOutcome();
  };

  const submit = async (event?: React.FormEvent, options: { skipExpectedRevision?: boolean } = {}) => {
    event?.preventDefault();
    const formErrors: FormError[] = [];
    if (!lotteryId) formErrors.push({ path: 'lottery', code: 'LOTTERY_REQUIRED' });
    if (!drawId) formErrors.push({ path: 'draw', code: 'DRAW_REQUIRED' });
    const validation = validateTicketInput({ series: seriesMode === 'none' ? '' : series, number }, format);
    if (!validation.ok) formErrors.push(...validation.errors);
    if (formErrors.length > 0 || !validation.ok) {
      setErrors(formErrors);
      requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    setErrors([]);

    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    generation.current += 1;
    const myGeneration = generation.current;
    setOutcome({ kind: 'checking' });

    const body: TicketCheckRequest = { lotteryId, drawId, series: validation.value.series, number: validation.value.number };
    if (!options.skipExpectedRevision && detail?.currentRevision?.id && detail.id === drawId) body.expectedRevisionId = detail.currentRevision.id;
    const result = await checkTicket(body, controller.signal);
    // A response for an older submission can never overwrite a newer one.
    if (myGeneration !== generation.current || controller.signal.aborted) return;
    inflight.current = null;
    if (result.ok) {
      setOutcome({ kind: 'result', data: result.data });
    } else if (result.kind === 'aborted') {
      setOutcome({ kind: 'idle' });
    } else {
      if (result.kind === 'http' && result.fields.length > 0) {
        const mapped: FormError[] = result.fields
          .filter((f): f is { path: 'series' | 'number'; code: string } => f.path === 'series' || f.path === 'number')
          .map((f) => ({ path: f.path, code: (isTicketFieldCode(f.code) ? f.code : 'DIGITS_REQUIRED') as TicketFieldError['code'] }));
        if (mapped.length > 0) {
          setErrors(mapped);
          setOutcome({ kind: 'idle' });
          requestAnimationFrame(() => errorSummaryRef.current?.focus());
          return;
        }
      }
      setOutcome({ kind: 'failure', failure: result });
    }
    requestAnimationFrame(() => outcomeRef.current?.focus());
  };

  const onCheckAgain = () => {
    // Re-check against whatever revision is current now; refresh the hint in parallel.
    if (drawId) loadDetail(drawId);
    void submit(undefined, { skipExpectedRevision: true });
  };

  const errorText = (error: FormError): string => {
    const table = m.fieldErrors as Record<string, string>;
    const template = table[error.code] ?? m.fieldErrors.UNKNOWN;
    return t(template, { n: format?.numberLength ?? '' });
  };
  const fieldError = (path: FormError['path']) => errors.find((e) => e.path === path);
  const fieldIdFor = (path: FormError['path']) => (path === 'lottery' ? ids.lottery : path === 'draw' ? ids.draw : path === 'series' ? ids.series : ids.number);
  const busy = outcome.kind === 'checking';

  return (
    <div className="space-y-4" data-testid="ticket-checker">
      <form onSubmit={submit} noValidate aria-describedby={ids.help} className={`card px-5 ${compact ? 'py-5' : 'py-6 sm:px-7'}`} data-testid="ticket-check-form">
        <div className="flex items-start gap-3">
          {!compact ? (
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary sm:flex">
              <SearchIcon className="h-6 w-6" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-[1.5rem] font-bold leading-tight">{m.title}</h2>
            <p id={ids.help} className="mt-1 text-ink-secondary">
              {m.intro}
            </p>
          </div>
        </div>

        {errors.length > 0 ? (
          <div ref={errorSummaryRef} tabIndex={-1} role="alert" data-testid="check-error-summary" className="mt-4 rounded-card border border-[#f5c6c0] bg-error-bg px-4 py-3 text-error">
            <p className="font-bold">{m.errorSummary}</p>
            <ul className="mt-1 list-disc pl-5">
              {errors.map((error) => (
                <li key={`${error.path}-${error.code}`}>
                  <a href={`#${fieldIdFor(error.path)}`} className="font-semibold underline">
                    {errorText(error)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {fixedDraw && detail ? (
            <div className="rounded-card border border-line bg-[#fbfcfd] px-4 py-3" data-testid="fixed-draw">
              <p className="text-[0.9rem] font-semibold text-ink-secondary">{m.fixedDraw}</p>
              <p className="font-bold">{detail.lotteryName[locale]}</p>
              <p className="text-ink-secondary">
                {t(messages.home.draw, { code: detail.drawCode })} · {formatLocalDate(detail.displayDate, locale)}
              </p>
              <Link href={`/${locale}/check`} className="touch-target mt-1 inline-flex items-center font-semibold text-primary underline decoration-2 underline-offset-4">
                {m.chooseDifferentDraw}
              </Link>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor={ids.lottery} className="block font-semibold">
                  {m.lottery}
                </label>
                <select id={ids.lottery} value={lotteryId} onChange={(e) => onLotteryChange(e.target.value)} className={SELECT_CLASS} aria-invalid={fieldError('lottery') ? true : undefined} disabled={busy}>
                  <option value="">{m.lotteryPlaceholder}</option>
                  {lotteries.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name[locale]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={ids.draw} className="block font-semibold">
                  {m.draw}
                </label>
                <select
                  id={ids.draw}
                  value={drawId}
                  onChange={(e) => onDrawChange(e.target.value)}
                  className={SELECT_CLASS}
                  aria-describedby={`${ids.draw}-help`}
                  aria-invalid={fieldError('draw') ? true : undefined}
                  disabled={busy || !lotteryId || draws.status === 'loading'}
                >
                  <option value="">{draws.status === 'loading' ? m.drawsLoading : m.drawPlaceholder}</option>
                  {draws.items.map((d) => (
                    <option key={d.id} value={d.id}>
                      {t(m.drawOption, { code: d.drawCode, date: formatLocalDate(d.displayDate, locale), status: messages.status[statusKeyFor(d, asOfDate)] })}
                    </option>
                  ))}
                </select>
                <p id={`${ids.draw}-help`} className="mt-1 text-[0.9rem] text-ink-secondary">
                  {draws.status === 'error' ? m.drawsUnavailable : draws.status === 'ready' && draws.items.length === 0 ? m.noDraws : m.drawHelp}
                </p>
              </div>
            </>
          )}

          {seriesMode !== 'none' ? (
            <div>
              <label htmlFor={ids.series} className="block font-semibold">
                {m.series}
              </label>
              {seriesMode === 'select' && format ? (
                <select id={ids.series} data-testid="series-select" value={series} onChange={(e) => onSeriesChange(e.target.value)} className={`${SELECT_CLASS} tabular`} aria-describedby={`${ids.series}-help`} aria-invalid={fieldError('series') ? true : undefined} disabled={busy}>
                  <option value="">{m.seriesPlaceholder}</option>
                  {format.allowedSeries.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <input id={ids.series} data-testid="series-input" type="text" value={series} onChange={(e) => onSeriesChange(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={8} className={`${INPUT_CLASS} uppercase`} aria-describedby={`${ids.series}-help`} aria-invalid={fieldError('series') ? true : undefined} disabled={busy} />
              )}
              <p id={`${ids.series}-help`} className="mt-1 text-[0.9rem] text-ink-secondary">
                {fieldError('series') ? <span className="font-semibold text-error">{errorText(fieldError('series') as FormError)}</span> : seriesMode === 'select' ? m.seriesHelp : m.seriesFree}
              </p>
            </div>
          ) : null}

          <div>
            <label htmlFor={ids.number} className="block font-semibold">
              {m.number}
            </label>
            <input
              id={ids.number}
              data-testid="number-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              maxLength={format?.numberLength ?? 12}
              value={number}
              onChange={(e) => onNumberChange(e.target.value)}
              placeholder={format ? '0'.repeat(format.numberLength) : undefined}
              className={INPUT_CLASS}
              aria-describedby={`${ids.number}-help`}
              aria-invalid={fieldError('number') ? true : undefined}
              disabled={busy}
            />
            <p id={`${ids.number}-help`} className="mt-1 text-[0.9rem] text-ink-secondary">
              {fieldError('number') ? <span className="font-semibold text-error">{errorText(fieldError('number') as FormError)}</span> : format ? t(m.numberHelp, { n: format.numberLength }) : m.numberHelpUnknown}
            </p>
          </div>

          <button
            type="submit"
            disabled={busy || detailLoading}
            aria-busy={busy || undefined}
            data-testid="check-submit"
            className="touch-target inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-control bg-primary px-6 text-[1.1rem] font-bold text-white shadow-[0_2px_6px_rgb(8_127_117/0.25)] transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
          >
            <SearchIcon className="h-5 w-5" />
            {m.submit}
            {busy ? <span className="sr-only"> {m.checking}</span> : null}
          </button>
          <p className="text-center text-[0.9rem] text-ink-secondary">{m.privacy}</p>
        </div>
      </form>

      <div ref={outcomeRef} tabIndex={-1} aria-live="polite" aria-atomic="true" className="outline-none" data-testid="check-outcome-region">
        <TicketCheckOutcome state={outcome} locale={locale} messages={messages} onCheckAgain={onCheckAgain} />
      </div>
    </div>
  );
}

const TICKET_FIELD_CODES = new Set(['EMPTY', 'DIGITS_REQUIRED', 'INTERNAL_WHITESPACE', 'LETTERS_REQUIRED', 'TOO_LONG', 'SERIES_NOT_ALLOWED', 'SERIES_REQUIRED', 'WRONG_LENGTH', 'FIRST_DIGIT_NOT_ALLOWED']);
function isTicketFieldCode(code: string): boolean {
  return TICKET_FIELD_CODES.has(code);
}

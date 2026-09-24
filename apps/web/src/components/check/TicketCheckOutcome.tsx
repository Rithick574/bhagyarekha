'use client';

import Link from 'next/link';
import type { TicketCheckResponse } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import type { ClientFailure } from '@/lib/client-api';
import { formatInstant, formatLocalDate, formatMinorAmount } from '@/lib/format';
import { CheckIcon, ClockIcon, CrossIcon, InfoIcon, PauseIcon, WarningIcon } from '../Icons';
import { SourceEvidencePanel } from '../SourceEvidencePanel';

export type OutcomeState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'result'; data: TicketCheckResponse }
  | { kind: 'failure'; failure: ClientFailure }
  | { kind: 'cleared' };

type Tone = 'match' | 'nomatch' | 'provisional' | 'neutral' | 'error';

const TONE_CLASS: Record<Tone, string> = {
  match: 'border-[#bfe1dd] bg-primary-soft text-info-ink',
  nomatch: 'border-line bg-[#eef2f5] text-ink',
  provisional: 'border-[#f1dfae] bg-warning-bg text-warning-ink',
  neutral: 'border-line bg-[#eef2f5] text-ink',
  error: 'border-[#f5c6c0] bg-error-bg text-error',
};

const TONE_ICON: Record<Tone, typeof CheckIcon> = {
  match: CheckIcon,
  nomatch: CrossIcon,
  provisional: WarningIcon,
  neutral: InfoIcon,
  error: PauseIcon,
};

interface Props {
  state: OutcomeState;
  locale: Locale;
  messages: Messages;
  onCheckAgain: () => void;
}

function Headline({ tone, title, body, testId }: { tone: Tone; title: string; body: string; testId: string }) {
  const Icon = TONE_ICON[tone];
  return (
    <div className={`rounded-card border px-4 py-4 ${TONE_CLASS[tone]}`} data-testid={testId} data-tone={tone}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-7 w-7 shrink-0" />
        <div className="min-w-0">
          <p className="text-[1.2rem] font-bold leading-snug">{title}</p>
          <p className="mt-1 leading-snug">{body}</p>
        </div>
      </div>
    </div>
  );
}

function outcomePresentation(data: TicketCheckResponse, locale: Locale, messages: Messages): { tone: Tone; title: string; body: string } {
  const m = messages.check;
  const labelFor = (code: string) => data.categories.find((c) => c.code === code)?.label[locale] ?? code;
  const matchCode = data.matches[0]?.categoryCode;
  switch (data.outcome) {
    case 'MATCH':
      return { tone: 'match', title: m.matchTitle, body: t(m.matchBody, { category: matchCode ? labelFor(matchCode) : '' }) };
    case 'NO_MATCH':
      return { tone: 'nomatch', title: m.noMatchTitle, body: m.noMatchBody };
    case 'PARTIAL_MATCH':
      return { tone: 'provisional', title: m.partialMatchTitle, body: t(m.partialMatchBody, { category: matchCode ? labelFor(matchCode) : '' }) };
    case 'RESULT_INCOMPLETE':
      return { tone: 'provisional', title: m.incompleteTitle, body: m.incompleteBody };
    case 'RESULT_NOT_PUBLISHED':
      return { tone: 'neutral', title: m.notPublishedTitle, body: m.notPublishedBody };
    case 'RULES_UNSUPPORTED':
      return { tone: 'neutral', title: m.unsupportedTitle, body: m.unsupportedBody };
    case 'RESULT_SUSPENDED':
      return { tone: 'error', title: m.suspendedTitle, body: m.suspendedBody };
    case 'DRAW_CANCELLED':
      return { tone: 'neutral', title: m.cancelledTitle, body: m.cancelledBody };
  }
}

function failurePresentation(failure: ClientFailure, messages: Messages): { tone: Tone; title: string; body: string; retry: boolean } {
  const m = messages.check;
  if (failure.kind === 'http') {
    switch (failure.code) {
      case 'INVALID_INPUT':
      case 'INVALID_SERIES':
      case 'INVALID_NUMBER_LENGTH':
        return { tone: 'error', title: m.inputErrorTitle, body: m.inputErrorBody, retry: false };
      case 'DRAW_MISMATCH':
        return { tone: 'error', title: m.inputErrorTitle, body: m.drawMismatchBody, retry: false };
      case 'DRAW_NOT_FOUND':
        return { tone: 'error', title: m.inputErrorTitle, body: m.drawNotFoundBody, retry: false };
      case 'RESULT_CHANGED':
        return { tone: 'provisional', title: m.changedTitle, body: m.changedBody, retry: true };
      case 'RATE_LIMITED':
        return { tone: 'neutral', title: m.rateLimitedTitle, body: m.rateLimitedBody, retry: true };
      default:
        return { tone: 'error', title: m.unavailableTitle, body: m.unavailableBody, retry: true };
    }
  }
  return { tone: 'error', title: m.unavailableTitle, body: m.unavailableBody, retry: true };
}

/** Exhaustive rendering of every check outcome and transport failure. Never shows the ticket. */
export function TicketCheckOutcome({ state, locale, messages, onCheckAgain }: Props) {
  const m = messages.check;
  if (state.kind === 'idle') return null;

  if (state.kind === 'checking') {
    return (
      <div className="card flex items-center gap-3 px-5 py-4" data-testid="check-outcome" data-outcome="checking">
        <ClockIcon className="h-6 w-6 shrink-0 text-ink-secondary" />
        <p className="font-semibold">{m.checking}</p>
      </div>
    );
  }

  if (state.kind === 'cleared') {
    return (
      <div className="card flex items-center gap-3 px-5 py-4 text-ink-secondary" data-testid="check-outcome" data-outcome="cleared">
        <InfoIcon className="h-6 w-6 shrink-0" />
        <p>{m.outcomeCleared}</p>
      </div>
    );
  }

  if (state.kind === 'failure') {
    const p = failurePresentation(state.failure, messages);
    return (
      <section aria-labelledby="outcome-title" className="card space-y-4 px-5 py-5 sm:px-6" data-testid="check-outcome" data-outcome={state.failure.kind === 'http' ? (state.failure.code ?? `HTTP_${state.failure.status}`) : state.failure.kind.toUpperCase()}>
        <h2 id="outcome-title" className="text-[1.35rem] font-bold leading-tight">
          {m.outcomeHeading}
        </h2>
        <Headline tone={p.tone} title={p.title} body={p.body} testId="check-headline" />
        {p.retry ? (
          <button type="button" onClick={onCheckAgain} className="touch-target inline-flex items-center justify-center rounded-control border border-line bg-card px-5 font-semibold text-primary hover:bg-primary-soft">
            {m.checkAgain}
          </button>
        ) : null}
        <p className="text-[0.9rem] text-ink-secondary">{m.reminder}</p>
      </section>
    );
  }

  const data = state.data;
  const p = outcomePresentation(data, locale, messages);
  const labelFor = (code: string) => data.categories.find((c) => c.code === code)?.label[locale] ?? code;
  const match = data.matches[0];
  const draw = data.draw;

  return (
    <section aria-labelledby="outcome-title" className="card space-y-5 px-5 py-5 sm:px-6" data-testid="check-outcome" data-outcome={data.outcome}>
      <h2 id="outcome-title" className="text-[1.35rem] font-bold leading-tight">
        {m.outcomeHeading}
      </h2>

      <Headline tone={p.tone} title={p.title} body={p.body} testId="check-headline" />

      {match ? (
        <dl className="grid gap-x-8 gap-y-3 rounded-card border border-line bg-[#fbfcfd] px-4 py-4 sm:grid-cols-2" data-testid="check-match">
          <div>
            <dt className="text-[0.9rem] font-semibold text-ink-secondary">{match.awardConfirmed ? m.matchedCategory : m.provisionalCategory}</dt>
            <dd className="text-[1.2rem] font-bold">{labelFor(match.categoryCode)}</dd>
          </div>
          <div>
            <dt className="text-[0.9rem] font-semibold text-ink-secondary">{m.prizeAmount}</dt>
            <dd className="text-[1.2rem] font-bold">{match.awardConfirmed && match.amountMinor ? formatMinorAmount(match.amountMinor, locale) : <span className="text-[1rem] font-semibold text-warning-ink">{m.amountUnresolved}</span>}</dd>
          </div>
        </dl>
      ) : null}

      <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        <div>
          <dt className="text-[0.9rem] font-semibold text-ink-secondary">{m.drawChecked}</dt>
          <dd className="font-semibold">
            {draw.lotteryName[locale]}
            <span className="block font-normal text-ink-secondary">
              {t(messages.home.draw, { code: draw.drawCode })} · {formatLocalDate(draw.displayDate, locale)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-[0.9rem] font-semibold text-ink-secondary">{m.revisionChecked}</dt>
          <dd className="font-semibold">{draw.currentRevision && data.resultRevisionId ? draw.currentRevision.revisionNo : m.revisionUnknown}</dd>
        </div>
        <div>
          <dt className="text-[0.9rem] font-semibold text-ink-secondary">{m.checkedAt}</dt>
          <dd className="font-semibold">{formatInstant(data.checkedAt, locale)}</dd>
        </div>
        {data.categories.length > 0 ? (
          <>
            <div>
              <dt className="text-[0.9rem] font-semibold text-ink-secondary">{m.categoriesChecked}</dt>
              <dd className="font-semibold">{data.checkedCategoryCodes.length > 0 ? data.checkedCategoryCodes.map(labelFor).join(', ') : m.none}</dd>
            </div>
            <div>
              <dt className="text-[0.9rem] font-semibold text-ink-secondary">{m.categoriesUnresolved}</dt>
              <dd className={`font-semibold ${data.unresolvedCategoryCodes.length > 0 ? 'text-warning-ink' : ''}`} data-testid="check-unresolved">
                {data.unresolvedCategoryCodes.length > 0 ? data.unresolvedCategoryCodes.map(labelFor).join(', ') : m.none}
              </dd>
            </div>
          </>
        ) : null}
      </dl>

      <div className="flex flex-wrap gap-3">
        <Link href={`/${locale}/results/${draw.id}`} className="touch-target inline-flex items-center justify-center rounded-control border border-line bg-card px-5 font-semibold text-primary no-underline hover:bg-primary-soft">
          {m.viewFullResult}
        </Link>
        <button type="button" onClick={onCheckAgain} className="touch-target inline-flex items-center justify-center rounded-control border border-line bg-card px-5 font-semibold text-primary hover:bg-primary-soft">
          {m.checkAgain}
        </button>
      </div>

      {data.sources.length > 0 ? <SourceEvidencePanel sources={data.sources} locale={locale} messages={messages} /> : null}

      <p className="text-[0.9rem] text-ink-secondary" data-testid="check-reminder">
        {m.reminder}
      </p>
    </section>
  );
}

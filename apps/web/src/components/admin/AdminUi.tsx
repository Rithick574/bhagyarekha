'use client';

import { useEffect, useId, useRef, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { Messages } from '@/i18n';
import { t } from '@/i18n';
import type { AdminFailure } from '@/lib/admin-api';
import { CheckIcon, WarningIcon } from '../Icons';

export const FIELD_CLASS = 'mt-1 w-full rounded-control border border-[#8a9ba8] bg-card px-3 py-2.5 text-[1rem] text-ink disabled:bg-[#eef2f5]';
export const BTN_PRIMARY = 'touch-target inline-flex items-center justify-center gap-2 rounded-control bg-primary px-5 font-semibold text-white no-underline hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60';
export const BTN_SECONDARY = 'touch-target inline-flex items-center justify-center gap-2 rounded-control border border-line bg-card px-4 font-semibold text-primary no-underline hover:bg-primary-soft hover:text-primary-hover disabled:cursor-not-allowed disabled:opacity-60';
export const BTN_DANGER = 'touch-target inline-flex items-center justify-center gap-2 rounded-control border border-[#f5c6c0] bg-card px-4 font-semibold text-error no-underline hover:bg-error-bg disabled:cursor-not-allowed disabled:opacity-60';

export function Field({ label, help, error, children, id, required }: { label: string; help?: string; error?: string | null; children: (id: string, describedBy: string | undefined) => ReactNode; id?: string; required?: boolean }) {
  const generated = useId();
  const fieldId = id ?? generated;
  const helpId = `${fieldId}-help`;
  const describedBy = help || error ? helpId : undefined;
  return (
    <div>
      <label htmlFor={fieldId} className="block font-semibold">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children(fieldId, describedBy)}
      {error ? (
        <p id={helpId} className="mt-1 text-[0.9rem] font-semibold text-error">
          {error}
        </p>
      ) : help ? (
        <p id={helpId} className="mt-1 text-[0.9rem] text-ink-secondary">
          {help}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_CLASS} ${props.className ?? ''}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${FIELD_CLASS} ${props.className ?? ''}`} />;
}
export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${FIELD_CLASS} font-mono text-[0.9rem] ${props.className ?? ''}`} />;
}

/** Maps a transport failure to localized text. Field-level codes are listed so the operator knows what to fix. */
export function failureText(failure: AdminFailure, messages: Messages): string {
  const e = messages.admin.errors;
  if (failure.kind === 'network') return e.network;
  if (failure.kind === 'invalid-response') return e.unexpected;
  switch (failure.status) {
    case 401:
      return e.unauthenticated;
    case 403:
      return failure.code === 'CSRF_FAILED' ? e.csrf : e.forbidden;
    case 409:
      return failure.code === 'IDEMPOTENCY_CONFLICT' ? e.idempotency : e.conflict;
    case 413:
      return e.tooLarge;
    case 429:
      return e.rateLimited;
    case 400: {
      const fields = failure.fields.map((f) => `${f.path}: ${f.code}`).join(', ');
      const base = failure.message ?? e.invalid;
      return fields ? `${base} (${e.fieldErrorPrefix}: ${fields})` : base;
    }
    default:
      return failure.message ?? e.unexpected;
  }
}

export function FailureBanner({ failure, messages, onReload }: { failure: AdminFailure | null; messages: Messages; onReload?: () => void }) {
  if (!failure) return null;
  const isConflict = failure.kind === 'http' && failure.status === 409;
  return (
    <div role="alert" data-testid="admin-failure" data-status={failure.kind === 'http' ? failure.status : failure.kind} className="rounded-card border border-[#f5c6c0] bg-error-bg px-4 py-3 text-error">
      <div className="flex items-start gap-3">
        <WarningIcon className="mt-0.5 h-6 w-6 shrink-0" title={messages.a11y.warningIcon} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{failureText(failure, messages)}</p>
          {isConflict && onReload ? (
            <button type="button" onClick={onReload} className={`${BTN_SECONDARY} mt-2`}>
              {messages.admin.errors.reload}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SuccessNotice({ text, testId }: { text: string | null; testId?: string }) {
  if (!text) return null;
  return (
    <div role="status" data-testid={testId ?? 'admin-success'} className="rounded-card border border-[#bfe1dd] bg-primary-soft px-4 py-3 text-info-ink">
      <div className="flex items-start gap-3">
        <CheckIcon className="mt-0.5 h-6 w-6 shrink-0" />
        <p className="font-semibold">{text}</p>
      </div>
    </div>
  );
}

/**
 * Accessible confirmation dialog built on the native <dialog>. Focus moves into
 * the dialog on open and returns to the opener on close.
 */
export function ConfirmDialog({ open, title, onClose, children, testId }: { open: boolean; title: string; onClose: () => void; children: ReactNode; testId?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose} aria-labelledby={`${testId ?? 'dialog'}-title`} data-testid={testId} className="card m-auto w-[min(36rem,calc(100vw-2rem))] p-0 backdrop:bg-[rgb(16_37_47/0.5)]">
      {open ? (
        <div className="px-5 py-5 sm:px-6">
          <h2 id={`${testId ?? 'dialog'}-title`} className="text-[1.3rem] font-bold leading-snug">
            {title}
          </h2>
          <div className="mt-3 space-y-4">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

export function StateBadge({ label, tone }: { label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const cls = { neutral: 'bg-[#eef2f5] text-ink-secondary border-line', good: 'bg-primary-soft text-info-ink border-[#bfe1dd]', warn: 'bg-warning-bg text-warning-ink border-[#f1dfae]', bad: 'bg-error-bg text-error border-[#f5c6c0]' }[tone];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-[0.85rem] font-semibold leading-tight ${cls}`}>{label}</span>;
}

export function Pager({ page, hasNext, onPage, messages }: { page: number; hasNext: boolean; onPage: (p: number) => void; messages: Messages }) {
  return (
    <nav className="mt-3 flex items-center gap-3" aria-label={t(messages.admin.common.page, { page })}>
      <button type="button" className={BTN_SECONDARY} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        {messages.admin.common.prev}
      </button>
      <span className="text-ink-secondary">{t(messages.admin.common.page, { page })}</span>
      <button type="button" className={BTN_SECONDARY} disabled={!hasNext} onClick={() => onPage(page + 1)}>
        {messages.admin.common.next}
      </button>
    </nav>
  );
}

// min-width keeps dense operator tables legible: on narrow screens they scroll inside their overflow-x-auto wrapper instead of collapsing.
export const TABLE_CLASS = 'w-full min-w-[44rem] border-collapse text-left text-[0.95rem] [overflow-wrap:normal]';
export const TH_CLASS = 'border-b border-line bg-[#f1f5f8] px-3 py-2 font-semibold text-ink-secondary';
export const TD_CLASS = 'border-b border-line px-3 py-2 align-top';

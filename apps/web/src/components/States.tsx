import Link from 'next/link';
import type { Messages } from '@/i18n';
import { ArrowLeftIcon, WarningIcon } from './Icons';

export function UnavailableState({ messages, retryHref }: { messages: Messages; retryHref: string }) {
  return (
    <section aria-labelledby="unavailable-title" data-testid="unavailable-state" className="card px-5 py-6 sm:px-7">
      <div className="flex items-start gap-3">
        <WarningIcon className="mt-1 h-7 w-7 shrink-0 text-error" title={messages.a11y.warningIcon} />
        <div>
          <h2 id="unavailable-title" className="text-[1.35rem] font-bold leading-snug">
            {messages.states.unavailableTitle}
          </h2>
          <p className="mt-2 text-ink-secondary">{messages.states.unavailableBody}</p>
          <Link href={retryHref} className="touch-target mt-4 inline-flex items-center justify-center rounded-control bg-primary px-5 font-semibold text-white no-underline hover:bg-primary-hover">
            {messages.states.retry}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function EmptyState({ title, body, homeHref, homeLabel }: { title: string; body: string; homeHref?: string; homeLabel?: string }) {
  return (
    <section className="card px-5 py-6 sm:px-7" data-testid="empty-state">
      <h2 className="text-[1.35rem] font-bold leading-snug">{title}</h2>
      <p className="mt-2 text-ink-secondary">{body}</p>
      {homeHref && homeLabel ? (
        <Link href={homeHref} className="touch-target mt-4 inline-flex items-center gap-2 rounded-control border border-line bg-card px-5 font-semibold text-primary no-underline hover:bg-primary-soft">
          <ArrowLeftIcon className="h-5 w-5" />
          {homeLabel}
        </Link>
      ) : null}
    </section>
  );
}

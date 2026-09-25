import Link from 'next/link';
import type { Messages } from '@/i18n';
import { t } from '@/i18n';
import { ArrowLeftIcon, ArrowRightIcon } from './Icons';

interface Props {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
  messages: Messages;
  label: string;
  testId?: string;
}

const LINK = 'touch-target inline-flex items-center gap-2 rounded-control border border-line bg-card px-4 font-semibold text-ink no-underline hover:border-primary hover:text-primary';
const DISABLED = 'touch-target inline-flex items-center gap-2 rounded-control border border-line bg-[#f3f6f8] px-4 font-semibold text-ink-secondary';

/** Link-based pagination for server-rendered lists: works without JavaScript and keeps filters in the URL. */
export function Pagination({ page, pages, hrefFor, messages, label, testId }: Props) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={label} data-testid={testId} className="mt-4 flex flex-wrap items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={LINK}>
          <ArrowLeftIcon className="h-4 w-4" />
          {messages.details.prevPage}
        </Link>
      ) : (
        <span aria-disabled="true" className={DISABLED}>
          <ArrowLeftIcon className="h-4 w-4" />
          {messages.details.prevPage}
        </span>
      )}
      <p className="text-[0.95rem] text-ink-secondary" aria-current="page">
        {t(messages.details.pageInfo, { page, pages })}
      </p>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={LINK}>
          {messages.details.nextPage}
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      ) : (
        <span aria-disabled="true" className={DISABLED}>
          {messages.details.nextPage}
          <ArrowRightIcon className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}

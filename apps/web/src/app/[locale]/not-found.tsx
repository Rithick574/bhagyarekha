import Link from 'next/link';
import { en } from '@/i18n/messages/en';
import { ml } from '@/i18n/messages/ml';

/** Rendered inside the locale layout; the segment param is unavailable here, so show both languages. */
export default function NotFound() {
  return (
    <section className="card px-5 py-6 sm:px-7" aria-labelledby="nf-title">
      <h1 id="nf-title" className="text-[1.6rem] font-bold leading-tight">
        {en.states.notFoundTitle}
      </h1>
      <p className="mt-2 text-ink-secondary">{en.states.notFoundBody}</p>
      <p className="mt-3 text-ink-secondary" lang="ml">
        {ml.states.notFoundBody}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link href="/en" className="touch-target inline-flex items-center rounded-control bg-primary px-5 font-semibold text-white no-underline hover:bg-primary-hover">
          {en.nav.results}
        </Link>
        <Link href="/ml" lang="ml" className="touch-target inline-flex items-center rounded-control border border-line px-5 font-semibold text-primary no-underline hover:bg-primary-soft">
          {ml.nav.results}
        </Link>
      </div>
    </section>
  );
}

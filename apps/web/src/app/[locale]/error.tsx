'use client';

import { useEffect } from 'react';
import { en } from '@/i18n/messages/en';
import { ml } from '@/i18n/messages/ml';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Digest only: never log page content or user input.
    console.error('page error', error.digest ?? 'no-digest');
  }, [error]);
  const isMl = typeof document !== 'undefined' && document.documentElement.lang === 'ml';
  const m = isMl ? ml : en;
  return (
    <section className="card px-5 py-6 sm:px-7" aria-labelledby="err-title" role="alert">
      <h1 id="err-title" className="text-[1.6rem] font-bold leading-tight">
        {m.states.errorTitle}
      </h1>
      <p className="mt-2 text-ink-secondary">{m.states.errorBody}</p>
      <button type="button" onClick={reset} className="touch-target mt-4 inline-flex items-center rounded-control bg-primary px-5 font-semibold text-white hover:bg-primary-hover">
        {m.states.retry}
      </button>
    </section>
  );
}

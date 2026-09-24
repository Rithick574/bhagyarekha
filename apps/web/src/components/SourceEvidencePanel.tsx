import type { SourceReference } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import { formatInstant } from '@/lib/format';
import { ExternalIcon } from './Icons';

function kindLabel(kind: SourceReference['kind'], messages: Messages): string {
  switch (kind) {
    case 'OFFICIAL_DOCUMENT':
      return messages.details.sourceKindOfficial;
    case 'MANUAL_TRANSCRIPTION':
      return messages.details.sourceKindManual;
    case 'SYNTHETIC_FIXTURE':
      return messages.details.sourceKindSynthetic;
  }
}

export function SourceEvidencePanel({ sources, locale, messages }: { sources: SourceReference[]; locale: Locale; messages: Messages }) {
  return (
    <section id="sources" aria-labelledby="sources-title" data-testid="source-panel" className="card px-5 py-5 sm:px-6">
      <h2 id="sources-title" className="text-[1.35rem] font-bold leading-tight">
        {messages.details.sources}
      </h2>
      {sources.length === 0 ? (
        <p className="mt-3 text-ink-secondary">{messages.details.sourceNoLink}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {sources.map((source, index) => (
            <li key={`${source.title}-${index}`} className="py-3 first:pt-0 last:pb-0">
              <p className="text-[0.85rem] font-semibold uppercase tracking-wide text-ink-secondary">{kindLabel(source.kind, messages)}</p>
              <p className="font-semibold">{source.title}</p>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noopener noreferrer external" className="touch-target mt-1 inline-flex items-center gap-2 font-semibold text-primary underline decoration-2 underline-offset-4 break-all">
                  <ExternalIcon className="h-5 w-5 shrink-0" />
                  {source.url}
                  <span className="sr-only"> ({messages.a11y.externalLink})</span>
                </a>
              ) : (
                <p className="text-ink-secondary">{messages.details.sourceNoLink}</p>
              )}
              <p className="mt-1 text-[0.9rem] text-ink-secondary">{source.reviewedAt ? t(messages.details.sourceReviewed, { when: formatInstant(source.reviewedAt, locale) }) : messages.details.sourceNotReviewed}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 border-t border-line pt-3 text-[0.9rem] text-ink-secondary">{messages.details.sourceDisclaimer}</p>
    </section>
  );
}

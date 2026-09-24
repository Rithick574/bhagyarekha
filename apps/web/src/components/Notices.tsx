import type { ReactNode } from 'react';
import { InfoIcon, WarningIcon } from './Icons';

type Tone = 'info' | 'warning' | 'error' | 'neutral';

const TONES: Record<Tone, string> = {
  info: 'bg-info-bg text-info-ink border-[#bfe1dd]',
  warning: 'bg-warning-bg text-warning-ink border-[#f1dfae]',
  error: 'bg-error-bg text-error border-[#f5c6c0]',
  neutral: 'bg-[#eef2f5] text-ink border-line',
};

export function Notice({ tone = 'info', title, children, iconTitle, testId }: { tone?: Tone; title?: string; children?: ReactNode; iconTitle: string; testId?: string }) {
  const Icon = tone === 'info' || tone === 'neutral' ? InfoIcon : WarningIcon;
  return (
    <div role="note" data-testid={testId} className={`rounded-card border px-4 py-3 ${TONES[tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-6 w-6 shrink-0" title={iconTitle} />
        <div className="min-w-0">
          {title ? <p className="font-bold leading-snug">{title}</p> : null}
          {children ? <div className={`${title ? 'mt-0.5' : ''} text-[0.95rem] leading-snug`}>{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

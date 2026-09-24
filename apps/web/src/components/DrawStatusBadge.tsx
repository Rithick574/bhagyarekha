import type { Messages } from '@/i18n';
import type { StatusKey } from '@/lib/status';
import { CheckIcon, ClockIcon, CrossIcon, InfoIcon, PauseIcon, WarningIcon } from './Icons';

const STYLES: Record<StatusKey, { className: string; Icon: typeof CheckIcon }> = {
  scheduled: { className: 'bg-primary-soft text-info-ink border-[#bfe1dd]', Icon: ClockIcon },
  awaiting: { className: 'bg-[#eef2f5] text-ink-secondary border-line', Icon: ClockIcon },
  partial: { className: 'bg-warning-bg text-warning-ink border-[#f1dfae]', Icon: WarningIcon },
  published: { className: 'bg-primary-soft text-info-ink border-[#bfe1dd]', Icon: CheckIcon },
  suspended: { className: 'bg-error-bg text-error border-[#f5c6c0]', Icon: PauseIcon },
  cancelled: { className: 'bg-[#eef2f5] text-ink-secondary border-line', Icon: CrossIcon },
};

export function DrawStatusBadge({ status, messages, corrected = false }: { status: StatusKey; messages: Messages; corrected?: boolean }) {
  const { className, Icon } = STYLES[status];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.9rem] font-semibold leading-tight ${className}`}>
        <Icon className="h-4 w-4 shrink-0" />
        <span>{messages.status[status]}</span>
      </span>
      {corrected ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f1dfae] bg-warning-bg px-3 py-1 text-[0.9rem] font-semibold leading-tight text-warning-ink">
          <InfoIcon className="h-4 w-4 shrink-0" />
          <span>{messages.status.corrected}</span>
        </span>
      ) : null}
    </span>
  );
}

export function SampleBadge({ messages }: { messages: Messages }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f1dfae] bg-warning-bg px-3 py-1 text-[0.9rem] font-semibold leading-tight text-warning-ink">
      <WarningIcon className="h-4 w-4 shrink-0" />
      <span>{messages.status.sampleResult}</span>
    </span>
  );
}

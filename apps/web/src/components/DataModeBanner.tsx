import type { Messages } from '@/i18n';
import { WarningIcon } from './Icons';

export function DataModeBanner({ dataMode, messages }: { dataMode: 'demo' | 'live' | null; messages: Messages }) {
  if (dataMode !== 'demo') return null;
  return (
    <div role="note" data-testid="demo-banner" className="rounded-card border border-[#f1dfae] bg-warning-bg px-4 py-3 text-warning-ink sm:px-5">
      <div className="flex items-start gap-3">
        <WarningIcon className="mt-0.5 h-6 w-6 shrink-0" title={messages.a11y.warningIcon} />
        <div>
          <p className="font-bold leading-snug">{messages.banner.demoTitle}</p>
          <p className="mt-0.5 text-[0.95rem] leading-snug">{messages.banner.demoBody}</p>
        </div>
      </div>
    </div>
  );
}

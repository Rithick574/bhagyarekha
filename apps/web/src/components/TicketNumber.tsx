import type { Messages } from '@/i18n';
import { spokenDigits } from '@/lib/format';

interface Props {
  series: string;
  number: string;
  messages: Messages;
  size?: 'hero' | 'large' | 'medium' | 'base';
}

const SIZES = {
  hero: 'text-[2.6rem] leading-none sm:text-[3.4rem] lg:text-[3.8rem]',
  large: 'text-[1.6rem] leading-tight',
  medium: 'text-[1.35rem] leading-tight',
  base: 'text-[1.1rem] leading-tight',
};

/** Renders a ticket verbatim (strings only). Screen readers get the digits spelled out. */
export function TicketNumber({ series, number, messages, size = 'base' }: Props) {
  const spoken = series ? `${messages.a11y.seriesLabel} ${series.split('').join(' ')}, ${messages.a11y.numberLabel} ${spokenDigits(number)}` : `${messages.a11y.numberLabel} ${spokenDigits(number)}`;
  return (
    <span className={`tabular inline-flex flex-wrap items-baseline gap-x-[0.35em] font-bold text-ink ${SIZES[size]}`} data-testid="ticket-number">
      {series ? <span aria-hidden="true">{series}</span> : null}
      <span aria-hidden="true">{number}</span>
      <span className="sr-only">{spoken}</span>
    </span>
  );
}

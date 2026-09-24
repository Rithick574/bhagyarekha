'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n';
import { ChartIcon, ClockIcon, SearchIcon, TrophyIcon } from './Icons';
import { isActivePath } from '@/lib/nav';

interface Props {
  locale: Locale;
  ariaLabel: string;
  labels: { results: string; check: string; history: string; stats: string };
}

export function MobileBottomNav({ locale, ariaLabel, labels }: Props) {
  const pathname = usePathname();
  const items = [
    { href: `/${locale}`, label: labels.results, Icon: TrophyIcon },
    { href: `/${locale}/check`, label: labels.check, Icon: SearchIcon },
    { href: `/${locale}/history`, label: labels.history, Icon: ClockIcon },
    { href: `/${locale}/statistics`, label: labels.stats, Icon: ChartIcon },
  ];
  return (
    <nav aria-label={ariaLabel} className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card shadow-[0_-2px_12px_rgb(16_37_47/0.06)] lg:hidden">
      <ul className="mx-auto grid max-w-3xl grid-cols-4">
        {items.map(({ href, label, Icon }) => {
          const active = isActivePath(pathname, href, locale);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-1 px-1 py-2 text-[0.78rem] font-semibold leading-tight no-underline ${
                  active ? 'text-primary' : 'text-ink-secondary'
                }`}
              >
                <Icon className={`h-6 w-6 ${active ? 'stroke-[2.5]' : ''}`} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

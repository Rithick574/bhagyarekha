'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n';
import { isActivePath } from '@/lib/nav';
import type { NavItem } from '@/lib/nav';

export function DesktopNav({ items, locale, ariaLabel }: { items: NavItem[]; locale: Locale; ariaLabel: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={ariaLabel} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href, locale);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`touch-target inline-flex items-center rounded-control px-2.5 py-2 font-semibold whitespace-nowrap no-underline transition-colors hover:bg-primary-soft ${
                  active ? 'text-primary shadow-[inset_0_-3px_0_0_var(--color-primary)]' : 'text-ink'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

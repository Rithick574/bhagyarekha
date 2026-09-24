import type { Locale } from '@/i18n';

export interface NavItem {
  href: string;
  label: string;
}

export function navItemsFor(locale: Locale, labels: { results: string; check: string; history: string; statistics: string; help: string }): NavItem[] {
  return [
    { href: `/${locale}`, label: labels.results },
    { href: `/${locale}/check`, label: labels.check },
    { href: `/${locale}/history`, label: labels.history },
    { href: `/${locale}/statistics`, label: labels.statistics },
    { href: `/${locale}/help`, label: labels.help },
  ];
}

export function isActivePath(pathname: string, href: string, locale: Locale): boolean {
  if (href === `/${locale}`) return pathname === href || pathname === `${href}/` || pathname.startsWith(`/${locale}/results`);
  return pathname === href || pathname.startsWith(`${href}/`);
}

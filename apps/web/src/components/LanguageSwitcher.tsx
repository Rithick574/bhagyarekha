'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALE_COOKIE, switchLocalePath } from '@/i18n';
import type { Locale } from '@/i18n';

interface Props {
  locale: Locale;
  label: string;
  names: { en: string; ml: string };
}

function rememberLocale(target: Locale) {
  try {
    document.cookie = `${LOCALE_COOKIE}=${target}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* cookies disabled: the URL still carries the locale */
  }
}

export function LanguageSwitcher({ locale, label, names }: Props) {
  const pathname = usePathname();
  const options: Locale[] = ['en', 'ml'];
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-control border border-line bg-card">
      {options.map((option) => {
        const active = option === locale;
        return (
          <Link
            key={option}
            href={switchLocalePath(pathname, option)}
            lang={option}
            hrefLang={option}
            aria-current={active ? 'true' : undefined}
            onClick={() => rememberLocale(option)}
            className={`touch-target inline-flex items-center justify-center px-2 text-[0.95rem] font-semibold whitespace-nowrap sm:px-2.5 no-underline transition-colors ${
              active ? 'bg-primary text-white' : 'text-ink hover:bg-primary-soft'
            }`}
          >
            {names[option]}
          </Link>
        );
      })}
    </div>
  );
}

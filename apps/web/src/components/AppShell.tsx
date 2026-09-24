import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Locale, Messages } from '@/i18n';
import { t } from '@/i18n';
import { DataModeBanner } from './DataModeBanner';
import { BrandMark } from './Icons';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MobileBottomNav } from './MobileBottomNav';
import { navItemsFor } from '@/lib/nav';
import { DesktopNav } from './NavLinks';
import { TextSizeControl } from './TextSizeControl';

interface Props {
  locale: Locale;
  messages: Messages;
  dataMode: 'demo' | 'live' | null;
  children: ReactNode;
}

export function AppShell({ locale, messages, dataMode, children }: Props) {
  const items = navItemsFor(locale, messages.nav);
  return (
    <div className="pb-bottom-nav flex min-h-dvh flex-col lg:pb-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-white"
      >
        {messages.nav.skipToContent}
      </a>

      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-3 px-4 py-3 sm:px-6 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto]">
          <Link href={`/${locale}`} aria-label={messages.a11y.brandHome} className="flex min-h-12 shrink-0 items-center gap-3 no-underline">
            <BrandMark className="h-11 w-11 shrink-0" />
            <span className="flex flex-col leading-tight">
              <span className="text-[1.45rem] font-extrabold tracking-tight text-ink">
                {messages.brand.name}
                <span className="sr-only"> · {messages.brand.nameNative}</span>
              </span>
              <span className="text-[0.8rem] text-ink-secondary lg:whitespace-nowrap">{messages.brand.subtitle}</span>
            </span>
          </Link>

          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto lg:order-3 lg:shrink-0">
            <LanguageSwitcher locale={locale} label={messages.controls.language} names={{ en: messages.controls.english, ml: messages.controls.malayalam }} />
            <TextSizeControl label={messages.controls.textSize} names={{ standard: messages.controls.textStandard, large: messages.controls.textLarge, xlarge: messages.controls.textXLarge }} />
          </div>

          <div className="lg:order-2 lg:flex lg:min-w-0 lg:justify-center">
            <DesktopNav items={items} locale={locale} ariaLabel={messages.nav.primary} />
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <DataModeBanner dataMode={dataMode} messages={messages} />
      </div>

      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
        {children}
      </main>

      <footer className="border-t border-line bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6 text-[0.9rem] text-ink-secondary sm:px-6">
          <p>{messages.footer.independent}</p>
          <p className="mt-2">{messages.footer.noGambling}</p>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href={`/${locale}/help`} className="touch-target inline-flex items-center font-semibold text-primary underline decoration-2 underline-offset-4">
                {messages.footer.help}
              </Link>
            </li>
            <li>
              <Link href={`/${locale}/help#report`} className="touch-target inline-flex items-center font-semibold text-primary underline decoration-2 underline-offset-4">
                {messages.footer.contact}
              </Link>
            </li>
            {dataMode ? <li className="inline-flex min-h-12 items-center">{t(messages.footer.dataMode, { mode: dataMode === 'demo' ? messages.footer.modeDemo : messages.footer.modeLive })}</li> : null}
          </ul>
        </div>
      </footer>

      <MobileBottomNav locale={locale} ariaLabel={messages.nav.bottom} labels={{ results: messages.nav.results, check: messages.nav.checkShort, history: messages.nav.history, stats: messages.nav.statisticsShort }} />
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { RootHtml } from '@/components/RootHtml';
import { LOCALES, getMessages, isLocale } from '@/i18n';
import { getDataMode } from '@/lib/api';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const messages = getMessages(locale);
  const mode = await getDataMode();
  return {
    title: { default: `${messages.brand.name} — ${messages.brand.subtitle}`, template: `%s · ${messages.brand.name}` },
    description: messages.brand.tagline,
    applicationName: messages.brand.name,
    manifest: '/manifest.webmanifest',
    icons: { icon: '/icon.svg' },
    robots: mode === 'live' ? { index: true, follow: true } : { index: false, follow: false },
    other: { 'color-scheme': 'light' },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const dataMode = await getDataMode();
  return (
    <RootHtml lang={locale}>
      <AppShell locale={locale} messages={messages} dataMode={dataMode}>
        {children}
      </AppShell>
    </RootHtml>
  );
}

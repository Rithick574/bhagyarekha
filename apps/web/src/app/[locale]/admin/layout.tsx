import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminSessionProvider } from '@/components/admin/AdminSessionProvider';
import { getMessages, isLocale } from '@/i18n';

export const dynamic = 'force-dynamic';

/** Admin routes are never indexed, in any mode. */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AdminSessionProvider locale={locale} messages={getMessages(locale)}>
      {children}
    </AdminSessionProvider>
  );
}

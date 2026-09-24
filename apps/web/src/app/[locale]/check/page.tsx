import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRightIcon } from '@/components/Icons';
import { Notice } from '@/components/Notices';
import { getMessages, isLocale } from '@/i18n';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getMessages(locale).placeholder.checkTitle };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  return (
    <div className="space-y-4">
      <section className="card px-5 py-6 sm:px-7" aria-labelledby="page-title">
        <h1 id="page-title" className="text-[1.75rem] font-bold leading-tight">
          {messages.placeholder.checkTitle}
        </h1>
        <p className="mt-3 text-ink-secondary">{messages.placeholder.checkBody}</p>
        <p className="mt-3 text-ink-secondary">{messages.placeholder.checkManual}</p>
        <Link href={`/${locale}`} className="touch-target mt-5 inline-flex items-center gap-2 rounded-control bg-primary px-5 font-semibold text-white no-underline hover:bg-primary-hover">
          {messages.placeholder.goToResults}
          <ArrowRightIcon className="h-5 w-5" />
        </Link>
      </section>
      <Notice tone="neutral" title={messages.placeholder.notYetHeading} iconTitle={messages.a11y.infoIcon}>
        {messages.help.officialBody}
      </Notice>
    </div>
  );
}

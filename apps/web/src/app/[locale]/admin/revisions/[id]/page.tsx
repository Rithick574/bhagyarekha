import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RequireSession } from '@/components/admin/AdminSessionProvider';
import { RevisionDetail } from '@/components/admin/RevisionDetail';
import { getMessages, isLocale } from '@/i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.revisions.title : 'Revision' };
}

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  return (
    <RequireSession>
      <RevisionDetail revisionId={id} />
    </RequireSession>
  );
}

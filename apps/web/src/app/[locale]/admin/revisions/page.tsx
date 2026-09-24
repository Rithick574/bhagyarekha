import type { Metadata } from 'next';
import { RequireSession } from '@/components/admin/AdminSessionProvider';
import { RevisionsList } from '@/components/admin/RevisionsList';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.revisions.title : 'Admin' };
}

export default function Page() {
  return (
    <RequireSession>
      <RevisionsList />
    </RequireSession>
  );
}

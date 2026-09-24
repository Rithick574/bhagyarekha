import type { Metadata } from 'next';
import { RequireSession } from '@/components/admin/AdminSessionProvider';
import { ImportAdmin } from '@/components/admin/ImportAdmin';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.imports.title : 'Admin' };
}

export default function Page() {
  return (
    <RequireSession>
      <ImportAdmin />
    </RequireSession>
  );
}

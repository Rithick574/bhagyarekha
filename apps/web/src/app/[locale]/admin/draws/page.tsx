import type { Metadata } from 'next';
import { RequireSession } from '@/components/admin/AdminSessionProvider';
import { DrawsAdmin } from '@/components/admin/DrawsAdmin';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.draws.title : 'Admin' };
}

export default function Page() {
  return (
    <RequireSession>
      <DrawsAdmin />
    </RequireSession>
  );
}

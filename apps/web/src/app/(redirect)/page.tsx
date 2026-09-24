import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from '@/i18n';

export const dynamic = 'force-dynamic';

export default async function RootRedirect() {
  const store = await cookies();
  const saved = store.get(LOCALE_COOKIE)?.value;
  redirect(`/${isLocale(saved) ? saved : DEFAULT_LOCALE}`);
}

import type { Metadata } from 'next';
import { LoginForm } from '@/components/admin/LoginForm';
import { getMessages, isLocale } from '@/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? getMessages(locale).admin.login.title : 'Login' };
}

export default function AdminLoginPage() {
  return <LoginForm />;
}

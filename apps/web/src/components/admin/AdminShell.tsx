'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Notice } from '../Notices';
import { BTN_SECONDARY, StateBadge } from './AdminUi';
import { useAdminSession } from './AdminSessionProvider';

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const { locale, messages, session, logout } = useAdminSession();
  const pathname = usePathname();
  const m = messages.admin;
  const items = [
    { href: `/${locale}/admin`, label: m.nav.dashboard, exact: true },
    { href: `/${locale}/admin/draws`, label: m.nav.draws },
    { href: `/${locale}/admin/imports`, label: m.nav.imports },
    { href: `/${locale}/admin/revisions`, label: m.nav.revisions },
    { href: `/${locale}/admin/lotteries`, label: m.nav.lotteries },
  ];
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <div className="space-y-4" data-testid="admin-shell">
      <div className="card px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[1.35rem] font-bold leading-tight">{m.title}</h1>
            {session ? (
              <span data-testid="admin-datamode">
                <StateBadge label={session.dataMode === 'demo' ? m.sampleBadge : m.liveBadge} tone={session.dataMode === 'demo' ? 'warn' : 'good'} />
              </span>
            ) : null}
          </div>
          {session ? (
            <div className="flex flex-wrap items-center gap-3 text-[0.95rem] text-ink-secondary">
              <span data-testid="admin-user-email">
                {session.user.email} · <span data-testid="admin-user-role">{session.user.role === 'PUBLISHER' ? m.rolePublisher : m.roleEditor}</span>
              </span>
              <button type="button" onClick={() => void logout()} className={BTN_SECONDARY} data-testid="admin-logout">
                {m.logout}
              </button>
            </div>
          ) : null}
        </div>
        <nav aria-label={m.nav.label} className="mt-3">
          <ul className="flex flex-wrap gap-2">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href, item.exact) ? 'page' : undefined}
                  className={`touch-target inline-flex items-center rounded-control px-4 font-semibold no-underline ${isActive(item.href, item.exact) ? 'bg-primary text-white' : 'text-primary hover:bg-primary-soft hover:text-primary-hover'}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      {session?.dataMode === 'demo' ? (
        <Notice tone="warning" iconTitle={messages.a11y.warningIcon}>
          {m.sampleNote}
        </Notice>
      ) : null}
      <h2 className="text-[1.6rem] font-bold leading-tight">{title}</h2>
      {children}
    </div>
  );
}

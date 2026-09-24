'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SessionResponse } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { getSession, logout as apiLogout, type AdminFailure } from '@/lib/admin-api';

type Status = 'loading' | 'anonymous' | 'authenticated';

export interface AdminSessionContextValue {
  status: Status;
  session: SessionResponse | null;
  /** Held in memory only. Never written to storage. */
  csrfToken: string | null;
  locale: Locale;
  messages: Messages;
  isPublisher: boolean;
  refresh: () => Promise<void>;
  setSession: (session: SessionResponse) => void;
  logout: () => Promise<void>;
  /** Call with any admin failure: 401 clears the session and redirects to login. Returns true when handled. */
  handleAuthFailure: (failure: AdminFailure) => boolean;
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSessionState] = useState<SessionResponse | null>(null);

  const refresh = useCallback(async () => {
    const result = await getSession();
    if (result.ok) {
      setSessionState(result.data);
      setStatus('authenticated');
    } else {
      setSessionState(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
  }, [refresh]);

  const setSession = useCallback((next: SessionResponse) => {
    setSessionState(next);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await apiLogout({ csrfToken: session?.csrfToken ?? null });
    setSessionState(null);
    setStatus('anonymous');
    router.replace(`/${locale}/admin/login`);
  }, [session, router, locale]);

  const handleAuthFailure = useCallback(
    (failure: AdminFailure) => {
      if (failure.kind === 'http' && failure.status === 401) {
        setSessionState(null);
        setStatus('anonymous');
        router.replace(`/${locale}/admin/login`);
        return true;
      }
      return false;
    },
    [router, locale],
  );

  const value = useMemo<AdminSessionContextValue>(
    () => ({
      status,
      session,
      csrfToken: session?.csrfToken ?? null,
      locale,
      messages,
      isPublisher: session?.user.role === 'PUBLISHER',
      refresh,
      setSession,
      logout,
      handleAuthFailure,
    }),
    [status, session, locale, messages, refresh, setSession, logout, handleAuthFailure],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionContextValue {
  const value = useContext(AdminSessionContext);
  if (!value) throw new Error('useAdminSession must be used inside AdminSessionProvider');
  return value;
}

/** Renders children only for an authenticated session; anonymous users are sent to the login page. */
export function RequireSession({ children }: { children: ReactNode }) {
  const { status, locale, messages } = useAdminSession();
  const router = useRouter();
  useEffect(() => {
    if (status === 'anonymous') router.replace(`/${locale}/admin/login`);
  }, [status, router, locale]);
  if (status !== 'authenticated') {
    return (
      <p role="status" className="text-ink-secondary" data-testid="admin-loading">
        {messages.admin.loading}
      </p>
    );
  }
  return <>{children}</>;
}

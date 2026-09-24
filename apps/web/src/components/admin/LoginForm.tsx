'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { login } from '@/lib/admin-api';
import { BTN_PRIMARY, Field, TextInput } from './AdminUi';
import { useAdminSession } from './AdminSessionProvider';

export function LoginForm() {
  const { locale, messages, status, setSession } = useAdminSession();
  const m = messages.admin.login;
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const emailId = useId();
  const passwordId = useId();

  useEffect(() => {
    if (status === 'authenticated') router.replace(`/${locale}/admin`);
  }, [status, router, locale]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await login({ email, password });
    setBusy(false);
    setPassword('');
    if (result.ok) {
      setSession(result.data);
      router.replace(`/${locale}/admin`);
      return;
    }
    if (result.kind === 'network' || result.kind === 'invalid-response') setError(m.unavailable);
    else if (result.status === 429) setError(m.rateLimited);
    else if (result.status === 403) setError(m.forbidden);
    else setError(m.failed);
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  return (
    <div className="mx-auto max-w-md">
      <form onSubmit={submit} noValidate className="card space-y-4 px-5 py-6 sm:px-7" data-testid="admin-login-form">
        <div>
          <h1 className="text-[1.5rem] font-bold leading-tight">{m.title}</h1>
          <p className="mt-1 text-ink-secondary">{m.intro}</p>
        </div>
        {error ? (
          <p ref={errorRef} tabIndex={-1} role="alert" data-testid="admin-login-error" className="rounded-card border border-[#f5c6c0] bg-error-bg px-4 py-3 font-semibold text-error">
            {error}
          </p>
        ) : null}
        <Field label={m.email} id={emailId} required>
          {(id) => <TextInput id={id} type="email" name="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} data-testid="login-email" />}
        </Field>
        <Field label={m.password} id={passwordId} required>
          {(id) => <TextInput id={id} type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} data-testid="login-password" />}
        </Field>
        <button type="submit" className={`${BTN_PRIMARY} w-full`} disabled={busy} aria-busy={busy || undefined} data-testid="login-submit">
          {m.submit}
          {busy ? <span className="sr-only"> {m.submitting}</span> : null}
        </button>
        <p className="text-[0.9rem] text-ink-secondary">{m.forgot}</p>
      </form>
    </div>
  );
}

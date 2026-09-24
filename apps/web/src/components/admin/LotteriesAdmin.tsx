'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AdminLottery } from '@bhagyarekha/contracts';
import { createLottery, listAdminLotteries, type AdminFailure } from '@/lib/admin-api';
import { AdminShell } from './AdminShell';
import { BTN_PRIMARY, FailureBanner, Field, SuccessNotice, TABLE_CLASS, TD_CLASS, TH_CLASS, TextInput } from './AdminUi';
import { useAdminSession } from './AdminSessionProvider';

export function LotteriesAdmin() {
  const { locale, messages, csrfToken, isPublisher, handleAuthFailure } = useAdminSession();
  const m = messages.admin;
  const [items, setItems] = useState<AdminLottery[] | null>(null);
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const [form, setForm] = useState({ code: '', slug: '', nameEn: '', nameMl: '' });
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await listAdminLotteries();
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    setItems(r.data.items);
  }, [handleAuthFailure]);
  useEffect(() => {
    // Deferred to a microtask so state updates never run synchronously inside the effect body.
    void Promise.resolve().then(() => load());
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFailure(null);
    setSuccess(null);
    const r = await createLottery({ csrfToken }, { code: form.code.trim(), slug: form.slug.trim(), name: { en: form.nameEn.trim(), ml: form.nameMl.trim() }, active: true });
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    setSuccess(m.lotteries.added);
    setForm({ code: '', slug: '', nameEn: '', nameMl: '' });
    void load();
  };

  return (
    <AdminShell title={m.lotteries.title}>
      <FailureBanner failure={failure} messages={messages} onReload={() => void load()} />
      <SuccessNotice text={success} />
      <section className="card px-5 py-4">
        {items === null ? <p className="text-ink-secondary">{m.loading}</p> : (
          <div className="overflow-x-auto">
            <table className={TABLE_CLASS} data-testid="lotteries-table">
              <thead>
                <tr>
                  <th scope="col" className={TH_CLASS}>{m.lotteries.code}</th>
                  <th scope="col" className={TH_CLASS}>{m.lotteries.nameEn}</th>
                  <th scope="col" className={TH_CLASS}>{m.lotteries.nameMl}</th>
                  <th scope="col" className={TH_CLASS}>{m.lotteries.active}</th>
                  <th scope="col" className={TH_CLASS}>{m.lotteries.datasetVersion}</th>
                  <th scope="col" className={TH_CLASS}>{m.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((l) => (
                  <tr key={l.id}>
                    <td className={`${TD_CLASS} font-mono`}>{l.code}</td>
                    <td className={TD_CLASS}>{l.name.en}</td>
                    <td className={TD_CLASS} lang="ml">{l.name.ml}</td>
                    <td className={TD_CLASS}>{l.active ? m.common.yes : m.common.no}</td>
                    <td className={TD_CLASS}>{l.datasetVersion}</td>
                    <td className={TD_CLASS}>
                      <Link href={`/${locale}/admin/lotteries/${l.id}/rules`} className="touch-target inline-flex items-center font-semibold text-primary underline" data-testid={`rules-link-${l.code}`}>
                        {m.lotteries.rules}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card px-5 py-4" aria-labelledby="add-lottery">
        <h3 id="add-lottery" className="text-[1.1rem] font-bold">{m.lotteries.addTitle}</h3>
        <p className="mt-1 text-[0.95rem] text-ink-secondary">{m.lotteries.addHelp}</p>
        {isPublisher ? (
          <form onSubmit={submit} noValidate className="mt-3 grid gap-4 sm:grid-cols-2" data-testid="add-lottery-form">
            <Field label={m.lotteries.code} required>{(id) => <TextInput id={id} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required pattern="[A-Z0-9_]{1,32}" />}</Field>
            <Field label={m.lotteries.slug} required>{(id) => <TextInput id={id} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} required pattern="[a-z0-9-]{1,64}" />}</Field>
            <Field label={m.lotteries.nameEn} required>{(id) => <TextInput id={id} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} required />}</Field>
            <Field label={m.lotteries.nameMl} required>{(id) => <TextInput id={id} lang="ml" value={form.nameMl} onChange={(e) => setForm({ ...form, nameMl: e.target.value })} required />}</Field>
            <div className="sm:col-span-2">
              <button type="submit" className={BTN_PRIMARY} disabled={busy}>{busy ? m.common.saving : m.common.save}</button>
            </div>
          </form>
        ) : (
          <p className="mt-2 font-semibold text-ink-secondary" data-testid="publisher-only">{m.lotteries.publisherOnly}</p>
        )}
      </section>
    </AdminShell>
  );
}

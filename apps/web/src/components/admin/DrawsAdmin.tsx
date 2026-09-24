'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminDraw, AdminLottery, AuditEvent, DrawPhase, EvidenceKind } from '@bhagyarekha/contracts';
import { istLocalToUtcIso } from '@/lib/admin-time';
import { createCorrection, createDraw, drawAudit, listAdminDraws, listAdminLotteries, resumeDraw, suspendDraw, type AdminFailure } from '@/lib/admin-api';
import { formatLocalDate } from '@/lib/format';
import { AdminShell } from './AdminShell';
import { AuditList } from './AuditList';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, ConfirmDialog, FailureBanner, Field, Pager, Select, StateBadge, SuccessNotice, TABLE_CLASS, TD_CLASS, TH_CLASS, TextArea, TextInput } from './AdminUi';
import { useAdminSession } from './AdminSessionProvider';
import { SourceFields, sourceToInput } from './RulesAdmin';

type Dialog = { kind: 'suspend' | 'resume' | 'correction'; draw: AdminDraw; key: string } | null;
const PHASES: DrawPhase[] = ['SCHEDULED', 'POSTPONED', 'HELD', 'CANCELLED'];

export function DrawsAdmin() {
  const { locale, messages, csrfToken, isPublisher, session, handleAuthFailure } = useAdminSession();
  const router = useRouter();
  const m = messages.admin;
  const [lotteries, setLotteries] = useState<AdminLottery[]>([]);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [list, setList] = useState<{ items: AdminDraw[]; total: number; pageSize: number } | null>(null);
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({ lotteryId: '', drawCode: '', scheduledDate: '', actualDate: '', scheduledAt: '', actualAt: '', phase: 'SCHEDULED' as DrawPhase });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState('');
  const [source, setSource] = useState<{ kind: EvidenceKind; title: string; url: string; note: string }>({ kind: 'OFFICIAL_DOCUMENT', title: '', url: '', note: '' });
  const [dialogFailure, setDialogFailure] = useState<AdminFailure | null>(null);
  const [audit, setAudit] = useState<{ drawId: string; items: AuditEvent[] } | null>(null);

  const load = useCallback(async () => {
    const [l, d] = await Promise.all([listAdminLotteries(), listAdminDraws({ lotteryId: filter || undefined, page })]);
    if (!d.ok) {
      if (!handleAuthFailure(d)) setFailure(d);
      return;
    }
    if (l.ok) setLotteries(l.data.items);
    setList({ items: d.data.items, total: d.data.total, pageSize: d.data.pageSize });
  }, [filter, page, handleAuthFailure]);
  useEffect(() => {
    // Deferred to a microtask so state updates never run synchronously inside the effect body.
    void Promise.resolve().then(() => load());
  }, [load]);

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccess(null);
    setFailure(null);
    if (!form.scheduledDate && !form.actualDate) {
      setFormError(m.draws.dateRequired);
      return;
    }
    const scheduledAt = form.scheduledAt ? istLocalToUtcIso(form.scheduledAt) : null;
    const actualAt = form.actualAt ? istLocalToUtcIso(form.actualAt) : null;
    if ((form.scheduledAt && !scheduledAt) || (form.actualAt && !actualAt)) {
      setFormError(m.draws.timeInvalid);
      return;
    }
    setBusy(true);
    const r = await createDraw({ csrfToken }, { lotteryId: form.lotteryId, drawCode: form.drawCode.trim(), phase: form.phase, scheduledDate: form.scheduledDate || null, actualDate: form.actualDate || null, scheduledAt, actualAt });
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    setSuccess(m.draws.added);
    setForm({ ...form, drawCode: '', scheduledDate: '', actualDate: '', scheduledAt: '', actualAt: '' });
    void load();
  };

  const openDialog = (kind: NonNullable<Dialog>['kind'], draw: AdminDraw) => {
    setDialog({ kind, draw, key: crypto.randomUUID() });
    setReason('');
    setDialogFailure(null);
  };
  const confirmDialog = async () => {
    if (!dialog || reason.trim() === '') return;
    setBusy(true);
    const c = { csrfToken };
    if (dialog.kind === 'correction') {
      const r = await createCorrection(c, dialog.draw.id, { reason: reason.trim(), source: sourceToInput(source) });
      setBusy(false);
      if (!r.ok) {
        if (!handleAuthFailure(r)) setDialogFailure(r);
        return;
      }
      setDialog(null);
      router.push(`/${locale}/admin/revisions/${r.data.id}`);
      return;
    }
    const body = { reason: reason.trim(), expectedEditVersion: dialog.draw.editVersion };
    const r = dialog.kind === 'suspend' ? await suspendDraw(c, dialog.draw.id, body, dialog.key) : await resumeDraw(c, dialog.draw.id, body, dialog.key);
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setDialogFailure(r);
      return;
    }
    setSuccess(dialog.kind === 'suspend' ? m.draws.suspended : m.draws.resumed);
    setDialog(null);
    void load();
  };
  const toggleAudit = async (drawId: string) => {
    if (audit?.drawId === drawId) {
      setAudit(null);
      return;
    }
    const r = await drawAudit(drawId);
    if (r.ok) setAudit({ drawId, items: r.data.items });
    else if (!handleAuthFailure(r)) setFailure(r);
  };

  const dialogTitle = dialog ? (dialog.kind === 'suspend' ? m.draws.suspendTitle : dialog.kind === 'resume' ? m.draws.resumeTitle : m.draws.correctionTitle).replace('{code}', dialog.draw.drawCode) : '';
  const dialogHelp = dialog ? (dialog.kind === 'suspend' ? m.draws.suspendHelp : dialog.kind === 'resume' ? m.draws.resumeHelp : m.draws.correctionHelp) : '';

  return (
    <AdminShell title={m.draws.title}>
      <FailureBanner failure={failure} messages={messages} onReload={() => void load()} />
      <SuccessNotice text={success} />
      <section className="card px-5 py-4">
        <Field label={m.draws.filterLottery}>
          {(id) => (
            <Select id={id} value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="max-w-sm" data-testid="draw-filter">
              <option value="">{m.draws.allLotteries}</option>
              {lotteries.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name[locale]}</option>)}
            </Select>
          )}
        </Field>
        {list === null ? <p className="mt-3 text-ink-secondary">{m.loading}</p> : list.items.length === 0 ? <p className="mt-3 text-ink-secondary">{m.draws.noDraws}</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className={TABLE_CLASS} data-testid="draws-table">
              <thead>
                <tr>
                  <th scope="col" className={TH_CLASS}>{m.draws.lottery}</th>
                  <th scope="col" className={TH_CLASS}>{m.draws.code}</th>
                  <th scope="col" className={TH_CLASS}>{m.draws.scheduledDate}</th>
                  <th scope="col" className={TH_CLASS}>{m.draws.actualDate}</th>
                  <th scope="col" className={TH_CLASS}>{m.draws.phase}</th>
                  <th scope="col" className={TH_CLASS}>{m.draws.visibility}</th>
                  <th scope="col" className={TH_CLASS}>{m.common.actions}</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((d) => (
                  <tr key={d.id} data-testid={`draw-row-${d.drawCode}`}>
                    <td className={TD_CLASS}>{d.lotteryCode}</td>
                    <td className={`${TD_CLASS} font-semibold`}>{d.drawCode}</td>
                    <td className={TD_CLASS}>{d.scheduledDate ? formatLocalDate(d.scheduledDate, locale) : '—'}</td>
                    <td className={TD_CLASS}>{d.actualDate ? formatLocalDate(d.actualDate, locale) : '—'}</td>
                    <td className={TD_CLASS}><StateBadge label={m.draws.phases[d.phase]} tone={d.phase === 'CANCELLED' ? 'neutral' : 'good'} /></td>
                    <td className={TD_CLASS}><StateBadge label={m.draws.visibilities[d.visibility]} tone={d.visibility === 'SUSPENDED' ? 'bad' : 'neutral'} /></td>
                    <td className={TD_CLASS}>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/${locale}/results/${d.id}`} className={BTN_SECONDARY}>{m.common.publicPage}</Link>
                        {d.currentRevisionId ? <Link href={`/${locale}/admin/revisions/${d.currentRevisionId}`} className={BTN_SECONDARY}>{m.draws.viewRevision}</Link> : null}
                        {isPublisher && d.currentRevisionId && d.visibility === 'ACTIVE' ? <button type="button" className={BTN_DANGER} onClick={() => openDialog('suspend', d)} data-testid={`suspend-${d.drawCode}`}>{m.draws.suspend}</button> : null}
                        {isPublisher && d.visibility === 'SUSPENDED' ? <button type="button" className={BTN_PRIMARY} onClick={() => openDialog('resume', d)} data-testid={`resume-${d.drawCode}`}>{m.draws.resume}</button> : null}
                        {d.currentRevisionId ? <button type="button" className={BTN_SECONDARY} onClick={() => openDialog('correction', d)} data-testid={`correction-${d.drawCode}`}>{m.draws.correction}</button> : null}
                        <button type="button" className={BTN_SECONDARY} onClick={() => void toggleAudit(d.id)} aria-expanded={audit?.drawId === d.id}>{m.common.audit}</button>
                      </div>
                      {audit?.drawId === d.id ? <div className="mt-3"><AuditList items={audit.items} locale={locale} messages={messages} /></div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} hasNext={page * list.pageSize < list.total} onPage={setPage} messages={messages} />
          </div>
        )}
      </section>

      <section className="card px-5 py-4" aria-labelledby="add-draw">
        <h3 id="add-draw" className="text-[1.1rem] font-bold">{m.draws.addTitle}</h3>
        <p className="mt-1 text-[0.95rem] text-ink-secondary">{m.draws.addHelp}</p>
        <form onSubmit={submitNew} noValidate className="mt-3 grid gap-4 sm:grid-cols-2" data-testid="add-draw-form">
          {formError ? <p role="alert" className="font-semibold text-error sm:col-span-2">{formError}</p> : null}
          <Field label={m.draws.lottery} required>{(id) => <Select id={id} value={form.lotteryId} onChange={(e) => setForm({ ...form, lotteryId: e.target.value })} required data-testid="new-draw-lottery"><option value="">—</option>{lotteries.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name[locale]}</option>)}</Select>}</Field>
          <Field label={m.draws.code} required>{(id) => <TextInput id={id} value={form.drawCode} onChange={(e) => setForm({ ...form, drawCode: e.target.value })} required pattern="[A-Za-z0-9_.-]{1,32}" data-testid="new-draw-code" />}</Field>
          <Field label={m.draws.scheduledDate}>{(id) => <TextInput id={id} type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} data-testid="new-draw-scheduled" />}</Field>
          <Field label={m.draws.actualDate}>{(id) => <TextInput id={id} type="date" value={form.actualDate} onChange={(e) => setForm({ ...form, actualDate: e.target.value })} />}</Field>
          <Field label={m.draws.scheduledAt} help={m.draws.timeHelp}>{(id, d) => <TextInput id={id} type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} aria-describedby={d} />}</Field>
          <Field label={m.draws.actualAt} help={m.draws.timeHelp}>{(id, d) => <TextInput id={id} type="datetime-local" value={form.actualAt} onChange={(e) => setForm({ ...form, actualAt: e.target.value })} aria-describedby={d} />}</Field>
          <Field label={m.draws.phase}>{(id) => <Select id={id} value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value as DrawPhase })}>{PHASES.map((p) => <option key={p} value={p}>{m.draws.phases[p]}</option>)}</Select>}</Field>
          <div className="sm:col-span-2"><button type="submit" className={BTN_PRIMARY} disabled={busy} data-testid="new-draw-submit">{busy ? m.common.saving : m.common.save}</button></div>
        </form>
      </section>

      <ConfirmDialog open={dialog !== null} title={dialogTitle} onClose={() => setDialog(null)} testId="draw-dialog">
        {dialog ? (
          <>
            <p className="text-ink-secondary">{dialogHelp}</p>
            <FailureBanner failure={dialogFailure} messages={messages} />
            <Field label={m.common.reason} help={m.common.reasonHelp} required>{(id, d) => <TextArea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby={d} data-testid="draw-dialog-reason" />}</Field>
            {dialog.kind === 'correction' ? <SourceFields value={source} onChange={setSource} allowSynthetic={session?.dataMode === 'demo'} /> : <p className="text-[0.85rem] text-ink-secondary">{m.common.idempotencyNote}</p>}
            <div className="flex flex-wrap gap-3">
              <button type="button" className={dialog.kind === 'suspend' ? BTN_DANGER : BTN_PRIMARY} disabled={busy || reason.trim() === '' || (dialog.kind === 'correction' && source.title.trim() === '')} onClick={() => void confirmDialog()} data-testid="draw-dialog-confirm">{m.common.confirm}</button>
              <button type="button" className={BTN_SECONDARY} onClick={() => setDialog(null)}>{m.common.cancel}</button>
            </div>
          </>
        ) : null}
      </ConfirmDialog>
    </AdminShell>
  );
}

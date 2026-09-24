'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { RuleSetV1Schema, type AdminRuleVersion, type EvidenceKind } from '@bhagyarekha/contracts';
import { approveRule, createRule, listRules, revokeRule, type AdminFailure } from '@/lib/admin-api';
import { AdminShell } from './AdminShell';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, ConfirmDialog, FailureBanner, Field, Select, StateBadge, SuccessNotice, TextArea, TextInput } from './AdminUi';
import { useAdminSession } from './AdminSessionProvider';

type Dialog = { kind: 'approve' | 'revoke'; rule: AdminRuleVersion; key: string } | null;

export function SourceFields({ value, onChange, allowSynthetic }: { value: { kind: EvidenceKind; title: string; url: string; note: string }; onChange: (v: { kind: EvidenceKind; title: string; url: string; note: string }) => void; allowSynthetic: boolean }) {
  const { messages } = useAdminSession();
  const c = messages.admin.common;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={c.sourceKind} required>
        {(id) => (
          <Select id={id} value={value.kind} onChange={(e) => onChange({ ...value, kind: e.target.value as EvidenceKind })} data-testid="source-kind">
            <option value="OFFICIAL_DOCUMENT">{c.sourceKindOfficial}</option>
            <option value="MANUAL_TRANSCRIPTION">{c.sourceKindManual}</option>
            {allowSynthetic ? <option value="SYNTHETIC_FIXTURE">{c.sourceKindSynthetic}</option> : null}
          </Select>
        )}
      </Field>
      <Field label={c.sourceTitle} required>{(id) => <TextInput id={id} value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} required maxLength={200} data-testid="source-title" />}</Field>
      <Field label={c.sourceUrl}>{(id) => <TextInput id={id} type="url" value={value.url} onChange={(e) => onChange({ ...value, url: e.target.value })} placeholder="https://" data-testid="source-url" />}</Field>
      <Field label={c.sourceNote}>{(id) => <TextInput id={id} value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} maxLength={1000} />}</Field>
    </div>
  );
}

export function sourceToInput(v: { kind: EvidenceKind; title: string; url: string; note: string }) {
  return { kind: v.kind, title: v.title.trim(), url: v.url.trim() === '' ? null : v.url.trim(), documentHash: null, acquiredAt: null, note: v.note.trim() === '' ? null : v.note.trim() };
}

export function RulesAdmin({ lotteryId }: { lotteryId: string }) {
  const { locale, messages, csrfToken, isPublisher, session, handleAuthFailure } = useAdminSession();
  const m = messages.admin;
  const [items, setItems] = useState<AdminRuleVersion[] | null>(null);
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [json, setJson] = useState('');
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);
  const [source, setSource] = useState<{ kind: EvidenceKind; title: string; url: string; note: string }>({ kind: 'OFFICIAL_DOCUMENT', title: '', url: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogText, setDialogText] = useState('');
  const [dialogFailure, setDialogFailure] = useState<AdminFailure | null>(null);

  const load = useCallback(async () => {
    const r = await listRules(lotteryId);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    setItems(r.data.items);
  }, [lotteryId, handleAuthFailure]);
  useEffect(() => {
    // Deferred to a microtask so state updates never run synchronously inside the effect body.
    void Promise.resolve().then(() => load());
  }, [load]);

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    setFailure(null);
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(json);
    } catch {
      setJsonErrors([m.rules.jsonParseError]);
      return;
    }
    const parsed = RuleSetV1Schema.safeParse(parsedJson);
    if (!parsed.success) {
      setJsonErrors(parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`));
      return;
    }
    setJsonErrors([]);
    setBusy(true);
    const r = await createRule({ csrfToken }, lotteryId, { ruleSet: parsed.data, source: sourceToInput(source) });
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    setSuccess(m.rules.created);
    setJson('');
    void load();
  };

  const openDialog = (kind: 'approve' | 'revoke', rule: AdminRuleVersion) => {
    setDialog({ kind, rule, key: crypto.randomUUID() });
    setDialogText('');
    setDialogFailure(null);
  };
  const confirmDialog = async () => {
    if (!dialog || dialogText.trim() === '') return;
    setBusy(true);
    const r = dialog.kind === 'approve' ? await approveRule({ csrfToken }, dialog.rule.id, dialogText.trim(), dialog.key) : await revokeRule({ csrfToken }, dialog.rule.id, dialogText.trim(), dialog.key);
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setDialogFailure(r);
      return;
    }
    setSuccess(dialog.kind === 'approve' ? m.rules.approved : m.rules.revoked);
    setDialog(null);
    void load();
  };

  return (
    <AdminShell title={m.rules.title}>
      <Link href={`/${locale}/admin/lotteries`} className="touch-target inline-flex items-center font-semibold text-primary underline">
        ← {m.rules.back}
      </Link>
      <FailureBanner failure={failure} messages={messages} onReload={() => void load()} />
      <SuccessNotice text={success} />
      {items === null ? <p className="text-ink-secondary">{m.loading}</p> : items.length === 0 ? <p className="text-ink-secondary">{m.rules.noRules}</p> : (
        <ul className="space-y-3" data-testid="rules-list">
          {items.map((r) => (
            <li key={r.id} className="card px-5 py-4" data-testid={`rule-${r.version}`} data-state={r.state}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[1.1rem] font-bold">{m.rules.version} {r.version}</span>
                  <StateBadge label={m.rules.states[r.state]} tone={r.state === 'APPROVED' ? 'good' : r.state === 'REVOKED' ? 'bad' : 'neutral'} />
                  <StateBadge label={`${m.rules.compiles}: ${r.compiles ? m.common.yes : m.common.no}`} tone={r.compiles ? 'good' : 'bad'} />
                </div>
                {isPublisher ? (
                  <div className="flex gap-2">
                    {r.state === 'DRAFT' ? <button type="button" className={BTN_PRIMARY} disabled={!r.compiles} onClick={() => openDialog('approve', r)} data-testid={`approve-${r.version}`}>{m.rules.approve}</button> : null}
                    {r.state === 'APPROVED' ? <button type="button" className={BTN_DANGER} onClick={() => openDialog('revoke', r)} data-testid={`revoke-${r.version}`}>{m.rules.revoke}</button> : null}
                  </div>
                ) : null}
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-[0.95rem] sm:grid-cols-2">
                <div><dt className="text-ink-secondary">{m.rules.numberLength}</dt><dd className="font-semibold">{r.numberLength}</dd></div>
                <div><dt className="text-ink-secondary">{m.rules.allowedSeries}</dt><dd className="font-semibold tabular">{r.allowedSeries.join(', ') || m.common.none}</dd></div>
                <div className="sm:col-span-2"><dt className="text-ink-secondary">{m.rules.hash}</dt><dd className="break-all font-mono text-[0.8rem]">{r.contentHash}</dd></div>
                {r.revocationReason ? <div className="sm:col-span-2"><dt className="text-ink-secondary">{m.common.reason}</dt><dd>{r.revocationReason}</dd></div> : null}
              </dl>
              {r.compileErrors.length > 0 ? (
                <div className="mt-2 rounded-card border border-[#f5c6c0] bg-error-bg px-3 py-2 text-error">
                  <p className="font-semibold">{m.rules.compileErrors}</p>
                  <ul className="list-disc pl-5 text-[0.9rem]">{r.compileErrors.map((e, i) => <li key={i}>{e.path}: {e.code} — {e.message}</li>)}</ul>
                </div>
              ) : null}
              <details className="mt-2">
                <summary className="touch-target inline-flex cursor-pointer items-center font-semibold text-primary">{m.rules.showJson}</summary>
                <pre className="mt-2 max-h-96 overflow-auto rounded-card bg-[#f1f5f8] p-3 font-mono text-[0.8rem]">{JSON.stringify(r.ruleSet, null, 2)}</pre>
              </details>
            </li>
          ))}
        </ul>
      )}

      <section className="card px-5 py-4" aria-labelledby="new-rule">
        <h3 id="new-rule" className="text-[1.1rem] font-bold">{m.rules.newTitle}</h3>
        <p className="mt-1 text-[0.95rem] text-ink-secondary">{m.rules.newHelp}</p>
        <form onSubmit={submitNew} noValidate className="mt-3 space-y-4" data-testid="new-rule-form">
          <Field label={m.rules.json} required error={jsonErrors.length ? `${m.rules.jsonInvalid} ${jsonErrors.slice(0, 5).join('; ')}` : null}>
            {(id, describedBy) => <TextArea id={id} rows={12} value={json} onChange={(e) => setJson(e.target.value)} aria-describedby={describedBy} aria-invalid={jsonErrors.length > 0 || undefined} spellCheck={false} data-testid="rule-json" />}
          </Field>
          <SourceFields value={source} onChange={setSource} allowSynthetic={session?.dataMode === 'demo'} />
          <button type="submit" className={BTN_PRIMARY} disabled={busy}>{busy ? m.common.saving : m.common.save}</button>
        </form>
      </section>

      <ConfirmDialog open={dialog !== null} title={dialog ? (dialog.kind === 'approve' ? m.rules.approveTitle : m.rules.revokeTitle).replace('{version}', String(dialog.rule.version)) : ''} onClose={() => setDialog(null)} testId="rule-dialog">
        {dialog ? (
          <>
            <p className="text-ink-secondary">{dialog.kind === 'approve' ? m.rules.approveHelp : m.rules.revokeHelp}</p>
            <FailureBanner failure={dialogFailure} messages={messages} />
            <Field label={dialog.kind === 'approve' ? m.rules.approveNote : m.common.reason} required>{(id) => <TextArea id={id} rows={3} value={dialogText} onChange={(e) => setDialogText(e.target.value)} data-testid="rule-dialog-text" />}</Field>
            <p className="text-[0.85rem] text-ink-secondary">{m.common.idempotencyNote}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={dialog.kind === 'approve' ? BTN_PRIMARY : BTN_DANGER} disabled={busy || dialogText.trim() === ''} onClick={() => void confirmDialog()} data-testid="rule-dialog-confirm">{m.common.confirm}</button>
              <button type="button" className={BTN_SECONDARY} onClick={() => setDialog(null)}>{m.common.cancel}</button>
            </div>
          </>
        ) : null}
      </ConfirmDialog>
    </AdminShell>
  );
}

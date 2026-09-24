'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AdminRevision, AuditEvent, CategoryState, Completeness, PatchRevisionRequest, PublishResult } from '@bhagyarekha/contracts';
import { t } from '@/i18n';
import { minorToRupeesInput, parseEntryLines, rupeesToMinor } from '@/lib/admin-time';
import { getRevision, patchRevision, publishRevision, reopenRevision, revisionAudit, revisionEntries, reviewRevision, type AdminFailure, type AdminRevisionEntries } from '@/lib/admin-api';
import { formatInstant, formatLocalDate, formatMinorAmount, formatTicket } from '@/lib/format';
import { Notice } from '../Notices';
import { AdminShell } from './AdminShell';
import { AuditList } from './AuditList';
import { BTN_PRIMARY, BTN_SECONDARY, ConfirmDialog, FailureBanner, Field, Pager, Select, StateBadge, SuccessNotice, TABLE_CLASS, TD_CLASS, TH_CLASS, TextArea, TextInput } from './AdminUi';
import { useAdminSession } from './AdminSessionProvider';

type Dialog = { kind: 'review' } | { kind: 'publish'; key: string } | null;
type EditRow = { code: string; state: CategoryState; amount: string; replace: string };

export function RevisionDetail({ revisionId }: { revisionId: string }) {
  const { locale, messages, csrfToken, isPublisher, session, handleAuthFailure } = useAdminSession();
  const m = messages.admin.revisions;
  const c = messages.admin.common;
  const [rev, setRev] = useState<AdminRevision | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entriesCategory, setEntriesCategory] = useState('');
  const [entriesPage, setEntriesPage] = useState(1);
  const [entries, setEntries] = useState<AdminRevisionEntries | null>(null);
  const [editing, setEditing] = useState(false);
  const [editCompleteness, setEditCompleteness] = useState<Completeness>('COMPLETE');
  const [editReason, setEditReason] = useState('');
  const [editRows, setEditRows] = useState<EditRow[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selfReview, setSelfReview] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [reactivate, setReactivate] = useState(false);
  const [dialogFailure, setDialogFailure] = useState<AdminFailure | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  const load = useCallback(async () => {
    const [r, a] = await Promise.all([getRevision(revisionId), revisionAudit(revisionId)]);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    setRev(r.data);
    setAudit(a.ok ? a.data.items : []);
    setEntriesCategory((prev) => prev || r.data.categories[0]?.code || '');
  }, [revisionId, handleAuthFailure]);
  useEffect(() => {
    // Deferred to a microtask so state updates never run synchronously inside the effect body.
    void Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    if (!entriesCategory) return;
    let cancelled = false;
    void revisionEntries(revisionId, entriesCategory, entriesPage).then((r) => {
      if (cancelled) return;
      if (r.ok) setEntries(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [revisionId, entriesCategory, entriesPage, rev?.editVersion]);

  const startEdit = () => {
    if (!rev) return;
    setEditCompleteness(rev.completeness);
    setEditReason(rev.correctionReason ?? '');
    setEditRows(rev.categories.map((cat) => ({ code: cat.code, state: cat.state, amount: minorToRupeesInput(cat.amountMinor), replace: '' })));
    setEditError(null);
    setEditing(true);
  };
  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rev) return;
    setEditError(null);
    const body: PatchRevisionRequest = { completeness: editCompleteness, categories: [] };
    const replaceEntries: NonNullable<PatchRevisionRequest['replaceEntries']> = [];
    for (const row of editRows) {
      const amountMinor = row.amount.trim() === '' ? null : rupeesToMinor(row.amount);
      if (row.amount.trim() !== '' && amountMinor === null) {
        setEditError(`${row.code}: ${messages.admin.imports.amountInvalid}`);
        return;
      }
      body.categories!.push({ code: row.code, state: row.state, amountMinor });
      if (row.replace.trim() !== '') {
        const parsed = parseEntryLines(row.replace);
        if (parsed.badLines.length > 0) {
          setEditError(`${row.code}: ${t(m.editBadLines, { lines: parsed.badLines.join(', ') })}`);
          return;
        }
        replaceEntries.push({ categoryCode: row.code, entries: parsed.entries });
      }
    }
    if (replaceEntries.length > 0) body.replaceEntries = replaceEntries;
    if (rev.publicationKind === 'CORRECTION' && editReason.trim() !== '') body.correctionReason = editReason.trim();
    setBusy(true);
    setFailure(null);
    const r = await patchRevision({ csrfToken }, rev.id, rev.editVersion, body);
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    setRev(r.data);
    setEditing(false);
    setSuccess(m.saved);
    void load();
  };

  const doReopen = async () => {
    if (!rev) return;
    setBusy(true);
    const r = await reopenRevision({ csrfToken }, rev.id, rev.editVersion);
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    setSuccess(m.reopened);
    void load();
  };
  const doReview = async () => {
    if (!rev) return;
    setBusy(true);
    const r = await reviewRevision({ csrfToken }, rev.id, rev.editVersion, { confirmSelfReview: selfReview, note: reviewNote.trim() || null });
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setDialogFailure(r);
      return;
    }
    setDialog(null);
    setSuccess(m.reviewedDone);
    void load();
  };
  const doPublish = async () => {
    if (!rev || !dialog || dialog.kind !== 'publish') return;
    setBusy(true);
    const r = await publishRevision({ csrfToken }, rev.id, { expectedEditVersion: rev.editVersion, expectedCurrentRevisionId: rev.drawCurrentRevisionId, reactivate }, dialog.key);
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setDialogFailure(r);
      return;
    }
    setDialog(null);
    setPublishResult(r.data);
    setSuccess(t(m.publishedDone, { no: rev.revisionNo }));
    void load();
  };

  const isCreator = rev?.createdBy && session?.user.id === rev.createdBy;
  const title = rev ? t(m.detailTitle, { no: rev.revisionNo, code: rev.drawCode }) : m.title;
  const stateTone = (s: AdminRevision['workflowState']) => (s === 'PUBLISHED' ? 'good' : s === 'READY' ? 'warn' : 'neutral');

  return (
    <AdminShell title={title}>
      <FailureBanner failure={failure} messages={messages} onReload={() => void load()} />
      <SuccessNotice text={success} testId="revision-success" />
      {publishResult ? (
        <Notice tone={publishResult.isStillCurrent ? 'info' : 'warning'} iconTitle={messages.a11y.infoIcon} testId="publish-result">
          {publishResult.replayed ? m.publishedReplayed : null} {!publishResult.isStillCurrent ? m.noLongerCurrent : null} {messages.admin.lotteries.datasetVersion}: {publishResult.datasetVersion}
        </Notice>
      ) : null}
      {!rev ? <p className="text-ink-secondary">{messages.admin.loading}</p> : (
        <>
          <section className="card px-5 py-4" data-testid="revision-header" data-state={rev.workflowState}>
            <div className="flex flex-wrap items-center gap-2">
              <StateBadge label={m.states[rev.workflowState]} tone={stateTone(rev.workflowState)} />
              <StateBadge label={m.kinds[rev.publicationKind]} tone="neutral" />
              <StateBadge label={m.completeness[rev.completeness]} tone={rev.completeness === 'COMPLETE' ? 'good' : 'warn'} />
              <StateBadge label={rev.isCurrent ? c.current : c.notCurrent} tone={rev.isCurrent ? 'good' : 'neutral'} />
              {rev.drawVisibility === 'SUSPENDED' ? <StateBadge label={messages.admin.draws.visibilities.SUSPENDED} tone="bad" /> : null}
            </div>
            <p className="mt-2 text-ink-secondary">{rev.isCurrent ? m.isCurrent : m.isNotCurrent}{rev.drawVisibility === 'SUSPENDED' ? ` ${m.drawSuspended}` : ''}</p>
            <dl className="mt-3 grid gap-x-6 gap-y-2 text-[0.95rem] sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-ink-secondary">{messages.admin.draws.lottery}</dt><dd className="font-semibold">{rev.lotteryCode}</dd></div>
              <div><dt className="text-ink-secondary">{messages.admin.draws.code}</dt><dd className="font-semibold">{rev.drawCode} · <Link href={`/${locale}/results/${rev.drawId}`} className="text-primary underline">{c.publicPage}</Link></dd></div>
              <div><dt className="text-ink-secondary">{m.ruleState}</dt><dd className="font-semibold">{messages.admin.rules.states[rev.ruleState]}</dd></div>
              <div><dt className="text-ink-secondary">{m.basedOn}</dt><dd className="break-all font-mono text-[0.8rem]">{rev.basedOnRevisionId ? <Link href={`/${locale}/admin/revisions/${rev.basedOnRevisionId}`} className="text-primary underline">{rev.basedOnRevisionId}</Link> : c.none}</dd></div>
              <div><dt className="text-ink-secondary">{c.editVersion}</dt><dd className="font-semibold" data-testid="revision-edit-version">{rev.editVersion}</dd></div>
              <div><dt className="text-ink-secondary">{m.snapshot}</dt><dd>{rev.drawSnapshot.actualDate ? formatLocalDate(rev.drawSnapshot.actualDate, locale) : '—'} / {rev.drawSnapshot.scheduledDate ? formatLocalDate(rev.drawSnapshot.scheduledDate, locale) : '—'}</dd></div>
              <div className="sm:col-span-2 lg:col-span-3"><dt className="text-ink-secondary">{m.contentHash}</dt><dd className="break-all font-mono text-[0.8rem]">{rev.contentHash}</dd></div>
              <div><dt className="text-ink-secondary">{m.reviewed}</dt><dd>{rev.reviewedAt ? formatInstant(rev.reviewedAt, locale) : m.notYet}</dd></div>
              <div><dt className="text-ink-secondary">{m.published}</dt><dd>{rev.publishedAt ? formatInstant(rev.publishedAt, locale) : m.notYet}</dd></div>
              {rev.correctionReason ? <div className="sm:col-span-2 lg:col-span-3"><dt className="text-ink-secondary">{m.correctionReason}</dt><dd>{rev.correctionReason}</dd></div> : null}
            </dl>
          </section>

          <section className="card px-5 py-4" aria-labelledby="rev-actions">
            <h3 id="rev-actions" className="text-[1.1rem] font-bold">{m.actions}</h3>
            {session?.allowSelfReview ? <p className="mt-1 text-[0.9rem] text-warning-ink">{m.selfReviewWarning}</p> : null}
            <div className="mt-3 flex flex-wrap gap-3">
              {rev.workflowState === 'DRAFT' ? (
                <>
                  <button type="button" className={BTN_SECONDARY} onClick={startEdit} disabled={busy || editing} data-testid="rev-edit">{m.edit}</button>
                  {isPublisher ? <button type="button" className={BTN_PRIMARY} onClick={() => { setDialog({ kind: 'review' }); setDialogFailure(null); setSelfReview(false); }} disabled={busy} data-testid="rev-review">{m.review}</button> : null}
                </>
              ) : null}
              {rev.workflowState === 'READY' ? (
                <>
                  {isPublisher ? <button type="button" className={BTN_PRIMARY} onClick={() => { setDialog({ kind: 'publish', key: crypto.randomUUID() }); setDialogFailure(null); setReactivate(false); }} disabled={busy} data-testid="rev-publish">{m.publish}</button> : null}
                  <button type="button" className={BTN_SECONDARY} onClick={() => void doReopen()} disabled={busy} data-testid="rev-reopen">{m.reopen}</button>
                </>
              ) : null}
              {rev.workflowState === 'PUBLISHED' || rev.workflowState === 'SUPERSEDED' ? <p className="text-ink-secondary">{m.readOnly}</p> : null}
              {!isPublisher && (rev.workflowState === 'DRAFT' || rev.workflowState === 'READY') ? <p className="text-ink-secondary" data-testid="rev-publisher-needed">{messages.admin.errors.forbidden}</p> : null}
            </div>
            {editing ? (
              <form onSubmit={saveEdit} noValidate className="mt-4 space-y-4 rounded-card border border-line bg-[#fbfcfd] px-4 py-4" data-testid="rev-edit-form">
                <p className="text-[0.95rem] text-ink-secondary">{m.editHelp}</p>
                {editError ? <p role="alert" className="font-semibold text-error">{editError}</p> : null}
                <Field label={m.editCompleteness}>{(id) => <Select id={id} value={editCompleteness} onChange={(e) => setEditCompleteness(e.target.value as Completeness)} className="max-w-md">{(['COMPLETE', 'PARTIAL'] as Completeness[]).map((x) => <option key={x} value={x}>{messages.admin.imports.completenessValues[x]}</option>)}</Select>}</Field>
                {rev.publicationKind === 'CORRECTION' ? <Field label={m.correctionReason}>{(id) => <TextInput id={id} value={editReason} onChange={(e) => setEditReason(e.target.value)} />}</Field> : null}
                {editRows.map((row, i) => (
                  <fieldset key={row.code} className="rounded-card border border-line px-3 py-3" data-testid={`edit-cat-${row.code}`}>
                    <legend className="px-1 font-bold">{row.code}</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={m.catState}>{(id) => <Select id={id} value={row.state} onChange={(e) => setEditRows(editRows.map((x, j) => (j === i ? { ...x, state: e.target.value as CategoryState } : x)))}>{(['COMPLETE', 'PARTIAL', 'MISSING'] as CategoryState[]).map((s) => <option key={s} value={s}>{messages.admin.imports.catStates[s]}</option>)}</Select>}</Field>
                      <Field label={messages.admin.imports.catAmount}>{(id) => <TextInput id={id} inputMode="decimal" value={row.amount} onChange={(e) => setEditRows(editRows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />}</Field>
                    </div>
                    <div className="mt-3"><Field label={t(m.editReplace, { code: row.code })} help={m.editReplaceHelp}>{(id, d) => <TextArea id={id} rows={3} value={row.replace} onChange={(e) => setEditRows(editRows.map((x, j) => (j === i ? { ...x, replace: e.target.value } : x)))} aria-describedby={d} spellCheck={false} data-testid={`replace-${row.code}`} />}</Field></div>
                  </fieldset>
                ))}
                <div className="flex flex-wrap gap-3">
                  <button type="submit" className={BTN_PRIMARY} disabled={busy} data-testid="rev-edit-save">{busy ? c.saving : c.save}</button>
                  <button type="button" className={BTN_SECONDARY} onClick={() => setEditing(false)}>{c.cancel}</button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="card px-5 py-4" aria-labelledby="rev-cats">
            <h3 id="rev-cats" className="text-[1.1rem] font-bold">{m.categoriesHeading}</h3>
            <div className="mt-2 overflow-x-auto">
              <table className={TABLE_CLASS} data-testid="rev-categories">
                <thead><tr><th scope="col" className={TH_CLASS}>{m.catLabel}</th><th scope="col" className={TH_CLASS}>{m.catState}</th><th scope="col" className={TH_CLASS}>{m.catAmount}</th><th scope="col" className={TH_CLASS}>{m.catEntries}</th><th scope="col" className={TH_CLASS}>{m.catExpected}</th><th scope="col" className={TH_CLASS}>{m.catReviewed}</th></tr></thead>
                <tbody>
                  {rev.categories.map((cat) => (
                    <tr key={cat.code} data-testid={`rev-cat-${cat.code}`}>
                      <td className={TD_CLASS}><span className="font-semibold">{cat.label[locale]}</span> <span className="font-mono text-[0.8rem] text-ink-secondary">{cat.code}</span></td>
                      <td className={TD_CLASS}><StateBadge label={messages.admin.imports.catStates[cat.state]} tone={cat.state === 'COMPLETE' ? 'good' : cat.state === 'PARTIAL' ? 'warn' : 'neutral'} /></td>
                      <td className={TD_CLASS}>{cat.amountMinor ? formatMinorAmount(cat.amountMinor, locale) : '—'}</td>
                      <td className={TD_CLASS}>{cat.entryCount}</td>
                      <td className={TD_CLASS}>{cat.expectedEntryCount ?? '—'}</td>
                      <td className={TD_CLASS}>{cat.sourceReviewedAt ? formatInstant(cat.sourceReviewedAt, locale) : m.notYet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card px-5 py-4" aria-labelledby="rev-entries">
            <h3 id="rev-entries" className="text-[1.1rem] font-bold">{m.entriesHeading}</h3>
            <Field label={m.entriesCategory}>{(id) => <Select id={id} value={entriesCategory} onChange={(e) => { setEntriesCategory(e.target.value); setEntriesPage(1); }} className="max-w-sm" data-testid="entries-category">{rev.categories.map((cat) => <option key={cat.code} value={cat.code}>{cat.code} — {cat.label[locale]}</option>)}</Select>}</Field>
            {entries && entries.items.length > 0 ? (
              <div className="mt-2 overflow-x-auto" data-testid="rev-entries-table">
                <table className={TABLE_CLASS}>
                  <thead><tr><th scope="col" className={TH_CLASS}>{messages.admin.imports.colSeries}</th><th scope="col" className={TH_CLASS}>{messages.admin.imports.colNumber}</th><th scope="col" className={TH_CLASS}>{m.sourceRow}</th></tr></thead>
                  <tbody>{entries.items.map((e, i) => <tr key={i}><td className={`${TD_CLASS} tabular`}>{e.series || '—'}</td><td className={`${TD_CLASS} tabular text-[1.1rem] font-bold`}>{formatTicket('', e.number)}</td><td className={TD_CLASS}>{e.sourceRow ?? '—'}</td></tr>)}</tbody>
                </table>
                <Pager page={entries.page} hasNext={entries.page * entries.pageSize < entries.total} onPage={setEntriesPage} messages={messages} />
              </div>
            ) : <p className="mt-2 text-ink-secondary">{m.entriesEmpty}</p>}
          </section>

          <section className="card px-5 py-4" aria-labelledby="rev-evidence">
            <h3 id="rev-evidence" className="text-[1.1rem] font-bold">{m.evidenceHeading}</h3>
            {rev.evidence.length === 0 ? <p className="mt-2 text-ink-secondary">{m.evidenceEmpty}</p> : (
              <ul className="mt-2 divide-y divide-line">
                {rev.evidence.map((ev) => (
                  <li key={ev.id} className="py-2 text-[0.95rem]">
                    <p><StateBadge label={ev.kind} tone={ev.kind === 'SYNTHETIC_FIXTURE' ? 'warn' : 'neutral'} /> <span className="ml-2 font-semibold">{ev.title}</span></p>
                    <p className="text-ink-secondary">{ev.url ? <a href={ev.url} rel="noopener noreferrer nofollow" target="_blank" className="text-primary underline">{ev.url}</a> : messages.details.sourceNoLink} · {ev.reviewedAt ? t(messages.details.sourceReviewed, { when: formatInstant(ev.reviewedAt, locale) }) : messages.details.sourceNotReviewed}</p>
                    {ev.note ? <p className="text-ink-secondary">{ev.note}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card px-5 py-4" aria-labelledby="rev-audit">
            <h3 id="rev-audit" className="text-[1.1rem] font-bold">{c.audit}</h3>
            <div className="mt-2"><AuditList items={audit} locale={locale} messages={messages} /></div>
          </section>

          <ConfirmDialog open={dialog?.kind === 'review'} title={t(m.reviewTitle, { no: rev.revisionNo })} onClose={() => setDialog(null)} testId="review-dialog">
            <p className="text-ink-secondary">{m.reviewHelp}</p>
            <FailureBanner failure={dialogFailure} messages={messages} />
            {isCreator || session?.allowSelfReview ? (
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={selfReview} onChange={(e) => setSelfReview(e.target.checked)} className="mt-1 h-6 w-6" data-testid="self-review" />
                <span>{m.selfReview}</span>
              </label>
            ) : null}
            <Field label={c.note}>{(id) => <TextArea id={id} rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />}</Field>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void doReview()} data-testid="review-confirm">{c.confirm}</button>
              <button type="button" className={BTN_SECONDARY} onClick={() => setDialog(null)}>{c.cancel}</button>
            </div>
          </ConfirmDialog>

          <ConfirmDialog open={dialog?.kind === 'publish'} title={t(m.publishTitle, { no: rev.revisionNo })} onClose={() => setDialog(null)} testId="publish-dialog">
            <p className="text-ink-secondary">{m.publishHelp}</p>
            <p className="font-semibold">{rev.drawCurrentRevisionId ? t(m.publishSupersedes, { id: rev.drawCurrentRevisionId }) : m.publishFirst}</p>
            <FailureBanner failure={dialogFailure} messages={messages} onReload={() => void load()} />
            {rev.drawVisibility === 'SUSPENDED' ? (
              <label className="flex items-start gap-3"><input type="checkbox" checked={reactivate} onChange={(e) => setReactivate(e.target.checked)} className="mt-1 h-6 w-6" data-testid="publish-reactivate" /><span>{m.reactivate}</span></label>
            ) : null}
            <p className="text-[0.85rem] text-ink-secondary">{c.idempotencyNote}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" className={BTN_PRIMARY} disabled={busy} onClick={() => void doPublish()} data-testid="publish-confirm">{c.confirm}</button>
              <button type="button" className={BTN_SECONDARY} onClick={() => setDialog(null)}>{c.cancel}</button>
            </div>
          </ConfirmDialog>
        </>
      )}
    </AdminShell>
  );
}

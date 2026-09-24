'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { AdminDraw, AdminLottery, AdminRuleVersion, CategoryState, Completeness, EvidenceKind, ImportPreview, PublicationKind } from '@bhagyarekha/contracts';
import { rupeesToMinor } from '@/lib/admin-time';
import { createDraft, createImport, getImport, listAdminDraws, listAdminLotteries, listRules, type AdminFailure } from '@/lib/admin-api';
import { formatLocalDate } from '@/lib/format';
import { Notice } from '../Notices';
import { AdminShell } from './AdminShell';
import { BTN_PRIMARY, BTN_SECONDARY, FailureBanner, Field, Pager, Select, StateBadge, TABLE_CLASS, TD_CLASS, TH_CLASS, TextArea, TextInput } from './AdminUi';
import { useAdminSession } from './AdminSessionProvider';
import { SourceFields, sourceToInput } from './RulesAdmin';

const MAX_BYTES = 2 * 1024 * 1024;
type CategoryRow = { code: string; state: CategoryState; amount: string };

export function ImportAdmin() {
  const { locale, messages, csrfToken, session, handleAuthFailure } = useAdminSession();
  const router = useRouter();
  const m = messages.admin.imports;
  const [lotteries, setLotteries] = useState<AdminLottery[]>([]);
  const [draws, setDraws] = useState<AdminDraw[]>([]);
  const [rules, setRules] = useState<AdminRuleVersion[]>([]);
  const [lotteryId, setLotteryId] = useState('');
  const [drawId, setDrawId] = useState('');
  const [ruleVersion, setRuleVersion] = useState('');
  const [kind, setKind] = useState<PublicationKind>('INITIAL');
  const [correctionReason, setCorrectionReason] = useState('');
  const [completeness, setCompleteness] = useState<Completeness>('COMPLETE');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [source, setSource] = useState<{ kind: EvidenceKind; title: string; url: string; note: string }>({ kind: 'OFFICIAL_DOCUMENT', title: '', url: '', note: '' });
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [text, setText] = useState('');
  const [fileInfo, setFileInfo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [failure, setFailure] = useState<AdminFailure | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);

  useEffect(() => {
    void Promise.resolve()
      .then(() => listAdminLotteries())
      .then((r) => {
        if (r.ok) setLotteries(r.data.items);
        else handleAuthFailure(r);
      });
  }, [handleAuthFailure]);

  const selectRule = (version: string, pool: AdminRuleVersion[]) => {
    setRuleVersion(version);
    const rule = pool.find((r) => String(r.version) === version);
    setCategories(rule?.ruleSet ? rule.ruleSet.categories.map((c) => ({ code: c.code, state: 'COMPLETE' as CategoryState, amount: '' })) : []);
  };

  const onLotteryChange = (value: string) => {
    setLotteryId(value);
    setDraws([]);
    setRules([]);
    setDrawId('');
    setRuleVersion('');
    setCategories([]);
    if (!value) return;
    void Promise.all([listAdminDraws({ lotteryId: value }), listRules(value)]).then(([d, r]) => {
      if (d.ok) setDraws(d.data.items);
      if (r.ok) {
        const approved = r.data.items.filter((x) => x.state === 'APPROVED').sort((a, b) => b.version - a.version);
        setRules(approved);
        const latest = approved[0];
        if (latest) selectRule(String(latest.version), approved);
      }
    });
  };

  const onFile = (file: File | null) => {
    setFormError(null);
    setFileInfo(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setFormError(m.fileTooLarge);
      return;
    }
    if (file.name.toLowerCase().endsWith('.csv')) setFormat('csv');
    else if (file.name.toLowerCase().endsWith('.json')) setFormat('json');
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ''));
      setFileInfo(m.fileRead.replace('{name}', file.name).replace('{bytes}', String(file.size)));
    };
    reader.readAsText(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFailure(null);
    setPreview(null);
    const lottery = lotteries.find((l) => l.id === lotteryId);
    const draw = draws.find((d) => d.id === drawId);
    if (!lottery || !draw || !ruleVersion) {
      setFormError(m.manifestIncomplete);
      return;
    }
    if (text.trim() === '') {
      setFormError(m.dataMissing);
      return;
    }
    const manifestCategories = [];
    for (const c of categories) {
      const amountMinor = c.amount.trim() === '' ? null : rupeesToMinor(c.amount);
      if (c.amount.trim() !== '' && amountMinor === null) {
        setFormError(`${c.code}: ${m.amountInvalid}`);
        return;
      }
      manifestCategories.push({ code: c.code, state: c.state, amountMinor });
    }
    const manifest = {
      lotteryCode: lottery.code,
      drawCode: draw.drawCode,
      ruleVersion: Number(ruleVersion),
      publicationKind: kind,
      correctionReason: kind === 'CORRECTION' ? correctionReason.trim() || null : null,
      completeness,
      categories: manifestCategories,
      source: sourceToInput(source),
    };
    let body;
    if (format === 'json') {
      let entries: unknown;
      try {
        entries = JSON.parse(text);
      } catch {
        setFormError(messages.admin.rules.jsonParseError);
        return;
      }
      if (!Array.isArray(entries)) {
        setFormError(m.formatJson);
        return;
      }
      body = { format: 'json' as const, manifest, entries };
    } else {
      body = { format: 'csv' as const, manifest, csv: text };
    }
    setBusy(true);
    const r = await createImport({ csrfToken }, body);
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    setPreview(r.data);
  };

  const loadPage = useCallback(async (params: { errorsPage?: number; rowsPage?: number }) => {
    if (!preview) return;
    const r = await getImport(preview.id, { errorsPage: params.errorsPage ?? preview.errors.page, rowsPage: params.rowsPage ?? preview.rows.page });
    if (r.ok) setPreview(r.data);
    else if (!handleAuthFailure(r)) setFailure(r);
  }, [preview, handleAuthFailure]);

  const onCreateDraft = async () => {
    if (!preview) return;
    setBusy(true);
    const r = await createDraft({ csrfToken }, preview.id);
    setBusy(false);
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    router.push(`/${locale}/admin/revisions/${r.data.id}`);
  };

  return (
    <AdminShell title={m.title}>
      <p className="text-ink-secondary">{m.intro}</p>
      <Notice tone="info" iconTitle={messages.a11y.infoIcon}>{m.notPublished}</Notice>
      <FailureBanner failure={failure} messages={messages} />
      <form onSubmit={submit} noValidate className="space-y-4" data-testid="import-form">
        <section className="card space-y-4 px-5 py-4" aria-labelledby="manifest-h">
          <h3 id="manifest-h" className="text-[1.1rem] font-bold">{m.manifest}</h3>
          {formError ? <p role="alert" data-testid="import-form-error" className="font-semibold text-error">{formError}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={m.lottery} required>{(id) => <Select id={id} value={lotteryId} onChange={(e) => onLotteryChange(e.target.value)} data-testid="import-lottery"><option value="">—</option>{lotteries.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name[locale]}</option>)}</Select>}</Field>
            <Field label={m.draw} required>{(id) => <Select id={id} value={drawId} onChange={(e) => setDrawId(e.target.value)} disabled={!lotteryId} data-testid="import-draw"><option value="">{m.drawPlaceholder}</option>{draws.map((d) => <option key={d.id} value={d.id}>{d.drawCode} · {formatLocalDate(d.actualDate ?? d.scheduledDate ?? '', locale)}{d.currentRevisionId ? ' · published' : ''}</option>)}</Select>}</Field>
            <Field label={m.ruleVersion} required help={lotteryId && rules.length === 0 ? m.noApprovedRules : undefined}>{(id, d) => <Select id={id} value={ruleVersion} onChange={(e) => selectRule(e.target.value, rules)} disabled={rules.length === 0} aria-describedby={d} data-testid="import-rule"><option value="">{m.rulePlaceholder}</option>{rules.map((r) => <option key={r.id} value={String(r.version)}>v{r.version} · {r.numberLength} digits</option>)}</Select>}</Field>
            <Field label={m.publicationKind} required>{(id) => <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as PublicationKind)} data-testid="import-kind">{(['INITIAL', 'UPDATE', 'CORRECTION'] as PublicationKind[]).map((k) => <option key={k} value={k}>{m.kinds[k]}</option>)}</Select>}</Field>
            {kind === 'CORRECTION' ? <Field label={m.correctionReason} required>{(id) => <TextInput id={id} value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} required />}</Field> : null}
            <Field label={m.completeness} required>{(id) => <Select id={id} value={completeness} onChange={(e) => setCompleteness(e.target.value as Completeness)} data-testid="import-completeness">{(['COMPLETE', 'PARTIAL'] as Completeness[]).map((c) => <option key={c} value={c}>{m.completenessValues[c]}</option>)}</Select>}</Field>
          </div>
          <div>
            <h4 className="font-bold">{m.categories}</h4>
            <p className="text-[0.9rem] text-ink-secondary">{m.categoriesHelp}</p>
            {categories.length > 0 ? (
              <div className="mt-2 overflow-x-auto">
                <table className={TABLE_CLASS} data-testid="import-categories">
                  <thead><tr><th scope="col" className={TH_CLASS}>{m.catCode}</th><th scope="col" className={TH_CLASS}>{m.catState}</th><th scope="col" className={TH_CLASS}>{m.catAmount}</th></tr></thead>
                  <tbody>
                    {categories.map((c, i) => (
                      <tr key={c.code}>
                        <td className={`${TD_CLASS} font-mono font-semibold`}>{c.code}</td>
                        <td className={TD_CLASS}><label className="sr-only" htmlFor={`cat-state-${c.code}`}>{m.catState} {c.code}</label><Select id={`cat-state-${c.code}`} value={c.state} onChange={(e) => setCategories(categories.map((x, j) => (j === i ? { ...x, state: e.target.value as CategoryState } : x)))} className="mt-0" data-testid={`cat-state-${c.code}`}>{(['COMPLETE', 'PARTIAL', 'MISSING'] as CategoryState[]).map((s) => <option key={s} value={s}>{m.catStates[s]}</option>)}</Select></td>
                        <td className={TD_CLASS}><label className="sr-only" htmlFor={`cat-amount-${c.code}`}>{m.catAmount} {c.code}</label><TextInput id={`cat-amount-${c.code}`} inputMode="decimal" value={c.amount} onChange={(e) => setCategories(categories.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} className="mt-0" data-testid={`cat-amount-${c.code}`} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          <div>
            <h4 className="font-bold">{m.source}</h4>
            <div className="mt-2"><SourceFields value={source} onChange={setSource} allowSynthetic={session?.dataMode === 'demo'} /></div>
          </div>
        </section>

        <section className="card space-y-4 px-5 py-4" aria-labelledby="data-h">
          <h3 id="data-h" className="text-[1.1rem] font-bold">{m.data}</h3>
          <Field label={m.format}>{(id) => <Select id={id} value={format} onChange={(e) => setFormat(e.target.value as 'json' | 'csv')} className="max-w-md" data-testid="import-format"><option value="json">{m.formatJson}</option><option value="csv">{m.formatCsv}</option></Select>}</Field>
          <Field label={m.file} help={fileInfo ?? m.fileHelp}>{(id, d) => <input id={id} type="file" accept=".csv,.json,text/csv,application/json" onChange={(e) => onFile(e.target.files?.[0] ?? null)} aria-describedby={d} className="mt-1 block" data-testid="import-file" />}</Field>
          <Field label={m.paste}>{(id) => <TextArea id={id} rows={8} value={text} onChange={(e) => { setText(e.target.value); setFileInfo(null); }} spellCheck={false} data-testid="import-text" />}</Field>
          <button type="submit" className={BTN_PRIMARY} disabled={busy} data-testid="import-submit">{busy ? m.submitting : m.submit}</button>
        </section>
      </form>

      {preview ? (
        <section className="card space-y-4 px-5 py-4" aria-labelledby="preview-h" data-testid="import-preview" data-status={preview.status}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="preview-h" className="text-[1.1rem] font-bold">{m.preview}</h3>
            <span><span className="sr-only">{m.statusLabel}: </span><StateBadge label={m.statuses[preview.status]} tone={preview.status === 'VALIDATION_FAILED' ? 'bad' : preview.status === 'PREVIEW_READY' ? 'good' : 'neutral'} /></span>
          </div>
          <dl className="grid gap-x-6 gap-y-1 text-[0.95rem] sm:grid-cols-4">
            <div><dt className="text-ink-secondary">{m.totalRows}</dt><dd className="font-semibold" data-testid="preview-total">{preview.summary.totalRows}</dd></div>
            <div><dt className="text-ink-secondary">{m.validRows}</dt><dd className="font-semibold">{preview.summary.validRows}</dd></div>
            <div><dt className="text-ink-secondary">{m.errorCount}</dt><dd className="font-semibold" data-testid="preview-errors">{preview.summary.errorCount}</dd></div>
            <div><dt className="text-ink-secondary">{m.rowsPerCategory}</dt><dd className="font-semibold">{Object.entries(preview.summary.rowsPerCategory).map(([k, v]) => `${k}: ${v}`).join(', ') || '—'}</dd></div>
            <div className="sm:col-span-4"><dt className="text-ink-secondary">{m.uploadHash}</dt><dd className="break-all font-mono text-[0.8rem]">{preview.uploadSha256}</dd></div>
          </dl>
          {preview.errors.total > 0 ? (
            <div>
              <h4 className="font-bold">{m.errorsHeading} ({preview.errors.total})</h4>
              <div className="mt-2 overflow-x-auto">
                <table className={TABLE_CLASS} data-testid="preview-error-table">
                  <thead><tr><th scope="col" className={TH_CLASS}>{m.errRow}</th><th scope="col" className={TH_CLASS}>{m.errPath}</th><th scope="col" className={TH_CLASS}>{m.errCode}</th><th scope="col" className={TH_CLASS}>{m.errMessage}</th></tr></thead>
                  <tbody>{preview.errors.items.map((e, i) => <tr key={i}><td className={TD_CLASS}>{e.row === 0 ? m.manifestRow : e.row}</td><td className={`${TD_CLASS} font-mono text-[0.85rem]`}>{e.path}</td><td className={`${TD_CLASS} font-mono text-[0.85rem]`}>{e.code}</td><td className={TD_CLASS}>{e.message}</td></tr>)}</tbody>
                </table>
              </div>
              <Pager page={preview.errors.page} hasNext={preview.errors.page * preview.errors.pageSize < preview.errors.total} onPage={(p) => void loadPage({ errorsPage: p })} messages={messages} />
            </div>
          ) : null}
          <div>
            <h4 className="font-bold">{m.rowsHeading} ({preview.rows.total})</h4>
            {preview.rows.items.length > 0 ? (
              <div className="mt-2 overflow-x-auto">
                <table className={TABLE_CLASS} data-testid="preview-rows-table">
                  <thead><tr><th scope="col" className={TH_CLASS}>{m.errRow}</th><th scope="col" className={TH_CLASS}>{m.catCode}</th><th scope="col" className={TH_CLASS}>{m.colSeries}</th><th scope="col" className={TH_CLASS}>{m.colNumber}</th></tr></thead>
                  <tbody>{preview.rows.items.map((r) => <tr key={r.row}><td className={TD_CLASS}>{r.row}</td><td className={`${TD_CLASS} font-mono`}>{r.categoryCode}</td><td className={`${TD_CLASS} tabular`}>{r.series || '—'}</td><td className={`${TD_CLASS} tabular font-semibold`}>{r.number}</td></tr>)}</tbody>
                </table>
                <Pager page={preview.rows.page} hasNext={preview.rows.page * preview.rows.pageSize < preview.rows.total} onPage={(p) => void loadPage({ rowsPage: p })} messages={messages} />
              </div>
            ) : <p className="text-ink-secondary">{messages.admin.common.empty}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={BTN_PRIMARY} disabled={busy || preview.status !== 'PREVIEW_READY'} onClick={() => void onCreateDraft()} data-testid="create-draft">{busy ? m.creatingDraft : m.createDraft}</button>
            {preview.createdRevisionId ? <a href={`/${locale}/admin/revisions/${preview.createdRevisionId}`} className={BTN_SECONDARY}>{messages.admin.draws.viewRevision}</a> : null}
            <span className="text-[0.9rem] text-ink-secondary">{m.createDraftHelp}</span>
          </div>
          <Notice tone="info" iconTitle={messages.a11y.infoIcon}>{m.notPublished}</Notice>
        </section>
      ) : null}
    </AdminShell>
  );
}

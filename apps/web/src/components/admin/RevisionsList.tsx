'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { RevisionState } from '@bhagyarekha/contracts';
import { listRevisions, type AdminFailure, type AdminRevisionList } from '@/lib/admin-api';
import { formatInstant } from '@/lib/format';
import { AdminShell } from './AdminShell';
import { FailureBanner, Field, Pager, Select, StateBadge, TABLE_CLASS, TD_CLASS, TH_CLASS } from './AdminUi';
import { useAdminSession } from './AdminSessionProvider';

const STATES: RevisionState[] = ['DRAFT', 'READY', 'PUBLISHED', 'SUPERSEDED'];

export function RevisionsList() {
  const { locale, messages, handleAuthFailure } = useAdminSession();
  const m = messages.admin;
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminRevisionList['items'] | null>(null);
  const [failure, setFailure] = useState<AdminFailure | null>(null);

  const load = useCallback(async () => {
    const r = await listRevisions({ state: state || undefined, page });
    if (!r.ok) {
      if (!handleAuthFailure(r)) setFailure(r);
      return;
    }
    setItems(r.data.items);
  }, [state, page, handleAuthFailure]);
  useEffect(() => {
    // Deferred to a microtask so state updates never run synchronously inside the effect body.
    void Promise.resolve().then(() => load());
  }, [load]);

  return (
    <AdminShell title={m.revisions.title}>
      <FailureBanner failure={failure} messages={messages} onReload={() => void load()} />
      <section className="card px-5 py-4">
        <Field label={m.revisions.filterState}>{(id) => <Select id={id} value={state} onChange={(e) => { setState(e.target.value); setPage(1); }} className="max-w-sm" data-testid="revision-filter"><option value="">{m.revisions.allStates}</option>{STATES.map((s) => <option key={s} value={s}>{m.revisions.states[s]}</option>)}</Select>}</Field>
        {items === null ? <p className="mt-3 text-ink-secondary">{m.loading}</p> : items.length === 0 ? <p className="mt-3 text-ink-secondary">{m.revisions.noRevisions}</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className={TABLE_CLASS} data-testid="revisions-table">
              <thead><tr><th scope="col" className={TH_CLASS}>{m.draws.lottery}</th><th scope="col" className={TH_CLASS}>{m.draws.code}</th><th scope="col" className={TH_CLASS}>{m.revisions.revisionNo}</th><th scope="col" className={TH_CLASS}>{m.common.state}</th><th scope="col" className={TH_CLASS}>{m.revisions.kind}</th><th scope="col" className={TH_CLASS}>{m.revisions.completenessLabel}</th><th scope="col" className={TH_CLASS}>{m.common.updated}</th></tr></thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td className={TD_CLASS}>{r.lotteryCode}</td>
                    <td className={TD_CLASS}><Link href={`/${locale}/admin/revisions/${r.id}`} className="font-semibold text-primary underline">{r.drawCode}</Link></td>
                    <td className={TD_CLASS}>{r.revisionNo}{r.isCurrent ? <span className="ml-2"><StateBadge label={m.common.current} tone="good" /></span> : null}</td>
                    <td className={TD_CLASS}><StateBadge label={m.revisions.states[r.workflowState]} tone={r.workflowState === 'PUBLISHED' ? 'good' : r.workflowState === 'READY' ? 'warn' : 'neutral'} /></td>
                    <td className={TD_CLASS}>{m.revisions.kinds[r.publicationKind]}</td>
                    <td className={TD_CLASS}>{m.revisions.completeness[r.completeness]}</td>
                    <td className={`${TD_CLASS} whitespace-nowrap`}>{formatInstant(r.updatedAt, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} hasNext={items.length >= 20} onPage={setPage} messages={messages} />
          </div>
        )}
      </section>
    </AdminShell>
  );
}

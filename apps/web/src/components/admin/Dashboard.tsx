'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AdminDraw } from '@bhagyarekha/contracts';
import { formatLocalDate } from '@/lib/format';
import { listAdminDraws, listRevisions, type AdminFailure, type AdminRevisionList } from '@/lib/admin-api';
import { AdminShell } from './AdminShell';
import { BTN_SECONDARY, FailureBanner, StateBadge, TABLE_CLASS, TD_CLASS, TH_CLASS } from './AdminUi';
import { useAdminSession } from './AdminSessionProvider';

export function Dashboard() {
  const { locale, messages, handleAuthFailure } = useAdminSession();
  const m = messages.admin;
  const [draws, setDraws] = useState<AdminDraw[] | null>(null);
  const [revisions, setRevisions] = useState<AdminRevisionList['items'] | null>(null);
  const [failure, setFailure] = useState<AdminFailure | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [d, r] = await Promise.all([listAdminDraws({ page: 1 }), listRevisions({ page: 1 })]);
      if (cancelled) return;
      if (!d.ok) {
        if (!handleAuthFailure(d)) setFailure(d);
        return;
      }
      setDraws(d.data.items);
      setRevisions(r.ok ? r.data.items : []);
    })();
    return () => {
      cancelled = true;
    };
  }, [handleAuthFailure]);

  return (
    <AdminShell title={m.dashboard.title}>
      <FailureBanner failure={failure} messages={messages} />
      <section aria-labelledby="quick-links" className="card px-5 py-4">
        <h3 id="quick-links" className="text-[1.1rem] font-bold">
          {m.dashboard.quickLinks}
        </h3>
        <ul className="mt-3 flex flex-wrap gap-3">
          <li><Link href={`/${locale}/admin/imports`} className={BTN_SECONDARY} data-testid="dash-import">{m.dashboard.importCta}</Link></li>
          <li><Link href={`/${locale}/admin/draws`} className={BTN_SECONDARY}>{m.dashboard.drawsCta}</Link></li>
          <li><Link href={`/${locale}/admin/revisions`} className={BTN_SECONDARY}>{m.dashboard.revisionsCta}</Link></li>
          <li><Link href={`/${locale}/admin/lotteries`} className={BTN_SECONDARY}>{m.dashboard.lotteriesCta}</Link></li>
        </ul>
      </section>

      <section aria-labelledby="dash-draws" className="card px-5 py-4">
        <h3 id="dash-draws" className="text-[1.1rem] font-bold">{m.dashboard.drawsHeading}</h3>
        {draws === null ? <p className="mt-2 text-ink-secondary">{m.loading}</p> : draws.length === 0 ? <p className="mt-2 text-ink-secondary">{m.dashboard.noDraws}</p> : (
          <div className="mt-3 overflow-x-auto">
            <table className={TABLE_CLASS} data-testid="dash-draws-table">
              <thead>
                <tr>
                  <th scope="col" className={TH_CLASS}>{m.draws.lottery}</th>
                  <th scope="col" className={TH_CLASS}>{m.draws.code}</th>
                  <th scope="col" className={TH_CLASS}>{m.draws.actualDate}</th>
                  <th scope="col" className={TH_CLASS}>{m.draws.phase}</th>
                  <th scope="col" className={TH_CLASS}>{m.draws.visibility}</th>
                  <th scope="col" className={TH_CLASS}>{m.dashboard.currentRevision}</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((d) => (
                  <tr key={d.id}>
                    <td className={TD_CLASS}>{d.lotteryCode}</td>
                    <td className={`${TD_CLASS} font-semibold`}>{d.drawCode}</td>
                    <td className={TD_CLASS}>{formatLocalDate(d.actualDate ?? d.scheduledDate ?? '', locale)}</td>
                    <td className={TD_CLASS}><StateBadge label={m.draws.phases[d.phase]} tone={d.phase === 'CANCELLED' ? 'neutral' : 'good'} /></td>
                    <td className={TD_CLASS}><StateBadge label={m.draws.visibilities[d.visibility]} tone={d.visibility === 'SUSPENDED' ? 'bad' : 'neutral'} /></td>
                    <td className={TD_CLASS}>
                      {d.currentRevisionId ? <Link href={`/${locale}/admin/revisions/${d.currentRevisionId}`} className="font-semibold text-primary underline">{m.draws.viewRevision}</Link> : <span className="text-ink-secondary">{m.draws.noCurrent}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="dash-revs" className="card px-5 py-4">
        <h3 id="dash-revs" className="text-[1.1rem] font-bold">{m.dashboard.revisionsHeading}</h3>
        {revisions === null ? <p className="mt-2 text-ink-secondary">{m.loading}</p> : revisions.length === 0 ? <p className="mt-2 text-ink-secondary">{m.dashboard.noRevisions}</p> : (
          <ul className="mt-3 divide-y divide-line">
            {revisions.slice(0, 10).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/${locale}/admin/revisions/${r.id}`} className="font-semibold text-primary underline">
                  {r.lotteryCode} · {r.drawCode} · {m.revisions.revisionNo} {r.revisionNo}
                </Link>
                <span className="flex gap-2">
                  <StateBadge label={m.revisions.states[r.workflowState]} tone={r.workflowState === 'PUBLISHED' ? 'good' : r.workflowState === 'READY' ? 'warn' : 'neutral'} />
                  <StateBadge label={m.revisions.kinds[r.publicationKind]} tone="neutral" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  );
}

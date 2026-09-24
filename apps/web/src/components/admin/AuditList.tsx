'use client';

import type { AuditEvent } from '@bhagyarekha/contracts';
import type { Locale, Messages } from '@/i18n';
import { formatInstant } from '@/lib/format';
import { TABLE_CLASS, TD_CLASS, TH_CLASS } from './AdminUi';

export function AuditList({ items, locale, messages }: { items: AuditEvent[]; locale: Locale; messages: Messages }) {
  const c = messages.admin.common;
  if (items.length === 0) return <p className="text-ink-secondary">{c.auditEmpty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className={TABLE_CLASS} data-testid="audit-list">
        <thead>
          <tr>
            <th scope="col" className={TH_CLASS}>{c.auditWhen}</th>
            <th scope="col" className={TH_CLASS}>{c.auditAction}</th>
            <th scope="col" className={TH_CLASS}>{c.auditActor}</th>
            <th scope="col" className={TH_CLASS}>{c.auditDetails}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.id} data-action={e.action}>
              <td className={`${TD_CLASS} whitespace-nowrap`}>{formatInstant(e.createdAt, locale)}</td>
              <td className={`${TD_CLASS} font-mono text-[0.85rem]`}>{e.action}</td>
              <td className={TD_CLASS}>{e.actorEmail ?? e.actorId ?? '—'}</td>
              <td className={TD_CLASS}>
                {Object.keys(e.metadata).length > 0 ? <pre className="max-w-[28rem] whitespace-pre-wrap break-all font-mono text-[0.8rem] text-ink-secondary">{JSON.stringify(e.metadata)}</pre> : <span className="text-ink-secondary">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

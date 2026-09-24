# Synthetic examples

All files under `docs/examples/` and all values in `apps/api/src/fixtures/demo-fixtures.ts`
are invented. They exist to exercise the implementation and must never be imported into a
live database (the seed refuses; the mode marker is immutable).

## Demo dataset summary (what `pnpm seed:demo` writes)

| Lottery (sample) | Draw | Date (IST) | State shown |
|---|---|---|---|
| Nila Weekly | NL-036 | 3 Sep 2026 | Published, complete |
| Nila Weekly | NL-037 | 10 Sep 2026 | **Temporarily unavailable** (published payload suspended) |
| Nila Weekly | NL-038 | 17 Sep 2026 | Published, complete (same date as SB-2026-01) |
| Nila Weekly | NL-039 | 24 Sep 2026 | Published, complete — the "latest" result, first prize AA 001234 |
| Nila Weekly | NL-040 | 1 Oct 2026 | Scheduled, no result (the "pending" draw) |
| Thira Weekly | TH-036 | 8 Sep 2026 | Published, complete |
| Thira Weekly | TH-037 | sched. 15 Sep, held 16 Sep 2026 | Postponed; **corrected** (revision 2 supersedes revision 1) |
| Thira Weekly | TH-038 | 22 Sep 2026 | **Partially published** (SECOND missing, LAST3 partial); first prize BB 000077 |
| Thira Weekly | TH-039 | 23 Sep 2026 | Held, awaiting result |
| Sample Bumper | SB-2026-01 | 17 Sep 2026 | Published, complete; rule version **revoked** ⇒ viewable, not checkable |
| Sample Bumper | SB-2026-02 | 30 Sep 2026 | Cancelled |

Ticket numbers with leading zeros (`001234`, `000077`, `0123456`, suffix `0042`) are
included deliberately to prove string handling end to end.

## Import format (Stage 3 — documented ahead of implementation)

A JSON import will carry a manifest (draw/rule identity, source metadata, publication
kind, based-on revision, **every category's completeness and amount**) plus category
entries. CSV imports carry the same manifest as a separate JSON field and rows
`categoryCode,series,number`. Completeness is never inferred from row counts. See LLD §5.

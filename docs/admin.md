# Admin operations (Stage 3)

Everything here is server-enforced. Hiding a button is not authorization; every admin
endpoint checks the session cookie, the role, the Origin header and the CSRF token.

## Accounts and sessions

* No public registration. Create operators with the CLI (password read from stdin, Argon2id):
  `pnpm admin:create -- --email ops@example.org --role PUBLISHER|EDITOR`
* Roles: **EDITOR** (draws, rule drafts, imports, draft edits, corrections) and **PUBLISHER**
  (everything an editor can do, plus lotteries, rule approval/revocation, review, publish, suspend/resume).
* Sessions: opaque 32-byte token in an HttpOnly, SameSite=Lax cookie (`__Host-br_admin` when
  Secure; `br_admin` only with `INSECURE_DEV_COOKIES=true` outside production). Only the
  SHA-256 of the token is stored. Idle timeout `SESSION_IDLE_MINUTES` (30), absolute
  `SESSION_ABSOLUTE_HOURS` (8). Logout, disabling a user or bumping `auth_version` revokes sessions.
* Login is throttled: 5 failures per account per 15 minutes plus an IP limit; never a permanent lockout.
* Unsafe requests (POST/PATCH) must carry `Origin: <ALLOWED_ORIGIN or PUBLIC_BASE_URL>`,
  `Content-Type: application/json` and `X-CSRF-Token` equal to the session's token returned by
  `GET /api/v1/auth/session`. The web keeps that token in memory only.

## Headers used by admin mutations

| Header | Where | Meaning |
|---|---|---|
| `If-Match: <editVersion>` | PATCH lottery/draw/revision, reopen, review | Optimistic concurrency; mismatch → 409 `REVISION_CONFLICT` |
| `Idempotency-Key: <8–128 chars>` | publish, approve/revoke rule, suspend/resume | Same key + same body replays the committed response (`Idempotent-Replayed: true`); same key + different body → 409 `IDEMPOTENCY_CONFLICT`. Kept 72 h |

## Import → draft → review → publish

1. **Create the draw** (`POST /admin/draws`): lottery, draw code, local dates; instants must agree
   with their date in Asia/Kolkata (rejected otherwise). Identity is never changed later.
2. **Import** (`POST /admin/imports`): JSON envelope `{format:'json', manifest, entries}` or
   `{format:'csv', manifest, csv}` where `csv` is the raw file text with header
   `categoryCode,series,number`. Limits: 2 MiB, 20 000 entries, 10 s. Every row is a string;
   a JSON number is rejected because spreadsheets drop leading zeros. The **manifest** states
   lottery/draw/rule identity, publication kind (INITIAL / UPDATE / CORRECTION + reason),
   overall completeness, **every category's state and amount**, and the source reference.
   Completeness is never inferred from rows. Validation reports every problem with its 1-based
   row (duplicates, wrong lengths, unknown categories, rows for MISSING categories, expected
   count mismatches, COMPLETE without rows, INITIAL on an already published draw, …).
   Result: `VALIDATION_FAILED` or `PREVIEW_READY`. Nothing is public.
3. **Create draft** (`POST /admin/imports/:id/create-draft`): only from `PREVIEW_READY`; locks
   lottery → draw, allocates the revision number, records `basedOnRevisionId` from the draw's
   current pointer (the client cannot choose it), materialises every configured category,
   inserts entries and evidence. Repeating the call returns the same draft.
4. **Edit** (`PATCH /admin/revisions/:id`, DRAFT only): category states/amounts, completeness,
   correction reason, replace entries per category, snapshot dates. Every edit recomputes the
   content hash and clears review metadata. READY must be reopened first.
5. **Review** (`POST /admin/revisions/:id/review`, PUBLISHER): checks rule approval, manifest
   consistency, counts, amounts, evidence; marks evidence and complete categories as reviewed;
   freezes `reviewedHash = contentHash`; state → READY. The last editor may only review their
   own work when `ALLOW_SELF_REVIEW=true` **and** `confirmSelfReview` is sent; the audit event
   records `selfReview: true`. Self-review is never independent verification.
6. **Publish** (`POST /admin/revisions/:id/publish`, PUBLISHER, Idempotency-Key): one
   transaction — lock lottery, draw, revision; verify `expectedEditVersion`, that the draw's
   current pointer equals both `expectedCurrentRevisionId` and the draft's `basedOnRevisionId`,
   READY with matching reviewed hash, invariants re-checked; supersede the old revision; publish;
   move the pointer and apply the snapshot dates; bump `dataset_version`; write audit events.
   Any failure (including a failed audit insert) rolls everything back. Two publishers racing
   on one draw: exactly one commits, the other receives 409.

## Corrections, suspension, rules

* **Correction** (`POST /admin/draws/:id/corrections`): clones the current revision into a new
  DRAFT of kind CORRECTION with a reason and new evidence; then edit → review → publish. The
  earlier payload is preserved and shown publicly as superseded ("Corrected" badge).
* **Suspend / resume** (`POST /admin/draws/:id/suspend|resume`, PUBLISHER, Idempotency-Key,
  reason, `expectedEditVersion`): public reads withhold the payload and ticket checks answer
  `RESULT_SUSPENDED`; history stays for audit. Publishing with `reactivate: true` can restore visibility.
* **Rules**: `POST /admin/lotteries/:id/rules` creates a DRAFT version from a `RuleSetV1` plus
  source; approval (PUBLISHER, Idempotency-Key) requires compilation and evidence and freezes
  the content (database trigger); revocation records a reason, bumps `dataset_version`, and
  makes automatic checking `RULES_UNSUPPORTED` while results stay viewable.

## Audit

`audit_event` is append-only (database trigger). Every mutation writes at least one event
inside its own transaction with actor, action, entity, before/after content hashes, small
allowlisted metadata and the request ID. `GET /admin/revisions/:id/audit` and
`GET /admin/draws/:id/audit` list them.

## Not in this stage

Multi-factor authentication or a restricted access layer in front of `/admin` (required before
exposing admin publicly), password reset flow (operator CLI only), file-based CSV upload
(the web reads the file and sends its text), scheduled cleanup of expired sessions and
idempotency rows (documented maintenance CLI, not yet implemented).

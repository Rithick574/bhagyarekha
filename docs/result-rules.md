# Prize-matching rules

## Model

Rules are **versioned, declarative and closed** (LLD §4). A `RuleSetV1` has:

* `numberLength` (1–12), `allowedFirstDigits`, `allowedSeries`
* `awardPolicy: 'SINGLE_BY_PRIORITY'` — one award, the highest-priority matching category
* `categories[]` each with `code`, EN/ML labels, `metricRole` (FIRST_PRIZE / OTHER),
  `priority` (lower number wins), `match`, `excludedBy[]`, `expectedEntryCount`

Match kinds supported by engine v1:

| kind | seriesPolicy | Meaning |
|---|---|---|
| `FULL_NUMBER` | `MATCH_ENTRY` | series and full number equal the entry |
| `FULL_NUMBER` | `EXCEPT_ENTRY` | full number equals the entry, ticket series is an *allowed* series different from the entry's |
| `FULL_NUMBER` | `ANY_ALLOWED` | full number equals the entry, any allowed series |
| `SUFFIX` | `ANY_ALLOWED` | last `suffixLength` digits equal the entry (entries are stored as the suffix string with empty series) |

Not supported in v1: stacking of prizes, arbitrary expressions, regex, per-position
wildcards. A real scheme that cannot be represented stays **unsupported**.

## Storage

`rule_version` + `rule_category` rows are the source of truth. Approved content is
immutable (database trigger); a change means a new version. Revocation is a state
change with a reason. `content_hash` is the SHA-256 of the canonical JSON wire form.

## Compiler (packages/domain)

`compileRuleSet()` rejects: duplicate codes/priorities, unknown/self/lower-priority
exclusion targets, exclusion cycles, suffix longer than the number, duplicate domains,
and FIRST_PRIZE categories with differing match specs. Any error ⇒ the rule set is not
compilable ⇒ checking capability is `UNSUPPORTED` (`RULE_NOT_COMPILABLE`).

## Fixture rules (synthetic)

| Lottery (sample) | Number | Series | Categories |
|---|---|---|---|
| Nila Weekly | 6 digits | AA AB AC | FIRST (match entry), CONSOLATION (except entry), LAST4 (suffix 4) |
| Thira Weekly | 6 digits | BA BB BC | FIRST, SECOND, LAST3 (suffix 3, 10 expected) |
| Sample Bumper | 7 digits | SA SB | FIRST, LAST5 — rule **revoked** to demonstrate viewable-but-uncheckable |

These are engine exercises. **They are not Kerala lottery rules.** Real rules require
source-backed, reviewed configuration before any live checking is enabled.

## Evaluator (packages/domain, Stage 2)

`normalizeTicketInput` trims outer whitespace and upper-cases the series. Nothing else is
changed: internal spaces, separators, non-ASCII digits, wrong lengths are rejected with a
field code (`EMPTY`, `DIGITS_REQUIRED`, `INTERNAL_WHITESPACE`, `LETTERS_REQUIRED`, `TOO_LONG`).

`validateTicketDomain` checks the ticket against the checked revision's rule before any
matching: `SERIES_REQUIRED` / `SERIES_NOT_ALLOWED`, `WRONG_LENGTH`, `FIRST_DIGIT_NOT_ALLOWED`.
An invalid series therefore never reaches `EXCEPT_ENTRY`.

`evaluateTicket(rules, snapshot, ticket)` works on ONE revision snapshot:

1. Raw match per category (FULL_NUMBER compares the whole string; SUFFIX compares the fixed-length ending).
2. Award = highest-priority raw match not excluded by a higher-priority raw match. One award only; amounts are never summed.
3. If any category is not COMPLETE: `PARTIAL_MATCH` (`awardConfirmed=false`, `amountMinor=null`) when a raw match exists, otherwise `RESULT_INCOMPLETE`. `NO_MATCH` is impossible with incomplete data (INV-08/09).
4. A revision labelled COMPLETE with a non-complete or missing category is an integrity failure → HTTP 503, never a verdict.

The API (`POST /api/v1/ticket-check`) answers non-verdict states first — `DRAW_CANCELLED`,
`RESULT_SUSPENDED`, `RESULT_NOT_PUBLISHED`, then `RULES_UNSUPPORTED` when the rule is not
approved or does not compile — then validates the ticket domain, loads only entries whose
number equals the ticket or one of its configured suffixes, and evaluates inside a read-only
repeatable-read transaction. `expectedRevisionId` mismatches return 409 `RESULT_CHANGED`.
The ticket is never stored, logged or echoed (integration test T27 inspects logs and every table).

`checking.capability` on draw detail is `SUPPORTED` only for a published, active draw whose rule
is approved and compilable.

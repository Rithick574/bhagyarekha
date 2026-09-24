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

## Checking capability in Stage 1

The evaluator ships in Stage 2. Until then every draw reports
`checking.capability = UNSUPPORTED` / `CHECKER_NOT_AVAILABLE` (or a more specific reason:
no published result, suspended, cancelled, rule revoked/not approved/not compilable).

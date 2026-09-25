# History and descriptive statistics (Stage 4)

## History

* `GET /api/v1/draws` lists recorded draws with `lotteryId`, inclusive IST `from`/`to`,
  exact `drawCode` (case-insensitive) and bounded pagination. Filters are URL parameters, so a
  filtered list is shareable.
* `POST /api/v1/history/search` searches published numbers. The number is posted, never put in
  a URL, log line or stored anywhere. `searchType` is `FULL` (whole number, full-number
  categories) or `SUFFIX` (suffix-category entries of exactly that length plus full numbers
  ending in it). Range defaults to the last 366 days and may not exceed 366 days.
* Only draws with a **current, active, published** revision are searched. The response's
  `unsearchableDrawCount` states how many draws in the range were unpublished, suspended or
  cancelled, so "not found" is never read as "did not win". Superseded revisions are never searched.
* An empty list means no recorded draw matched; a gap in this archive does not mean no draw took place.

## Statistics — what exactly is computed

`GET /api/v1/statistics?lotteryId&from&to&metric=FIRST_PRIZE&ruleVersionId?` (range ≤ 366 days,
rate limited by `RATE_LIMIT_STATS_PER_MINUTE`).

**Observation selection (LLD §8.1)** — inside one read-only repeatable-read snapshot:

| Draw state | Counted? | Reported under |
|---|---|---|
| Cancelled | no | `excludedDrawCounts.CANCELLED` |
| Suspended | no | `SUSPENDED` |
| No current published revision | no | `NOT_PUBLISHED` |
| Rule not APPROVED or not compilable | no | `RULE_UNSUPPORTED` |
| Any FIRST_PRIZE category not COMPLETE or not source-reviewed | no | `FIRST_PRIZE_INCOMPLETE` |
| Rule version with a different number length than the selected one | no | `INCOMPATIBLE_RULE_VERSION` (only when `ruleVersionId` is given) |
| Otherwise | yes — every entry of the FIRST_PRIZE categories of the **current** revision | `drawCount`, `observationCount` |

The observation unit is one first-prize **entry** (draw + category + series + number, distinct).
A range whose eligible draws mix number lengths returns 400 `REQUIRED_MIXED_DOMAINS` instead
of silently pooling different games. `knownDrawCount` counts draws recorded here, not every
draw that took place; `calendarCoverage` is `UNKNOWN` until a reviewed calendar exists.

**Metrics (packages/domain `computeDescriptiveStatistics`)**

* `positionDigitCounts[position][digit]` — position 0 is the leftmost digit; leading zeros are digits; each row sums to N.
* `lastTwo` / `lastThree` — last 2/3 characters as strings; `share = count / N` ("historical share"); top 50.
* `repeated` — distinct full number strings vs distinct tickets (series + number); collision pairs are Σ c(c−1)/2, not occurrences.
* `parity` — parity of the final digit.
* `digitSum` — sum of digits (zeros add zero): min, max, mean and distribution.
* `duplicateDigits` — fewer distinct digits than positions. `adjacentEqualDigits` — an identical neighbouring pair.
* `consecutiveRuns` — a run of ≥ 3 adjacent digits stepping +1 or −1 in one direction; 9→0 is not a step; counted once per number.
* N = 0 → counts are 0 and every share is `null`; the UI shows "No eligible verified observations in this range", never 0 %.

**Deliberately absent**: p-values, confidence intervals, "statistically significant", hot/cold or
"due" numbers, expected-randomness comparisons, and any future-draw probability. The response's
`notes` array carries these definitions in plain language and the web renders them verbatim.

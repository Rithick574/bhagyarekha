# Translations — status and review process

**Status (24 September 2026): Malayalam strings are machine-drafted and have NOT been reviewed by a native speaker. They must be reviewed before any production or public staging release.**

## Where the strings live

| File | Purpose |
|---|---|
| `apps/web/src/i18n/messages/en.ts` | English source catalogue. Keys are the source of truth. |
| `apps/web/src/i18n/messages/ml.ts` | Malayalam catalogue. Typed as `Messages`, so a missing key is a compile error. |
| `apps/web/src/i18n/index.ts` | `getMessages(locale)`, `t()` interpolation, locale helpers. |
| `apps/web/src/i18n/messages.test.ts` | Enforces identical key sets, no empty strings, identical `{placeholders}`. |

Prize-category labels (`labels.en` / `labels.ml`) and lottery names come from the database and are entered by the operator; demo fixtures carry synthetic labels in both languages.

## Review checklist for the Malayalam reviewer

1. Terminology consistency: series (സീരീസ്), draw (നറുക്കെടുപ്പ്), revision (പതിപ്പ്), published (പ്രസിദ്ധീകരിച്ചു), suspended (താൽക്കാലികമായി ലഭ്യമല്ല).
2. Status labels are short enough for the mobile bottom navigation and badges at the Extra-large text size.
3. Every sentence that limits a claim ("not an official certification", "do not treat a missing match as no prize") keeps its meaning exactly.
4. Date and number formatting comes from `Intl` with `ml-IN`; confirm the rendered dates read naturally.
5. No string implies government affiliation, guaranteed prizes, or purchase encouragement.

## Process

- Edit `ml.ts` only; keep `{placeholders}` identical to the English key.
- Run `pnpm --filter @bhagyarekha/web test` (key parity) and `pnpm --filter @bhagyarekha/web typecheck`.
- Record the reviewer and date here when a full pass is complete.

| Date | Reviewer | Scope | Result |
|---|---|---|---|
| — | — | — | Not yet reviewed |

## Stage 2 additions (ticket checking)

`apps/web/src/i18n/messages/ml.ts` gained the `check.*` section (form labels, field errors,
all eight outcome titles/bodies, transport failures, the informational reminder). These
strings were machine-drafted by the implementer in the same pass as the English text and
have **not** been reviewed by a native speaker. The outcome wording is legally sensitive
(it must never read as a claim confirmation or a definitive "no prize" for incomplete
results); a reviewer should check those meanings, not only grammar.

## Stage 4 additions (history and statistics)

`ml.ts` gained the `history.*` section (filters, list headings, empty/coverage notices, and the
`history.search.*` number-search form, statuses and result columns) and the `statistics.*`
section (filters, scope panel, exclusion-reason labels, the non-predictive notice, every metric
heading and caption, stat tiles, and error notices). The `placeholder.*` section was removed
with the placeholder pages. All new strings were machine-drafted by the implementer and are
**not** reviewed. Review priorities: (1) `statistics.nonPredictive`, `statistics.emptyBody` and
`history.search.noMatches` / `noMatchesNote` must not read as a probability, a recommendation or a
“did not win” verdict; (2) `history.emptyBody` and the coverage sentences must keep “a gap in the
archive is not evidence that no draw took place”; (3) the exclusion-reason labels must stay short
enough for a two-column table at the Extra-large text size. The `statistics` “How to read this”
notes are supplied by the API in English and rendered verbatim (marked `lang="en"`); they are not
translated in release 1.

## Stage 3 additions (administration)

`ml.ts` gained the `admin.*` section (login, navigation, dashboard, lotteries, rule versions,
draws, imports, revisions, audit) and `footer.admin`. All strings were machine-drafted by the
implementer alongside the English text and are **not** reviewed. The admin UI is for operators,
so review priority is lower than public strings, but the wording of the self-review confirmation
(`admin.revisions.selfReview`) and the publication/suspension dialogs must keep their meaning:
they must never suggest independent verification or official certification.

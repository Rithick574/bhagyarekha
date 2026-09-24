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

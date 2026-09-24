# Data sources and limitations

**Status (Stage 1):** no live data source is integrated. The only data the application
can display comes from:

1. **Synthetic demo fixtures** (`apps/api/src/fixtures/demo-fixtures.ts`) written by
   `pnpm seed:demo` into a database marked `demo`. Every lottery name, draw code, date,
   number, amount and rule is invented. Evidence rows have kind `SYNTHETIC_FIXTURE`, no URL
   and no document hash (enforced by a database CHECK constraint).
2. **Reviewed manual imports** (Stage 3, not yet implemented): bounded CSV/JSON uploaded by
   an authenticated editor with a source reference, previewed, reviewed, and published
   explicitly. Parsing success is never verification.

## What is deliberately not done

* No scraping of the Kerala State Lotteries website or any other site. No server-side
  fetching of operator-supplied URLs (SSRF review required first; see LLD §11).
* No inference of prize rules from result tables. Rules are versioned configuration that
  must be approved with reviewed evidence. Unknown rules fail closed (`RULES_UNSUPPORTED`).
* No back-filled history. A gap in the archive means "no verified record", not "no draw".

## Provenance carried by every public result

* Source reference: kind, title, optional HTTPS link, operator review time.
* Revision number, publication kind (INITIAL / UPDATE / CORRECTION), completeness
  (PARTIAL / COMPLETE), and correction reason when applicable.
* Per-category completeness (MISSING / PARTIAL / COMPLETE) and source review time.

"Reviewed" always means reviewed by this application's operator. It is not a
government certification.

## Before live launch

* Confirm the official source's reproduction terms and disclaimer requirements.
* Configure real lottery catalog entries, draw identifiers and series domains.
* Approve rule versions from official scheme documents (see result-rules.md).
* Name the operator, backup reviewer and error-report contact.

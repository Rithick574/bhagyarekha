# BhagyaRekha — repository instructions

## Mission and scope

Build BhagyaRekha / ഭാഗ്യരേഖ: an independent Kerala lottery results, ticket-comparison, and historical-statistics PWA for adults approximately 25–70.

This repository starts from a design, not a completed application. Inspect the actual files and scripts before acting. Preserve existing work and conventions unless there is a documented reason to change them.

Public priorities: results → check a ticket → history → statistics. Optimize for readability, confidence, and low technical familiarity. Use `docs/reference-ui.png` for visual direction, not as a source of real lottery data.

Out of scope for release 1: ticket sales, wagers, deposits, payouts, gambling affiliates, guaranteed predictions, paid number recommendations, public accounts, payment/ad integrations, push notifications, OCR, and native Android/iOS packaging.

## Read before implementation

- `docs/architecture.md`: chosen architecture and ADRs.
- `docs/high-level-design.md`: journeys, acceptance criteria, and stages.
- `docs/low-level-design.md`: domain invariants, schema, APIs, and tests.
- `docs/references.md`: primary documentation and unverified assumptions.

These are ordinary references, not automatic imports of all design text into every task. Read the relevant sections. If documents conflict with the current user instruction, explain the conflict and follow that instruction unless unsafe. Update the relevant design when a deliberate decision changes.

## Chosen architecture

- TypeScript; pnpm workspace in a new repository.
- `apps/web`: Next.js App Router, React, Tailwind, centralized EN/ML messages.
- `apps/api`: NestJS modular monolith using its Express adapter.
- PostgreSQL and TypeORM with reviewed migrations; `synchronize: false` everywhere.
- `packages/contracts`: Zod runtime schemas and inferred transport types; no ORM entities.
- `packages/domain`: pure TypeScript matching/statistics functions; no framework, DB, network, or browser imports.
- Same-origin `/api/v1` routing; all business rules and database access live in the API.
- Manual, reviewed, bounded CSV/JSON import in release 1. No invented live API.
- No Redis, broker, cron worker, ML service, or object-storage dependency until justified.

Verify current dependency compatibility and pin the tested package manager/runtime and dependency versions. Do not declare a version compatible without building and testing it.

## Data correctness: never compromise

1. Treat all demo records and examples as synthetic. Never import the old conversation's historical numbers as verified data.
2. Live and demo deployments use separate databases and fixed deployment mode. No client-controlled mode or silent live-to-demo fallback.
3. Ticket numbers/suffixes are strings. Preserve leading zeros; normalize only documented whitespace and series case.
4. A draw is identified by its lottery and draw code, not date alone. Keep scheduled and actual dates distinct.
5. Published result payloads and approved rule versions are immutable. Corrections create a new revision; suspension is an audited visibility action.
6. Readers use a single revision snapshot. Do not combine a current revision header with another revision's numbers.
7. Parsing success is not verification. A reviewed source and explicit category completeness are required.
8. Unknown rules fail closed. Never invent prize amounts, series rules, stacking, or exclusions.
9. `NO_MATCH` is allowed only with a complete, reviewed, supported current result and every relevant category evaluated.
10. A partial match may be provisional. Do not report a final prize if an exclusion or higher-priority category is incomplete.
11. A lookup matches published data; it does not verify ticket purchase, authenticity, ownership, or an accepted claim.
12. Statistical frequencies are descriptive. Do not present them as next-draw probabilities or publish unimplemented p-values.

## Development workflow

Inspect → plan a small vertical slice → implement → test → inspect the UI → summarize actual results. Do not stop at a plan when implementation was requested.

Do not overwrite unrelated changes, force-push, run destructive database operations, buy services/domains, or deploy publicly without explicit approval. Do not commit unless asked. No default production admin password or public admin registration.

Keep controllers thin, services responsible for use cases, and repositories responsible for persistence. Pass TypeORM's transaction-scoped manager into every repository operation inside a transaction. Do not use a global repository in transactional code.

Every write that changes public data must be authenticated, authorized, validated, audited, and concurrency-safe. Use parameterized SQL. Avoid `any`, unchecked casts, broad catches that hide failures, duplicate types, and comments that restate the code.

Use Zod contracts at every inbound API boundary with a tested Nest validation pipe. Generated OpenAPI must come from those same contracts. Do not maintain competing DTO definitions. Database/domain refinements remain server-side.

## UI and accessibility

- Light neutral background, white cards, dark text, teal actions.
- Default body type around 18px; 48px minimum product touch targets.
- WCAG 2.2 AA target; test contrast, keyboard use, reflow, and 200% enlargement.
- EN/ML language and Standard/Large/Extra-large text controls persist locally.
- Dates/times display in `Asia/Kolkata`; do not parse date-only values as UTC instants.
- Mobile bottom navigation: Results, Check, History, Stats.
- Always include source, revision, verification, and completeness context where relevant.
- No casino styling, flashing wins, confetti, manipulative urgency, or icon-only primary actions.
- Label cached data offline; disable authoritative checking without network.
- Review uncertain Malayalam translations before production.

## Security and privacy

Use same-origin HTTPS, secure HttpOnly admin-session cookies, CSRF validation for unsafe admin requests, strict server authorization, and no public signup. Never put admin tokens in localStorage.

Ticket checking is POST-only; do not store ticket inputs, log request bodies, emit ticket numbers in telemetry, or put them in URLs. Redact proxy/APM logs and validation errors as well as application logs.

Do not fetch administrator-supplied URLs automatically. The MVP stores reviewed source references without dereferencing them. A later fetch adapter requires explicit allowlists and SSRF controls.

Keep imports bounded and private; protect them from CSRF and malicious input. No XLSX/PDF/ZIP parser in the MVP. Escape untrusted text on display and guard later CSV exports against formula injection.

Never cache admin/auth/check responses. Public result responses are `no-store` initially. Offline results require an explicit offline badge and never power a definitive ticket verdict.

## Testing and delivery

Test the pure rule engine, incomplete-result behavior, exclusions/precedence, string normalization, transactional publishing, revision races, imports, admin/CSRF boundaries, and descriptive metrics. Use a real PostgreSQL test service for integration tests, not SQLite substitutes. Pure unit tests must not import bootstrap configuration or exit due to missing deployment variables.

Add Playwright end-to-end tests and accessibility checks. Capture the actual interface at mobile and desktop widths and inspect it. Do not fabricate passing tests, screenshots, live sources, or implemented features.

Target commands to implement in a new repository:
`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:integration`, `pnpm test:e2e`, `pnpm db:migrate`,
`pnpm env:init`, `pnpm seed:demo`, `pnpm admin:create`, `pnpm contracts:check`.

These commands do not exist merely because this file names them. Check package.json, implement/document missing scripts, and report any unrun check.

Done means: runnable slice + migration if needed + tests + usable error states + updated docs. Final handoff states what changed, how to run it, checks actually executed, synthetic versus verified data, blockers, and remaining production work.

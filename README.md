# BhagyaRekha · ഭാഗ്യരേഖ

Independent Kerala lottery results, ticket comparison and historical-statistics web app.
**Not an official government application.** No ticket sales, wagers, payments or predictions.

> **Stages 1 (foundation + viewing) and 2 (ticket checking) are implemented.** Everything the demo shows is
> **synthetic sample data**. No live lottery source is integrated. See
> [docs/data-sources.md](docs/data-sources.md).

## Stack (tested versions)

| Layer | Choice |
|---|---|
| Runtime / workspace | Node 22.20 · pnpm 9.7 · TypeScript 5.9 |
| Web | Next.js 16.3 (App Router, Turbopack) · React 19.3 · Tailwind CSS 4.3 |
| API | NestJS 12.1 (Express 5) · TypeORM 1.1 · PostgreSQL 17 |
| Contracts | Zod 4.6 schemas in `packages/contracts`, OpenAPI generated from them |
| Domain | Pure TypeScript in `packages/domain` (no framework/DB imports) |
| Tests | Vitest 5 (unit + real-PostgreSQL integration) · Playwright 1.63 + axe (e2e) |

Design documents: [docs/architecture.md](docs/architecture.md), [docs/high-level-design.md](docs/high-level-design.md), [docs/low-level-design.md](docs/low-level-design.md), [docs/references.md](docs/references.md).

## Local setup from a fresh checkout

```bash
corepack enable && corepack prepare pnpm@9.7.0 --activate   # or: npm i -g pnpm@9.7.0
pnpm install --frozen-lockfile
cp .env.example .env            # edit DATABASE_URL if you are not using the compose database

pnpm db:up                      # PostgreSQL 17 in Docker on localhost:5434 (demo + test databases)
pnpm db:migrate                 # reviewed migrations; synchronize is never enabled
pnpm env:init -- --mode demo    # writes the immutable demo marker (must equal DATA_MODE)
pnpm seed:demo                  # idempotent synthetic fixtures; refuses live databases
pnpm dev                        # API on :3001, web on :3000 → http://localhost:3000/en
```

Using an existing PostgreSQL instead of Docker: create two empty databases, point
`DATABASE_URL` and `TEST_DATABASE_URL` at them in `.env`, and skip `pnpm db:up`.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Builds shared packages, then runs API (`tsc-watch`) and web (`next dev`) |
| `pnpm build` | Builds packages, API and web |
| `pnpm lint` / `pnpm typecheck` | ESLint 9 flat config / `tsc --noEmit` in every package |
| `pnpm test` | Unit tests (contracts, domain, API mapping/env/pipe, web formatting/i18n) |
| `pnpm test:integration` | API against `TEST_DATABASE_URL`: **drops and recreates** that schema, migrates, seeds, exercises HTTP + DB guards + ticket checking |
| `pnpm test:e2e` | Playwright (needs API + web running, or lets Playwright start them from builds) |
| `pnpm db:up` / `pnpm db:down` | Local Docker PostgreSQL |
| `pnpm db:migrate` (`-- --status`) | Apply / inspect migrations |
| `pnpm env:init -- --mode demo\|live` | Mark a database's mode once; never changes an existing marker |
| `pnpm seed:demo` | Synthetic fixtures; refuses unless env **and** database are demo |
| `pnpm admin:create -- --email x@y.z [--role PUBLISHER\|EDITOR]` | Creates an admin (Argon2id, password from stdin). Login UI arrives in Stage 3 |
| `pnpm contracts:check` | Fails if `packages/contracts/openapi.json` is stale |

## Demo vs live

* `DATA_MODE` in the environment must equal the `deployment_metadata.data_mode` row.
  The API refuses to start otherwise, and also refuses with pending migrations.
* The marker can never be flipped (database trigger). Use a different database for a different mode.
* Demo responses carry `dataMode: "demo"`; the web shows a permanent "Sample data — not live results" banner and `noindex`.
* Live mode with no data shows honest empty/pending states. There is no fallback to fixtures.

## Repository layout

```
apps/api            NestJS API: modules/{deployment-mode,health,results}, database/{entities,migrations}, cli/, fixtures/
apps/web            Next.js app: src/app/[locale]/..., components, i18n, lib
packages/contracts  Zod schemas, route registry, openapi.json
packages/domain     Rule compiler (Stage 2 adds the evaluator and statistics)
tests/e2e           Playwright + axe, responsive screenshots
infra/              docker-compose.yml for PostgreSQL
docs/               design docs, data-source/rules/deployment notes
```

## Status and honesty notes

* Ticket checking compares typed numbers with one published revision (`POST /api/v1/ticket-check`);
  a match is informational, never proof of a valid ticket or an accepted claim.
* History, statistics and admin import/publish are **later stages**; their pages say so
  instead of showing fake forms or charts.
* Prize-matching rules in fixtures are invented engine exercises, not Kerala rules.
* Malayalam strings are machine-drafted and flagged for native review ([docs/translations.md](docs/translations.md)).
* Production readiness gates are listed in [docs/deployment.md](docs/deployment.md).

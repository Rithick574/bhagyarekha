# Source register

External facts consulted while implementing Stage 1 (24 September 2026). Versions were
then installed, built and tested in this repository; the lockfile records the exact tree.

| ID | Source | Used for |
|---|---|---|
| S01 | npm registry metadata (`npm view`) for next, react, @nestjs/*, typeorm, @nestjs/typeorm, zod, tailwindcss, vitest, @playwright/test, typescript, eslint | Choosing mutually compatible stable versions; peer-dependency ranges |
| S02 | Next.js — "How to upgrade to version 16" (nextjs.org/docs/app/guides/upgrading/version-16) | Turbopack default, async `params`, `proxy.ts` replaces `middleware.ts`, `next lint` removed, ESLint flat config |
| S03 | NestJS 12.0.0 release notes and migration guide (github.com/nestjs/nest/releases, docs.nestjs.com/migration-guide) | ESM packaging, Node ≥ 22.12, Vitest as default runner for ESM projects, generic `ArgumentMetadata`, Express 5 |
| S04 | TypeORM CHANGELOG (github.com/typeorm/typeorm) | 1.x requires Node ≥ 20; empty-criteria update/delete now rejected; `connection`→`dataSource` renames |
| S05 | PostgreSQL 17 documentation (constraints, triggers, `AT TIME ZONE`, `GENERATED ALWAYS AS IDENTITY`) | Migration SQL |
| S06 | Vitest 5 configuration (projects inherit the root config's plugins) | `apps/api/vitest.config.ts` |
| S07 | WCAG 2.2 (w3.org/TR/WCAG22) — 1.4.3 contrast, 1.4.4 resize text, 1.4.10 reflow, 2.4.7 focus visible, 2.5.8 target size | UI targets; 48 px targets are a product choice above the AA minimum |
| S08 | Node.js 22 docs — `process.loadEnvFile`, `require(esm)` | `.env` loading; ESM API |

## Unverified assumptions (must be resolved before live)

* Real Kerala lottery scheme names, draw codes, series domains, prize categories and
  matching/non-stacking rules — **not** derived from any official document in this repo.
* Terms for reproducing official result documents and required disclaimers.
* Malayalam translations were machine-drafted by the implementer, not reviewed by a native speaker.
* Hosting provider, region, backup retention and restore objectives.

## Observed during implementation

* `typeorm@1.1.1` with `@nestjs/typeorm@12.0.1`: passing `url` alone behaved unexpectedly in one
  configuration during development; the DataSource factory therefore parses `DATABASE_URL`
  explicitly into host/port/user/password/database (unit-tested).
* `cors` with a string `origin` echoes the configured value for any request Origin; the API
  uses a callback so foreign origins receive no CORS headers.
* `pg` deprecates parallel queries on one client; all reads inside a snapshot transaction are sequential.

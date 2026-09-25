# Deployment guidance and production-readiness checklist

**Nothing has been deployed. No domain has been purchased. No provider account is assumed.**

## Topology

One Next.js instance, one NestJS API instance, one managed PostgreSQL 17 per environment,
HTTPS ingress routing `/api/v1/*` to the API and everything else to the web app (same
public origin). Demo and live are separate deployments with separate databases.

## Release procedure

1. Back up the database and verify a restore drill has succeeded recently.
2. Run `pnpm db:migrate` as a release job with the migration-owner role (never from app replicas).
3. First deployment of a new database only: `pnpm env:init -- --mode live` (or `demo`).
4. Deploy the API; readiness (`/api/v1/health/ready`) must report `status: ok`.
   The API exits non-zero on mode mismatch, missing marker, or pending migrations.
5. Deploy the web with `INTERNAL_API_BASE_URL` pointing at the private API address.
6. Smoke-test `/en`, `/ml`, a result page, and readiness. Enable traffic.

## Environment variables

See `.env.example`. Production must leave `INSECURE_DEV_COOKIES` unset/false (it is ignored when `NODE_ENV=production`) and keep `ALLOW_SELF_REVIEW=false` unless a single-operator launch has been explicitly accepted. Secrets live in the platform's secret store, never in Git.
`TRUST_PROXY_HOPS` must match the number of reverse proxies so rate limits use real client IPs.

## Security posture implemented so far

* Helmet headers, restrictive CORS (single configured origin), 64 kB JSON body limit,
  in-process rate limiting (`RATE_LIMIT_PER_MINUTE`, default 120; `RATE_LIMIT_CHECK_PER_MINUTE` for ticket checks and history search, default 30; `RATE_LIMIT_STATS_PER_MINUTE` for statistics, default 10), `Cache-Control: no-store` on every API response.
* Ticket checking is POST-only; inputs are never persisted, logged or echoed, and the browser reaches the API same-origin through a Next.js rewrite.
* Structured logs without bodies, query values or ticket inputs. Server-generated request IDs.
* Database immutability triggers on published payloads, approved rules, referenced evidence and the mode marker.

## Production-readiness checklist (open)

- [ ] Real lottery catalog, draw identifiers and series domains configured and reviewed
- [ ] Rule versions approved with official scheme evidence (Stage 2 evaluator + Stage 3 admin)
- [x] Reviewed import → review → publish workflow (Stage 3) with append-only audit trail
- [x] Admin cookie sessions, CSRF/Origin checks, login throttling (Stage 3)
- [ ] MFA or a restricted access layer in front of `/admin` before public exposure
- [x] Ticket check endpoint with completeness handling (Stage 2) — rules themselves still synthetic
- [x] History and descriptive statistics with scope, exclusions and coverage labels (Stage 4)
- [ ] PWA shell, offline labelling, accessibility audit at 200% zoom (Stage 5)
- [ ] Source reproduction/permission review; privacy notice reflecting actual hosting behaviour
- [ ] Native Malayalam review of all strings
- [ ] Monitoring, alerting on readiness failures, centralized logs, backup + restore drill
- [ ] Named draw-day operator, backup reviewer and error-report contact
- [ ] CI green on a clean machine (`.github/workflows/ci.yml`)

Until these are closed the service is a **demo or restricted staging** deployment only.

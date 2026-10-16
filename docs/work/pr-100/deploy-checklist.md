# PR #100 deploy checklist

Branch `feat/homework-worksheet-question-flow-20261015`, head `c8bc8a1a` plus B6's uncommitted fixes (listed in `b6.md`). Filled by B6 on 2026-10-15. A box is ticked only where `b6.md` holds the command and its output from this session.

## Pre-deploy

- [x] **Migrations apply on a fresh database.** Scratch DB `pr100_e2e` in `moyo-pr100-pg`: Payload push for the base schema, then all 36 files in `packages/payload/migrations/` in the order in `b6.md` step 1. `node tooling/check-schema-applied.mjs`: `schema-applied OK — all 63 declared table(s) and column(s) are present`, exit 0.
- [x] **`homework_additive.sql` is idempotent.** A second full pass gave rc=0 for `homework_additive`. The four files that fail on a second pass (`better_auth_tables`, `jobs_schema`, `jobs_pgboss_schema_38_to_42`, `jobs_pg_cron_maintenance`) are documented in their own headers as records or one-way guards.
- [ ] **Production migration applied.** Not run. B6 worked only against the scratch container. Someone has to apply `homework_additive.sql` to production before the code deploys, then run `check-schema-applied.mjs` against production.
- [x] **Erasure verified against real rows.** `erasure.integration.test.mjs` on `pr100_e2e`: 24 tests, 24 pass, 0 skipped. That includes "the sweep nulls an expired homework crop and keeps the question" and "a guardian erasure takes their uploads for a ward and their practice sets, and nothing else". The second test needed a fix in the test's SQL (see `b6.md`).
- [x] **Sentry scrub invariants.** `node tooling/check-sentry-invariants.mjs`: `1936 files clean (PII off, no replay, traces 0, tags lawful, offline silent)`, exit 0.
- [x] **No Session Replay on child surfaces.** The same check bans every replay integration on every surface, and passed. `git grep -nE "replayIntegration|Replay|mobileReplay"` over apps and packages matched only comments and unrelated identifiers (`telemetry-options.ts` comment, `practice.store.ts` "Replays the open set", `jobs/boss.ts` dead-letter comment).
- [x] **Typecheck after B6 fixes.** `pnpm --filter ./packages/payload --filter ./apps/web typecheck`: both `Done`.
- [ ] **Full root typecheck and app tests after B6 fixes.** Not rerun. B6 changed one Payload field, one repository line and one test file; only the payload and web typechecks and the payload tests were rerun.
- [x] **API end to end on a real server.** `apps/web` dev on port 3100 against `pr100_e2e`, live Better Auth sessions: create, revise, start, ten advances with one 409, close, drain, guardian print with ten rows, practice set draft, approve, sheet and key, and cross-family 404s. Output in `b6.md` step 3.
- [ ] **iOS dev client built with expo-print and expo-sharing.** Not done. `pod install` failed; exact error in `b6.md` step 4.
- [ ] **Device walk-through (iPhone Duo, iPad).** Not run, blocked by the item above.
- [ ] **Android, Pixel Tablet, Pixel Fold, Galaxy Fold.** Not run: no emulator on host.
- [ ] **`jobs.ts` wiring of `loadHomeworkForSession`.** Present at `apps/web/lib/jobs.ts:195` and the summary came out with ten worksheet rows, so it works on scratch. Ticking needs a production drain, which was not run.

## Deploy

- [ ] Apply `homework_additive.sql` to production (Supabase MCP `apply_migration`, name `homework_additive`).
- [ ] Run `check-schema-applied.mjs` against production and paste the result.
- [ ] Ship the web build. Ship the native build only after the dev-client item above is done; the JS references `expo-print` and `expo-sharing`, which an older binary does not contain.

## Post-deploy

- [ ] One worksheet created and advanced on production by a test learner; guardian report shows one row per question.
- [ ] `retention.sweep.media` and the TTL sweep run once and the crop-null statement in `sweep.sql` reports no error.

## Rollback

Code rollback is safe: `homework_additive.sql` only adds tables, enums and nullable lock-table columns. Data written to the three homework tables stays behind on rollback and is still covered by the account erasure cascade in `account-deletion.repository.ts`.

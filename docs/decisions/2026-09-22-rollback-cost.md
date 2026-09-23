# Rollback cost: what deploying `origin/main` to production would break

**Date:** 2026-09-22
**Status:** Investigation, read-only. No code changed, nothing deployed, no DML run.
**Question priced:** if `moyo-app` production moves off `8b2ae90`
(`codex/homework-scanner-audit-2026-09-21`, deployed 2026-09-21T22:46:57Z, aliased
from `app.moyolearn.com`) back to `origin/main` (`59f34af`), what breaks and what is lost.

---

## Verdict

**No — deploying `main` as-is is not safe, but not for the reason the option was
priced on.** The auth-schema fear is refuted: the live `better_auth.account` table
carries `issuer text NOT NULL` at ordinal 2, which is the **1.7.2** shape, and both
refs pin `better-auth`/`@better-auth/expo`/`@better-auth/stripe`/`auth` at `1.7.2`
with `better-auth@1.7.2 -> @better-auth/core@1.7.2` in **both** lockfiles. Nothing has
been written to `better_auth` since 2026-09-03 — zero accounts, zero users, zero
sessions created since the `8b2ae90` deploy. There is no 1.7.5-shaped data to regress.
Schema drift is likewise near-zero: the single migration `main` does not carry
(`edu_questions.sql`) has **not been applied to production either** — `edu.questions`
does not exist and `edu.transcripts` has no `question_id`/`revision` columns.

The thing that actually decides it is **the hydration bug**: `main`'s
`packages/ui/html/dom.web.tsx` object-spreads a styleq array into `toDom`, React DOM
throws "Indexed property setter is not supported", and hydration dies on every page
carrying a kit button. `8b2ae90` has the fix. Deploying `main` unmodified ships a
known, already-diagnosed, client-side-fatal regression to `app.moyolearn.com`. That is
a one-line cherry-pick away from being fixed — which is the real shape of this
decision: rolling back is cheap *only* if you rebuild `main` + the dom.web fix, not if
you deploy `main` verbatim.

Detail follows.

---

## 1 — Schema drift: near-zero, and the one gap is on both refs

Twenty migration targets checked against production with `to_regclass`. Nineteen
present, one missing.

| | |
|---|---|
| Present | `payload.{assignment_completions, assignments, classes, enrollments, families, handoff_codes, incident_reports, leads, organizations, safety_events, session_summaries, sessions, tutor_engagements, tutor_sessions}`, `edu.{blocked_tags, embeddings, inference_budget, transcripts}`, `jobs.version` |
| **Missing** | `edu.questions` |

`edu_questions.sql` never ran. It also adds two columns to a table that does
exist, and neither is present:

```sql
ALTER TABLE "edu"."transcripts" ADD COLUMN IF NOT EXISTS "question_id" "edu"."opaque_id";
ALTER TABLE "edu"."transcripts" ADD COLUMN IF NOT EXISTS "revision"    "edu"."opaque_id";
```

So it did not partially apply — it never ran at all. **This is not a rollback
cost.** The file is checked in on both refs, so the gap exists whichever one
deploys. It needs its own issue; see `2026-09-22-migration-drift.md`, which also
records why the question had to be answered by probing: `payload.payload_migrations`
holds one row against 33 checked-in files.

### Better Auth: the fear was pointed the wrong way

Live `better_auth.account` carries `issuer text NOT NULL` at ordinal 2 — the
**1.7.2** shape. All 37 rows are `credential` provider from 2026-09-02/03, none
with a blank `issuer`, and nothing has been written to the schema since
2026-09-03.

The catalog comment at `pnpm-workspace.yaml:246` explains the real direction:
1.7.5 **stopped** writing that column, so an insert through a 1.7.5 copy fails
the NOT NULL. 1.7.2 is the safe side, not the risky one.

One correction for the record: `git show 8b2ae90:pnpm-lock.yaml | grep -oE "'@better-auth/core@[0-9.]+"` returns **both 1.7.2 and 1.7.5** — `@better-auth/expo` and `@better-auth/stripe` pull a second copy. `origin/main` and `upgrade/expo-sdk-58-preview5` return only 1.7.2. The 1.7.5 copy is present in the deployed graph and unreached, because the account write goes through `better-auth` → core 1.7.2. It is an argument for moving production **forward** onto the pinned branch, not back.

## 2 — What the 102 commits carry

431 files, +38,033 / −7,102. By area: `packages/ui` (167 files), `packages/app`
(103), `docs` (54), `apps/mobile` (48), `apps/web` (12), `packages/inference`
(10), `tooling` (7), `packages/student-model` (7), `vendors` (4),
`packages/theme` (3).

The shape of that is a design-system pass plus the mobile and XR work, not a
handful of fixes. `vendors/` moving means the Viro and expo-pico tarballs
differ, so a rollback is a dependency-graph change as well as a code change.

## 3 — Environment: not a differentiator

Both refs resolve the same 68-key environment surface. The notable absences —
`RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, any `SENTRY_*` — are absent for both, so they neither
help nor hinder this choice. All 33 Vercel variables are Production-scoped, so
neither ref can be verified on a preview.

## 4 — The hydration bug decides it

`origin/main`:

```tsx
{...toDom(`inline-flex flex-col ${className ?? ''}`, { ...hitSlopStyle(hitSlop), ...style })}
```

`8b2ae90`:

```tsx
{...toDom(`inline-flex flex-col ${className ?? ''}`, [hitSlopStyle(hitSlop), style])}
```

`style` arrives from `useCssElement` as a styleq **array**. Object-spreading it
keys it by index, `toDom` skips its own array branch, and React DOM throws
assigning `style[0]`. Introduced on `main` in `15ac235` (2026-09-11); never
shipped, because production has been served from a lineage that already carries
the fix.

Deploying `main` verbatim ships a known client-fatal regression. The fix is one
line and is already on `fix/login-verification-natalie-voice`, so rollback is
cheap only as *`main` plus that cherry-pick* — never as `main` as it stands.

## 5 — Reverse-direction cost

Going back to `main` and later returning to the SDK 58 lineage means redoing the
dependency move — `expo` 57.0.15 ↔ 58.0.0-preview.3, `react-native` 0.86.2 ↔
0.88.0-rc.0, and the vendored Viro and expo-pico tarballs. None of it is
one-way, but none of it is free either, and it buys nothing: the problem that
prompted the rollback option is solved by a one-line pin (ADR-123).

## What could not be determined

- Whether `edu.questions` has a read path failing silently in production. The
  querying code was not traced; it needs its own investigation before anything
  is applied.
- Whether any of the 102 commits' user-facing behaviour is load-bearing for a
  Shipaton submission. That is a product call, not a code reading.

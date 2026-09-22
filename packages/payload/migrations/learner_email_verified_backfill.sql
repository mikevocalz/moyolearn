-- Backfill: managed learners created before 2026-09-22 are marked verified.
-- Apply with the Supabase MCP `apply_migration`, name: `learner_email_verified_backfill`.
--
-- THE DEADLOCK THIS CLEARS. better-auth@1.7.2 gates the username sign-in path
-- on `emailVerified` exactly as it gates email/password
-- (node_modules/better-auth/dist/plugins/username/index.mjs:195-207), and
-- `createAuth()` sets `requireEmailVerification` outside development. Every
-- guardian-managed learner row was written with `emailVerified = false`, so
-- `auth.api.signInUsername` — the only call site, in
-- packages/auth/src/handoff.ts — has been answering 403 EMAIL_NOT_VERIFIED for
-- every device handoff in production.
--
-- It cannot resolve itself. A learner's address is
-- `<uuid>@learners.invalid` (packages/auth/src/create-learner.ts), an RFC 2606
-- reserved TLD that is undeliverable by design, so no verification mail can
-- ever arrive; and `isRestrictedLearnerUpdate`
-- (packages/auth/src/server.ts) refuses any later write carrying
-- `emailVerified` for a managed user. Nothing in the running system can move
-- these rows. That is why the repair is a migration rather than a code path.
--
-- New learners no longer need this: `createPayloadLearnerWriter` now sets
-- `emailVerified` in the same `internalAdapter.updateUser` call that sets the
-- restricted flags, while `guardianManaged` is still false on the stored row
-- and the restricted hook therefore declines. This file is only for the rows
-- that predate that change.
--
-- SCOPED BY BOTH CONDITIONS, deliberately. `"guardianManaged" = true` alone
-- would also catch a future managed account that carries a REAL address — a
-- guardian-managed teen, say — and mark an unconfirmed mailbox confirmed. The
-- placeholder suffix is what makes "there is nothing to verify" true, so it is
-- part of the predicate rather than an assumption about who is managed.
--
-- Idempotent: the `emailVerified = false` clause means a re-run matches nothing.
-- Additive in effect — no row is deleted, no column is altered, and no account
-- outside the two conditions is touched.
-- SOT: docs/pack/06-auth-onboarding-spec.md §2 §6 · docs/incidents/2026-09-22-login-lockout.md
-- SOT-KEYWORDS: learner email verified backfill migration handoff username better auth guardianManaged placeholder

UPDATE "better_auth"."user"
SET "emailVerified" = true
WHERE "guardianManaged" = true
  AND "email" LIKE '%@learners.invalid'
  AND "emailVerified" = false;

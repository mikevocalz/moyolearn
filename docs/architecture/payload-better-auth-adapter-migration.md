# Moyo Learn — Better Auth on the Payload adapter

> Status: migration preflight only. No production auth changes in this PR.
> Reference: NYC-MON `mikevocalz/nyc-mon`, `packages/payload/src/payload.config.ts` on `main` (2026-11-02).

## Verified current state

| Concern | NYC-MON | Moyo Learn (`main`) |
| --- | --- | --- |
| Identity runtime | `betterAuth` with `payloadAdapter({ payloadClient: payload })` | `betterAuth` with direct `pg.Pool` |
| Integration | `betterAuthCollections`, `createBetterAuthPlugin`, `betterAuthStrategy` | independent Better Auth routes + Payload local auth |
| Auth storage | Payload collections in Neon Postgres | dedicated Supabase Postgres `better_auth` schema |
| Packages | `@delmaredigital/payload-better-auth@0.40.0-next.0`, `better-auth@1.7.10`, `payload@4.0.0-beta.6` | no Payload Better Auth adapter; `better-auth@1.7.2`, `payload@4.0.0-canary.33` |
| Auth endpoints | `/payload-api/auth/*` on Payload backend | `/api/auth/*` in Next.js |
| User IDs | NYC-MON's Payload-backed user identity uses serial ID generation | Better Auth `user.id` is text; Payload local `users.id` is separate |

**Decision:** adopt the same maintained `@delmaredigital/payload-better-auth` adapter that NYC-MON currently runs, but retain Moyo's existing PostgreSQL host and app/domain boundaries. Do not use Neon Managed Auth, Supabase GoTrue, a replacement auth server, WebView login shells, or raw HTML.

## Why this cannot be a one-line package update

1. The Payload 4 prerelease plugin requires `payload`/`@payloadcms/ui` at or above `4.0.0-canary.37`; Moyo is currently on canary.33. Upgrade the entire Payload family **together**, including `@payloadcms/tanstack-start`, and regenerate the lockfile. Match the compatible plugin tag and test the exact peer versions; do not copy only NYC-MON's package entry.
2. Better Auth `1.7.2` in Moyo has an `account.issuer NOT NULL` column plus unique `(issuer, accountId)` index. Better Auth releases after 1.7.2 reverted that schema requirement. Review and rehearse a migration that drops/loosens the constraint as appropriate **before** deploying newer Better Auth; otherwise account creation and linking can fail.
3. Today `better_auth."user"` and `payload.users` are different tables and may have different primary-key types and users. Never reassign a guardian, school member, admin, subscription, or transcript by matching emails, array positions, or guessed IDs.
4. Current Moyo organization, family, and billing authorization reads both the Better Auth adapter and SQL against the old `better_auth` schema; those readers must migrate together with the identity and organizational records.
5. Native and web clients currently call `/api/auth`. The Payload plugin will mount `/payload-api/auth`. Cookie names, session expiry, callback URLs, tenant hosts, mobile origin, and CORS must be tested rather than assumed equivalent.

## Read-only preflight (added in this PR)

Run from a trusted environment with **server-only** `DATABASE_URL` pointing to the intended Moyo database:

```bash
pnpm --filter @acme/auth auth:adapter:preflight
pnpm --filter @acme/auth test
```

The script uses a PostgreSQL read-only transaction, short statement timeout, hard-coded table identifiers, metadata checks and aggregate row counts. It never prints user IDs, usernames, emails, password hashes, tokens or connection strings. Exit code `2` means blockers were found; exit code `1` means preflight failed. **Exit code `0` is not cutover approval.** Do not put the output into public CI logs without reviewing its aggregate sensitivity.

## Target architecture

- Retain `@acme/auth` as the **typed** app-facing façade for native and web clients. Keep its existing Expo plugin, encrypted cookie storage and multi-session flows; do not couple client bundles to Payload's Node server.
- Keep a single server-owned Better Auth options definition, including username, organization + `member.educationRole`, multi-session, breached-password protection, Expo, Stripe, verification email, and restricted-learner hooks. The plugin schema generator and runtime must see the **same** plugin roster and additional fields.
- In Payload configuration, use `betterAuthCollections({ betterAuthOptions, skipCollections: ['user'] })` and `createBetterAuthPlugin({ authBasePath: '/auth', createAuth: payload => betterAuth({ ...betterAuthOptions, database: payloadAdapter({ payloadClient: payload }) }) })` after making the options and DB-side hooks adapter-neutral.
- Convert the single intended Payload `users` collection to `auth: { disableLocalStrategy: true, strategies: [betterAuthStrategy()] }`. Model Better Auth's required fields and Moyo-specific flags (`isMinor`, `guardianManaged`, `aiEnabled`) on this collection. Preserve `gradeBand` for learning and voice policy. Disable versions for **all** identity/session/verification/credential collections so erased child records are not retained in version shadows.
- `firstUserAdmin` must be disabled in production and should **not** silently promote an arbitrary initial parent, student, or tutor to school operations. Staff access remains a server-side permission check and an organization membership decision.
- Keep Supabase's **managed** `auth` schema separate and untouched. Store new app identities in Moyo-controlled Payload tables and keep other `payload`, `edu`, and `jobs` data boundaries intact. No browser access to auth rows via anon/authenticated grants.
- Route authentication under `/payload-api/auth` once the Payload-backed instance is authoritative. Retire the existing `/api/auth` writer only after a tested transition plan and native/web endpoint changes; **never** run two writers for the same account concurrently.

## Data-migration rehearsal (staging, not this PR)

1. Snapshot and back up `better_auth`, `payload`, child-data relationships and billing references. Establish exact schemas, row counts, SQL constraints and existing auth ID types with the preflight. Confirm backup restoration to a disposable database.
2. Generate a **reviewed** new Payload schema on the same compatible Payload/Better Auth/plugin versions, with `push: false` in production. Inspect every generated collection, unique index, FK and default. Ensure passwords and tokens are never copied to app logs or test fixtures.
3. Construct a deterministic, audited old-ID → target-ID mapping for users **before** moving relationships. Do not assume IDs can be preserved: Better Auth text IDs and Payload numeric IDs may differ. Explicitly resolve conflicts between today's Payload users and Better Auth users; don't match on email alone.
4. Backfill identities, credential accounts (preserving password hashes only via verified supported algorithms), email-verification state, organization records, `member.educationRole`, invitations, billing/subscriptions, guardian and learner relationships, consent, handoff, tutoring/learning records and staff authorization references as their schema actually requires. Verify all counts, unique keys and reference integrity in a transactionally consistent rehearsal.
5. Rework any direct `Pool` queries against `better_auth.member` and `better_auth.subscription` into guarded reads from the new authoritative store. Preserve Stripe webhook signatures and idempotency keys; don't double-create customers, entitlements, or learner accounts.
6. Only after account, role, and billing parity is proven, direct one staged auth instance at the Payload adapter. Test old sessions explicitly; prefer a documented, orderly reauthentication boundary over copying opaque session tokens without validation.
7. Migrate web and Expo clients to the new base path and confirm deep-link callbacks, Android/iOS origin validation and Set-Cookie forwarding on preview builds. Verify password reset and verification emails before sign-in is enforced.
8. Run security and acceptance gates. Stage an atomic release with monitored error/lockout rates and a documented forward-recovery procedure. Keep old data protected until retention/rollback decisions are signed off; reverting an identity migration with new writes is **not** automatically safe.

## Non-negotiable acceptance tests

- Guardian-managed learner can sign in with their username and be switched by the guardian on shared devices, but cannot independently change protected email/password or link external OAuth accounts.
- `aiEnabled=false`, `isMinor` and guardian consent persist correctly through sign-in, session refresh, password reset, account deletion, and reauthentication. An unavailable policy lookup fails closed, not enabled.
- No role self-escalation. District and organization host-login gates refuse nonmembers; super-admin remains restricted to authorized staff. Cross-tenant reports and records are not exposed.
- Parent/guardian/tutor/student/teacher/school/district/staff and AI tutor identities retain their intended tenancy and authorization boundaries; free practice and family limits do not regress.
- Existing Stripe subscription, trial, family entitlements, event webhooks, and organization billing retain the same reference IDs or verified mappings; no duplicate charges.
- Expo SecureStore, `moyo://` origin, native device restore and family multi-session switching work on iOS, Android and web. Reset and email verification work with the configured Resend sender.
- The `users`, account, session, verification and child-data collections have no versions/shadow history; retention/erasure and RLS/grant protections continue to hold.

## Merge/cutover gate

**This preflight PR is safe to review without database access; it makes no dependency, routing, identity or schema changes.** Do not interpret merging it as an adapter upgrade. Follow with a separate staged compatibility PR, an audited data migration, and a final cutover PR after test and deployment evidence. NYC-MON's own adapter patch is not automatically appropriate for Moyo; compare the upstream release and only carry a patch when the defect and peer versions are reproduced.

References: NYC-MON `packages/payload/src/payload.config.ts`, `packages/payload/src/collections/Users.ts`, `pnpm-workspace.yaml`; Moyo `packages/auth/src/server.ts`, `packages/payload/src/payload.config.ts`, `packages/payload/src/collections/Users.ts`, `packages/payload/migrations/better_auth_tables.sql`; [upstream plugin](https://github.com/delmaredigital/payload-better-auth).

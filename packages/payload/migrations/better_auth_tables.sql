-- Better Auth's schema, part 2 of 2: the tables.
-- Applied to Supabase as migration `better_auth_tables`.
-- Part 1 is `better_auth_schema.sql` / migration `better_auth_schema`, which
-- creates the schema and the default privileges these tables inherit. Apply in
-- that order or the tables arrive granted.
--
-- READ THIS BEFORE APPLYING ANYTHING: this file is a RECORD, not an applier.
-- The DDL between the two rules below is the VERBATIM output of the Better Auth
-- CLI, which owns the shape of its own tables exactly as pg-boss owns the shape
-- of `jobs`. It is checked in so that "what is in the better_auth schema" is
-- answerable from the repository rather than only from the live database, and
-- so a Better Auth version bump shows up as a diff.
--
-- HOW IT WAS PRODUCED. The CLI is the npm package `auth`, not `@better-auth/cli`
-- — the package was renamed at v1.6 and the old name stops at 1.4.22, so there
-- is no `@better-auth/cli@1.7.1` to install. `auth@1.7.1` is pinned in the
-- workspace catalog beside `better-auth@1.7.1` and is a devDependency of
-- `@acme/auth`. Regenerate with:
--
--   set -a && . ./.env && set +a
--   pnpm exec better-auth generate --config apps/web/lib/auth.ts --output <file> --yes
--
-- The CLI introspects the schema at the head of the connection's `search_path`
-- (better-auth 1.7.1 `dist/db/get-migration.mjs` filters `getTables()` by it)
-- and emits only what is missing, so a re-run against this database now emits
-- nothing. It was NOT allowed to apply anything; `migrate` was never run.
--
-- ONE DELIBERATE DIFFERENCE FROM THE RUNTIME CONFIG. This checkout has no
-- Stripe keys, so `billingPlugin()` returns `[]` and a plain generate omits the
-- `subscription` table and `user.stripeCustomerId`. The generate that produced
-- the block below was run with placeholder STRIPE_SECRET_KEY /
-- STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_* set, so `@better-auth/stripe` was
-- mounted and emitted its own table. That is the only delta between the two
-- runs, and it was diffed rather than assumed. The table ships because
-- `subscription-reader.ts` reads it and because a deployment that turns Stripe
-- on should not discover its billing table is missing at checkout; an unused
-- empty table costs nothing, a missing one costs a payment.
--
-- WHAT THE CLI DOES NOT EMIT, AND WHY THE ALTERs BELOW EXIST. Better Auth
-- applies `additionalFields` defaults in APPLICATION code, so `isMinor`,
-- `guardianManaged` and `aiEnabled` come out nullable with no database default.
-- That is fine for rows Better Auth writes and wrong for every other writer.
-- The defaults are pinned in the database to match `learnerFields` in
-- packages/auth/src/server.ts, and `aiEnabled` defaults ON for the reason
-- recorded there: defaulting it off would refuse every learner who predates the
-- column, which is a product outage wearing a safety posture.
-- SOT: docs/pack/06-auth-onboarding-spec.md §7 §10 · packages/auth/src/server.ts
-- SOT-KEYWORDS: better auth tables migration cli generated user session account verification subscription learner flags rls

-- The CLI emits unqualified names. Everything below therefore lands in the
-- schema `createAuth` points its pool at, which is the point.
SET search_path TO "better_auth";

-- ---------------------------------------------------------------------------
-- BEGIN verbatim `better-auth generate` output (auth@1.7.1 / better-auth@1.7.1)
-- ---------------------------------------------------------------------------
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, "username" text unique, "displayUsername" text, "stripeCustomerId" text, "isMinor" boolean, "guardianManaged" boolean, "aiEnabled" boolean);

create table "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade, "activeOrganizationId" text);

create table "account" ("id" text not null primary key, "issuer" text not null, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);

create table "organization" ("id" text not null primary key, "name" text not null, "slug" text not null unique, "logo" text, "createdAt" timestamptz not null, "metadata" text);

create table "member" ("id" text not null primary key, "organizationId" text not null references "organization" ("id") on delete cascade, "userId" text not null references "user" ("id") on delete cascade, "role" text not null, "createdAt" timestamptz not null);

create table "invitation" ("id" text not null primary key, "organizationId" text not null references "organization" ("id") on delete cascade, "email" text not null, "role" text, "status" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "inviterId" text not null references "user" ("id") on delete cascade);

create table "subscription" ("id" text not null primary key, "plan" text not null, "referenceId" text not null, "stripeCustomerId" text, "stripeSubscriptionId" text, "status" text not null, "periodStart" timestamptz, "periodEnd" timestamptz, "trialStart" timestamptz, "trialEnd" timestamptz, "cancelAtPeriodEnd" boolean, "cancelAt" timestamptz, "canceledAt" timestamptz, "endedAt" timestamptz, "seats" integer, "billingInterval" text, "stripeScheduleId" text);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");

create index "member_organizationId_idx" on "member" ("organizationId");

create index "member_userId_idx" on "member" ("userId");

create index "invitation_organizationId_idx" on "invitation" ("organizationId");

create index "invitation_email_idx" on "invitation" ("email");

create unique index "account_issuer_accountId_uidx" on "account" ("issuer", "accountId");
-- ---------------------------------------------------------------------------
-- END verbatim `better-auth generate` output
-- ---------------------------------------------------------------------------

RESET search_path;

-- ---------------------------------------------------------------------------
-- The learner flags' database defaults — `learnerFields`, mirrored.
--
-- Kept OUT of the block above so the generated DDL stays byte-comparable
-- against a fresh `generate`. `readLearnerFlags` already reads `aiEnabled`
-- with `!== false`, so a null row is permissive; this makes the same answer
-- true for a row inserted by anything that is not Better Auth, including a
-- backfill or the Payload admin.
-- ---------------------------------------------------------------------------
ALTER TABLE "better_auth"."user" ALTER COLUMN "isMinor"         SET DEFAULT false;
ALTER TABLE "better_auth"."user" ALTER COLUMN "guardianManaged" SET DEFAULT false;
ALTER TABLE "better_auth"."user" ALTER COLUMN "aiEnabled"       SET DEFAULT true;

-- ---------------------------------------------------------------------------
-- Privileges. Mirror of `payload_schema_deny_anon`: privileges first, policies
-- second. The ALTER DEFAULT PRIVILEGES that make this stick already ran in
-- `better_auth_schema`; these REVOKEs pin the tables that just arrived, and are
-- a no-op if that migration did its job.
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA "better_auth" FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "better_auth" FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "better_auth" FROM anon, authenticated;

-- Default-deny backstop: RLS on, no policies at all. Doc 12 §4 — "the Block is
-- the enforcement, RLS is the seatbelt." Safe here and ONLY because it was
-- checked rather than assumed: the app connects as `postgres` (the pooler user
-- `postgres.<ref>` resolves to it), which owns these tables and carries
-- rolbypassrls = true. Deliberately NOT `FORCE ROW LEVEL SECURITY`, which
-- applies to the owner too and would lock the product out of its own auth
-- tables — every sign-in, every session read.
ALTER TABLE "better_auth"."user"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "better_auth"."session"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "better_auth"."account"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "better_auth"."verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "better_auth"."organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "better_auth"."member"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "better_auth"."invitation"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "better_auth"."subscription" ENABLE ROW LEVEL SECURITY;

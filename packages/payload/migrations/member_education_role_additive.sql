-- Additive migration for the org plugin's `member.educationRole` column.
-- Apply with the Supabase MCP `apply_migration`, name: `member_education_role`.
--
-- `createAuth()` (packages/auth/src/server.ts) declares `educationRole` as an
-- additional field on the organization plugin's member schema, and
-- `LiveSessionProvider` (packages/app/providers/session/live.tsx) reads it as
-- the member's education role of record — but `better_auth_tables.sql` predates
-- the declaration, so the column never existed. Every write that carries the
-- field fails against a database built from the shipped migrations; this closes
-- that gap the same way the other additive files do: one nullable column,
-- nothing dropped, nothing altered.
--
-- Values are `RoleKind` strings (packages/app/providers/session/role-mapping.ts):
-- learner · guardian · tutor · teacher · owner · staff · school_admin ·
-- district_admin. Nullable on purpose — a row without one falls back to the
-- `DEFAULT_ORGANIZATION_TO_EDUCATION` mapping, which is the pre-column behaviour.
-- SOT: packages/auth/src/server.ts §organization plugin · packages/app/providers/session/role-mapping.ts
-- SOT-KEYWORDS: member education role migration sql additive better auth organization plugin

ALTER TABLE "better_auth"."member" ADD COLUMN IF NOT EXISTS "educationRole" text;

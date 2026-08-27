-- Better Auth's schema, part 1 of 2: the schema and its standing privileges.
-- Applied to Supabase as migration `better_auth_schema`.
-- Part 2 is `better_auth_tables.sql` / migration `better_auth_tables`.
--
-- WHY THIS EXISTS AT ALL. Better Auth had no tables in this project. Not "out
-- of date" — none. `readLearnerFlags` called `internalAdapter.findUserById`,
-- the adapter hit a `user` relation that did not exist, the throw reached
-- `safetyLayer('1-identity')`, and every coaching turn returned `blocked`. The
-- fail-closed mechanism working perfectly, on a schema gap rather than a safety
-- condition. Doc 06 §7 always said these tables ship via the Better Auth CLI
-- migration, committed; this is that, finally committed.
--
-- WHY `better_auth` AND NOT `auth`. `createAuth` used to default its
-- `search_path` to `auth`. On Supabase, `auth` is GoTrue's MANAGED schema — it
-- already contains `auth.users`, the platform alters it on upgrades, and its
-- grants are Supabase's to set, not ours. Putting application tables there
-- means a vendor can migrate out from under them, and it puts two different
-- relations that both mean "the user table" one search_path entry apart. Every
-- other store in this database owns its own schema (`payload`, `edu`, `jobs`);
-- auth is not the exception. Nothing existed yet, so the move cost nothing —
-- which it would never do again.
--
-- WHY THE PRIVILEGES COME BEFORE THE TABLES. `ALTER DEFAULT PRIVILEGES` only
-- applies to objects created AFTER it runs. Running it here rather than after
-- the CREATE TABLEs is the difference between auth tables that arrive ungranted
-- and auth tables that arrive granted and are then revoked — and between a
-- posture that holds for the next table and one that decays the next time
-- someone adds a plugin. Same posture and same order as
-- `payload_schema_deny_anon` and the privileges block in `edu_schema.sql`.
--
-- A missing GRANT is simpler and stricter than a policy, and it holds whether
-- or not PostgREST ever learns this schema exists. That matters more here than
-- anywhere: `better_auth.user` holds children's usernames and
-- `better_auth.account` holds their password hashes.
-- SOT: docs/pack/06-auth-onboarding-spec.md §7 · docs/pack/12-systems-design-prompt.md §4 · packages/auth/src/server.ts
-- SOT-KEYWORDS: better auth schema migration privileges deny anon search_path

CREATE SCHEMA IF NOT EXISTS "better_auth";

REVOKE ALL ON SCHEMA "better_auth" FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA "better_auth"
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "better_auth"
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "better_auth"
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

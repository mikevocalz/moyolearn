-- Additive migration for the `handoff-codes` collection.
-- Apply with the Supabase MCP `apply_migration`, name: `handoff_codes_collection`.
--
-- WHY THIS EXISTS SEPARATELY: the collection has been registered in
-- payload.config.ts since PR-142 and its table was never created. Every other
-- collection in that list has a table; this one did not, so the first guardian
-- to mint a device-handoff code would have hit a missing relation at runtime
-- rather than at deploy. Found by diffing the registered collections against
-- `list_tables`, not by anything failing.
--
-- HAND-EXTRACTED, for the same reason organizations_additive.sql was: this repo
-- has no migration baseline, so `payload migrate:create` treats every run as
-- INITIAL, emits all 30 tables, dies on the first `CREATE TABLE "users"` and
-- offers a down() that drops the production schema.
--
-- Everything below is additive and idempotent: one table, three indexes, one
-- unique constraint, and the privilege revocations. It drops nothing and alters
-- no existing column.
-- SOT: docs/pack/36-role-navigation-flows.md §2 · docs/38-front-door-and-flow.md §13
--      packages/payload/src/collections/HandoffCodes.ts · packages/auth/src/handoff.ts
-- SOT-KEYWORDS: handoff codes migration sql additive supabase device redeem hash single-use ttl

CREATE TABLE IF NOT EXISTS "payload"."handoff_codes" (
  "id" serial PRIMARY KEY NOT NULL,
  -- The HASH, never the code. The code itself lives only on the guardian's
  -- screen for its TTL; a readable code at rest would make this table a
  -- credential store for every child in the system.
  "code_hash" varchar NOT NULL,
  "learner_auth_id" varchar NOT NULL,
  "guardian_auth_id" varchar NOT NULL,
  "expires_at" timestamp(3) with time zone NOT NULL,
  -- Set exactly once, at redemption. A row with a value here is dead forever:
  -- single-use is a fact of the data rather than a flag every query has to
  -- remember to check.
  "redeemed_at" timestamp(3) with time zone,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- Unique because a collision would let one code redeem against two learners,
-- and because the redeem path looks a row up BY this column.
-- Both handlers, as organizations_additive.sql has them: a duplicate UNIQUE
-- constraint surfaces as 42P07 `duplicate_table` (the backing index), not
-- `duplicate_object` — with only the latter this file failed its second run.
DO $$ BEGIN
  ALTER TABLE "payload"."handoff_codes"
    ADD CONSTRAINT "handoff_codes_code_hash_unique" UNIQUE ("code_hash");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "handoff_codes_code_hash_idx"
  ON "payload"."handoff_codes" ("code_hash");
CREATE INDEX IF NOT EXISTS "handoff_codes_learner_auth_id_idx"
  ON "payload"."handoff_codes" ("learner_auth_id");
CREATE INDEX IF NOT EXISTS "handoff_codes_guardian_auth_id_idx"
  ON "payload"."handoff_codes" ("guardian_auth_id");

-- The sweep index. Expired and redeemed rows are both dead; the retention job
-- reads them by expiry, so it should not scan the whole table to find them.
CREATE INDEX IF NOT EXISTS "handoff_codes_expires_at_idx"
  ON "payload"."handoff_codes" ("expires_at");

-- The locked-documents column every registered collection carries. This file
-- originally shipped without it — the one sibling to do so — and the gap was
-- invisible until the first UPDATE on any other collection: Payload's
-- `checkDocumentLockStatus` selects every collection's rels column in one
-- query, so a single missing column fails updates for ALL collections. Found
-- by the walkthrough seed's idempotency re-run (create passed, update died).
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "handoff_codes_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_handoff_codes_fk"
    FOREIGN KEY ("handoff_codes_id") REFERENCES "payload"."handoff_codes"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_handoff_codes_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("handoff_codes_id");

-- Privileges, mirroring `payload_schema_deny_anon`. The schema-level REVOKE
-- already covers this table through DEFAULT PRIVILEGES, but it is pinned here
-- explicitly for the same reason better_auth_tables.sql pins its own: a table
-- holding credential hashes should not depend on a default set in a different
-- migration to keep the anon key away from it.
REVOKE ALL ON TABLE "payload"."handoff_codes" FROM anon, authenticated;

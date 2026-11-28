-- Additive migration for the `consent-verifications` collection and the
-- `consents.verification_id` column (security finding H3: consent recorded
-- server-side). Apply with the Supabase MCP `apply_migration`, name:
-- `consent_verifications_additive`.
--
-- HAND-EXTRACTED, like handoff_codes_additive.sql: this repo has no migration
-- baseline, so `payload migrate:create` treats every run as INITIAL and offers
-- a down() that drops the production schema.
--
-- Everything below is additive and idempotent: one enum type, one table, four
-- indexes, one new nullable column on `consents`, the locked-documents column,
-- and the privilege revocation. It drops nothing and alters no existing column.
-- SOT: docs/pack/06-auth-onboarding-spec.md §3.1 §6
--      packages/payload/src/collections/ConsentVerifications.ts · packages/auth/src/consent-verification.ts
-- SOT-KEYWORDS: consent verifications migration sql additive supabase code hash record guardian h3

DO $$ BEGIN
  CREATE TYPE "payload"."enum_consent_verifications_method"
    AS ENUM ('email-plus', 'text-plus', 'kba', 'card');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."consent_verifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "guardian_auth_id" varchar NOT NULL,
  "method" "payload"."enum_consent_verifications_method" NOT NULL,
  -- The guardian's own contact; the confirmation message goes here.
  "sent_to" varchar NOT NULL,
  -- The HASH, never the code. The code lives only in the inbox for its TTL.
  "code_hash" varchar NOT NULL,
  "sent_at" timestamp(3) with time zone NOT NULL,
  "attempts" numeric DEFAULT 0 NOT NULL,
  "code_verified_at" timestamp(3) with time zone,
  "confirmation_sent_at" timestamp(3) with time zone,
  "confirmed_at" timestamp(3) with time zone,
  -- Set exactly once. A row with a value here is a consent record.
  "recorded_at" timestamp(3) with time zone,
  "scope" varchar,
  "policy_version" varchar,
  "evidence_ref" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "consent_verifications_guardian_auth_id_idx"
  ON "payload"."consent_verifications" ("guardian_auth_id");
CREATE INDEX IF NOT EXISTS "consent_verifications_code_hash_idx"
  ON "payload"."consent_verifications" ("code_hash");
CREATE INDEX IF NOT EXISTS "consent_verifications_sent_at_idx"
  ON "payload"."consent_verifications" ("sent_at");

-- The grant names the verification it was read from.
ALTER TABLE "payload"."consents"
  ADD COLUMN IF NOT EXISTS "verification_id" varchar;
CREATE INDEX IF NOT EXISTS "consents_verification_id_idx"
  ON "payload"."consents" ("verification_id");

-- The locked-documents column every registered collection carries; see
-- handoff_codes_additive.sql for the UPDATE that fails for ALL collections
-- when one is missing.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "consent_verifications_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_consent_verifications_fk"
    FOREIGN KEY ("consent_verifications_id") REFERENCES "payload"."consent_verifications"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_consent_verifications_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("consent_verifications_id");

-- Pinned explicitly for the same reason handoff_codes_additive.sql pins its
-- own: a table holding credential hashes should not depend on a default set
-- in a different migration to keep the anon key away from it.
REVOKE ALL ON TABLE "payload"."consent_verifications" FROM anon, authenticated;

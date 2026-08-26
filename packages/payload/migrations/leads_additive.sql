-- Additive migration for the Operations Cloud `leads` collection (doc 28 §2).
-- Apply with the Supabase MCP `apply_migration`, name: `leads_collection`.
--
-- HAND-EXTRACTED ON PURPOSE. `payload migrate:create` cannot be used against
-- this database: the repo has no migration baseline, so Payload treats every
-- run as an INITIAL migration and emits all 29 tables. Its up() would fail on
-- the first `CREATE TABLE "users"` (already present), and its down() drops the
-- entire production schema. Those generated files were deleted rather than
-- committed.
--
-- Everything below is additive and idempotent: it creates one table, one enum,
-- eight indexes, and adds one nullable column to an existing table. It drops
-- nothing and alters no existing column.
-- SOT: docs/pack/28-crm-spec.md §2–§3
-- SOT-KEYWORDS: leads migration sql additive supabase crm ops schema

DO $$ BEGIN
  CREATE TYPE "payload"."enum_leads_stage" AS ENUM(
    'Inquiry', 'Trial scheduled', 'Trial completed', 'Proposal', 'Enrolled', 'At risk'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."leads" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" varchar NOT NULL,
  "family" varchar NOT NULL,
  -- A pointer, never a foreign key: the CRM must not be able to traverse into
  -- learner data (doc 28 §2, the wall).
  "learner_ref" varchar,
  "learner" varchar,
  "subject" varchar,
  "stage" "payload"."enum_leads_stage" DEFAULT 'Inquiry' NOT NULL,
  "owner" varchar,
  -- Integer cents. A float cannot hold 0.1 exactly, so a pipeline total in
  -- dollars drifts as it sums.
  "value_cents" numeric DEFAULT 0,
  "currency" varchar DEFAULT 'USD',
  "sessions" numeric DEFAULT 0,
  "next_session_at" timestamp(3) with time zone,
  -- Written by the §6 health scorer from business signals only.
  "needs_attention" boolean DEFAULT false,
  -- Raw value; k-anonymity suppression is decided at READ time against
  -- cohort_size, so the decision is never baked into the row (doc 19 §5).
  "attendance_pct" numeric,
  "cohort_size" numeric DEFAULT 0,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "leads_org_id_idx" ON "payload"."leads" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "leads_family_idx" ON "payload"."leads" USING btree ("family");
CREATE INDEX IF NOT EXISTS "leads_stage_idx" ON "payload"."leads" USING btree ("stage");
CREATE INDEX IF NOT EXISTS "leads_needs_attention_idx" ON "payload"."leads" USING btree ("needs_attention");
CREATE INDEX IF NOT EXISTS "leads_updated_at_idx" ON "payload"."leads" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "leads_created_at_idx" ON "payload"."leads" USING btree ("created_at");
-- The dashboard's default read is "this org, needing attention, newest first".
CREATE INDEX IF NOT EXISTS "orgId_needsAttention_createdAt_idx"
  ON "payload"."leads" USING btree ("org_id", "needs_attention", "created_at");
CREATE INDEX IF NOT EXISTS "orgId_stage_idx"
  ON "payload"."leads" USING btree ("org_id", "stage");

-- Payload's admin lock table needs a column per collection. Nullable, so adding
-- it rewrites no existing row.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "leads_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_leads_fk"
    FOREIGN KEY ("leads_id") REFERENCES "payload"."leads"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_leads_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("leads_id");

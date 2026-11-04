-- Additive migration for the `ai-model-routes` collection.
-- Apply with the Supabase MCP `apply_migration`, name: `ai_model_routes_collection`.
--
-- HAND-EXTRACTED, for the same reason assignments_additive.sql was: this repo
-- has no migration baseline, so `payload migrate:create` treats every run as
-- INITIAL, emits every table, and dies on the first duplicate. The collection
-- (packages/payload/src/collections/AiModelRoutes.ts) holds senior-admin
-- evaluation preferences per tutoring lane. Nothing in the live
-- InferenceGateway reads it.
--
-- Everything below is additive and idempotent: four enums, one table, a
-- unique lane index, two timestamp indexes, one locked-documents column and
-- the privilege pin. RLS is enabled in payload_rls_enable.sql with its
-- siblings. It drops nothing and alters no existing column. `versions: false`
-- on the collection means there is no `_ai_model_routes_v` shadow table.
-- SOT: packages/payload/src/collections/AiModelRoutes.ts · docs/design/payload-ai-model-controls.md
-- SOT-KEYWORDS: ai model routes migration sql additive supabase control center qwen evaluation lane

DO $$ BEGIN
  CREATE TYPE "payload"."enum_ai_model_routes_lane" AS ENUM(
    'tutor-math', 'tutor-ela', 'tutor-science', 'tutor-social-studies', 'tutor-cs',
    'tutor-world-language', 'tutor-other', 'summary-narrative', 'homework-structuring'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_ai_model_routes_primary_model" AS ENUM('claude-opus-5', 'claude-haiku-4-5');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_ai_model_routes_fallback_model" AS ENUM('none', 'qwen3.8-max');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- No production option exists in the enum on purpose: enabling live routing
-- needs a schema change, not just an admin edit.
DO $$ BEGIN
  CREATE TYPE "payload"."enum_ai_model_routes_mode" AS ENUM('disabled', 'evaluation-only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."ai_model_routes" (
  "id" serial PRIMARY KEY NOT NULL,
  "lane" "payload"."enum_ai_model_routes_lane" NOT NULL,
  "primary_model" "payload"."enum_ai_model_routes_primary_model" DEFAULT 'claude-opus-5' NOT NULL,
  "fallback_model" "payload"."enum_ai_model_routes_fallback_model" DEFAULT 'none' NOT NULL,
  "mode" "payload"."enum_ai_model_routes_mode" DEFAULT 'disabled' NOT NULL,
  -- References only. Admin-entered text never grants learner-data access.
  "provider_approval_reference" varchar,
  "subject_evaluation_reference" varchar,
  "notes" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- One row per lane, as a UNIQUE INDEX with the name Payload's own schema push
-- generates (checked by pushing this config into an empty database on
-- 2026-11-04). The older siblings add a separate UNIQUE constraint plus a plain
-- index instead; matching the generated shape means a future push or
-- `migrate:create` sees no drift on this table.
CREATE UNIQUE INDEX IF NOT EXISTS "ai_model_routes_lane_idx"
  ON "payload"."ai_model_routes" USING btree ("lane");
CREATE INDEX IF NOT EXISTS "ai_model_routes_updated_at_idx"
  ON "payload"."ai_model_routes" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "ai_model_routes_created_at_idx"
  ON "payload"."ai_model_routes" USING btree ("created_at");

-- The locked-documents column every registered collection carries. Payload's
-- `checkDocumentLockStatus` selects every collection's rels column in one
-- query, so a single missing column fails updates for ALL collections — the
-- outage handoff_codes_additive.sql documents.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "ai_model_routes_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_ai_model_routes_fk"
    FOREIGN KEY ("ai_model_routes_id") REFERENCES "payload"."ai_model_routes"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_ai_model_routes_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("ai_model_routes_id");

-- Privileges, pinned as the siblings pin theirs: model-control settings
-- should not depend on a default set in a different migration to keep the
-- anon key away from them.
REVOKE ALL ON TABLE "payload"."ai_model_routes" FROM anon, authenticated;

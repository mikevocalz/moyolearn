-- Additive migration for the `enrollments` roster collection.
-- Apply with the Supabase MCP `apply_migration`, name: `enrollments_collection`.
--
-- HAND-EXTRACTED, for the same reason leads_additive.sql was: this repo has no
-- migration baseline, so `payload migrate:create` treats every run as INITIAL,
-- emits every table, and dies on the first duplicate. The Enrollments
-- collection (packages/payload/src/collections/Enrollments.ts) shipped without
-- this file, so a database built from the shipped migrations has no
-- `payload.enrollments` at all — found by the walkthrough seed, which needs
-- the learner→institution bridge to exist before it can roster a school.
--
-- Everything below is additive and idempotent: one enum, one table, five
-- indexes, one locked-documents column. It drops nothing and alters no
-- existing column.
-- SOT: packages/payload/src/collections/Enrollments.ts · docs/pack/01-ai-tutoring-platform-plan.md §(auth mapping)
-- SOT-KEYWORDS: enrollments migration sql additive supabase roster learner school district bridge

DO $$ BEGIN
  CREATE TYPE "payload"."enum_enrollments_status" AS ENUM('active', 'inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."enrollments" (
  "id" serial PRIMARY KEY NOT NULL,
  -- The Better Auth user id of the learner. A pointer by convention (doc 13
  -- §5) — the roster never joins itself to an auth row.
  "learner_auth_id" varchar NOT NULL,
  -- The school or district slug the learner is enrolled in.
  "org_id" varchar NOT NULL,
  -- The district slug, denormalized for district-level rollups.
  "district_id" varchar,
  "program" varchar,
  "status" "payload"."enum_enrollments_status" DEFAULT 'active' NOT NULL,
  "enrolled_at" timestamp(3) with time zone NOT NULL,
  "exited_at" timestamp(3) with time zone,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "enrollments_learner_auth_id_idx" ON "payload"."enrollments" USING btree ("learner_auth_id");
CREATE INDEX IF NOT EXISTS "enrollments_org_id_idx" ON "payload"."enrollments" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "enrollments_district_id_idx" ON "payload"."enrollments" USING btree ("district_id");
CREATE INDEX IF NOT EXISTS "enrollments_updated_at_idx" ON "payload"."enrollments" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "enrollments_created_at_idx" ON "payload"."enrollments" USING btree ("created_at");

ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "enrollments_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk"
    FOREIGN KEY ("enrollments_id") REFERENCES "payload"."enrollments"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_enrollments_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("enrollments_id");

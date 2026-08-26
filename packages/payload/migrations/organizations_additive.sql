-- Additive migration for the `organizations` tenant collection.
-- Apply with the Supabase MCP `apply_migration`, name: `organizations_collection`.
--
-- HAND-EXTRACTED, for the same reason leads_additive.sql was: this repo has no
-- migration baseline, so `payload migrate:create` treats every run as INITIAL,
-- emits all 30 tables, dies on the first `CREATE TABLE "users"` and offers a
-- down() that drops the production schema.
--
-- Everything below is additive and idempotent: two enums, one table, three
-- indexes, one unique constraint, and one nullable column on an existing table.
-- It drops nothing and alters no existing column.
-- SOT: docs/pack/01-ai-tutoring-platform-plan.md §(auth mapping) §7.1 · docs/pack/06-auth-onboarding-spec.md §5
-- SOT-KEYWORDS: organizations migration sql additive supabase tenant org district schema

DO $$ BEGIN
  CREATE TYPE "payload"."enum_organizations_kind" AS ENUM('tutoring', 'school', 'district');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_organizations_brand_accent"
    AS ENUM('ember', 'gold', 'forest', 'sky', 'rose');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."organizations" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  -- The tenant key rows carry as org_id. Unique because an ambiguous tenant key
  -- is a cross-tenant read waiting to happen.
  "slug" varchar NOT NULL,
  "kind" "payload"."enum_organizations_kind" DEFAULT 'tutoring' NOT NULL,
  "logo_url" varchar,
  "brand_accent" "payload"."enum_organizations_brand_accent" DEFAULT 'ember',
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payload"."organizations" ADD CONSTRAINT "organizations_slug_unique" UNIQUE ("slug");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "organizations_slug_idx" ON "payload"."organizations" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "organizations_updated_at_idx" ON "payload"."organizations" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "organizations_created_at_idx" ON "payload"."organizations" USING btree ("created_at");

ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "organizations_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_organizations_fk"
    FOREIGN KEY ("organizations_id") REFERENCES "payload"."organizations"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_organizations_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("organizations_id");

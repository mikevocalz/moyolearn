-- Additive migration for the `classes` collection.
-- Apply with the Supabase MCP `apply_migration`, name: `classes_collection`.
--
-- HAND-EXTRACTED, for the same reason enrollments_additive.sql was: this repo
-- has no migration baseline, so `payload migrate:create` treats every run as
-- INITIAL, emits every table, and dies on the first duplicate. The Classes
-- collection (packages/payload/src/collections/Classes.ts) is the container
-- teacher.classes reads and enrollments' `classId` dimension points into.
--
-- Everything below is additive and idempotent: two enums, one table, one
-- unique constraint, indexes, one locked-documents column, and the privilege
-- pin. It drops nothing and alters no existing column.
-- SOT: packages/payload/src/collections/Classes.ts · design/screens/teacher/teacher.classes/contract.md
-- SOT-KEYWORDS: classes migration sql additive supabase teacher roster grade band code

DO $$ BEGIN
  CREATE TYPE "payload"."enum_classes_grade_band" AS ENUM('k-5', '6-8', '9-12', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_classes_status" AS ENUM('active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."classes" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar NOT NULL,
  -- FD-23's band, captured at creation because it decides which join routes
  -- are lawful (steps.ts `joinOptions`) — never defaulted later.
  "grade_band" "payload"."enum_classes_grade_band" NOT NULL,
  -- The FD-23 join code. Semi-public (read across a classroom), but unique:
  -- a collision would roster a student into somebody else's class.
  "code" varchar NOT NULL,
  "teacher_auth_id" varchar NOT NULL,
  "org_id" varchar NOT NULL,
  "subject" varchar,
  "status" "payload"."enum_classes_status" DEFAULT 'active' NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- Both handlers, as handoff_codes_additive.sql has them: a duplicate UNIQUE
-- constraint surfaces as 42P07 `duplicate_table` (the backing index), not
-- `duplicate_object` — with only the latter that file failed its second run.
DO $$ BEGIN
  ALTER TABLE "payload"."classes"
    ADD CONSTRAINT "classes_code_unique" UNIQUE ("code");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "classes_code_idx" ON "payload"."classes" USING btree ("code");
CREATE INDEX IF NOT EXISTS "classes_teacher_auth_id_idx" ON "payload"."classes" USING btree ("teacher_auth_id");
CREATE INDEX IF NOT EXISTS "classes_org_id_idx" ON "payload"."classes" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "classes_updated_at_idx" ON "payload"."classes" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "classes_created_at_idx" ON "payload"."classes" USING btree ("created_at");

-- The locked-documents column every registered collection carries. Payload's
-- `checkDocumentLockStatus` selects every collection's rels column in one
-- query, so a single missing column fails updates for ALL collections — the
-- outage handoff_codes_additive.sql documents.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "classes_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_classes_fk"
    FOREIGN KEY ("classes_id") REFERENCES "payload"."classes"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_classes_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("classes_id");

-- Privileges, pinned as handoff_codes_additive.sql pins its own: the schema
-- REVOKE already covers this table through DEFAULT PRIVILEGES, but a table of
-- join codes should not depend on a default set in a different migration to
-- keep the anon key away from it.
REVOKE ALL ON TABLE "payload"."classes" FROM anon, authenticated;

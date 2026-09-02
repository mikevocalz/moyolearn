-- Additive migration for the `assignments` collection.
-- Apply with the Supabase MCP `apply_migration`, name: `assignments_collection`.
--
-- HAND-EXTRACTED, for the same reason classes_additive.sql was: this repo has
-- no migration baseline, so `payload migrate:create` treats every run as
-- INITIAL, emits every table, and dies on the first duplicate. Assignments
-- (packages/payload/src/collections/Assignments.ts) are the object
-- teacher.assign publishes — the producer end of J1's arrival signal.
--
-- Everything below is additive and idempotent: one enum, two tables (Payload
-- models an array field as a side table), indexes, one locked-documents
-- column, and the privilege pins. It drops nothing and alters no existing
-- column.
-- SOT: packages/payload/src/collections/Assignments.ts · design/screens/teacher/teacher.assign/contract.md
-- SOT-KEYWORDS: assignments migration sql additive supabase teacher publish draft work items

DO $$ BEGIN
  CREATE TYPE "payload"."enum_assignments_status" AS ENUM('draft', 'published', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."assignments" (
  "id" serial PRIMARY KEY NOT NULL,
  -- The target class — a `classes` document id, a pointer by convention like
  -- every *AuthId in this schema (doc 13 §5): no cross-collection FK.
  "class_id" varchar NOT NULL,
  "teacher_auth_id" varchar NOT NULL,
  "org_id" varchar NOT NULL,
  "title" varchar NOT NULL,
  "subject" varchar,
  "due_at" timestamp(3) with time zone NOT NULL,
  "status" "payload"."enum_assignments_status" DEFAULT 'draft' NOT NULL,
  -- Set exactly once, at publish; a draft has none. "Never half-published" is
  -- a fact of the row, not a flag.
  "published_at" timestamp(3) with time zone,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- Payload models the `workItems` array field as a side table: `_order` and
-- `_parent_id` are drizzle's array-row columns, and `id` is the varchar row
-- key Payload mints per item.
CREATE TABLE IF NOT EXISTS "payload"."assignments_work_items" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "template_id" varchar,
  "title" varchar NOT NULL,
  "description" varchar NOT NULL,
  "minutes" numeric NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payload"."assignments_work_items"
    ADD CONSTRAINT "assignments_work_items_parent_id_fk"
    FOREIGN KEY ("_parent_id") REFERENCES "payload"."assignments"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "assignments_work_items_order_idx"
  ON "payload"."assignments_work_items" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "assignments_work_items_parent_id_idx"
  ON "payload"."assignments_work_items" USING btree ("_parent_id");

CREATE INDEX IF NOT EXISTS "assignments_class_id_idx" ON "payload"."assignments" USING btree ("class_id");
CREATE INDEX IF NOT EXISTS "assignments_teacher_auth_id_idx" ON "payload"."assignments" USING btree ("teacher_auth_id");
CREATE INDEX IF NOT EXISTS "assignments_org_id_idx" ON "payload"."assignments" USING btree ("org_id");
-- The tracking list's "due this week" read.
CREATE INDEX IF NOT EXISTS "assignments_due_at_idx" ON "payload"."assignments" USING btree ("due_at");
CREATE INDEX IF NOT EXISTS "assignments_updated_at_idx" ON "payload"."assignments" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "assignments_created_at_idx" ON "payload"."assignments" USING btree ("created_at");

-- The locked-documents column every registered collection carries. Payload's
-- `checkDocumentLockStatus` selects every collection's rels column in one
-- query, so a single missing column fails updates for ALL collections — the
-- outage handoff_codes_additive.sql documents.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "assignments_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_assignments_fk"
    FOREIGN KEY ("assignments_id") REFERENCES "payload"."assignments"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_assignments_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("assignments_id");

-- Privileges, pinned as the siblings pin theirs — both tables, since the side
-- table carries the same class of data as its parent.
REVOKE ALL ON TABLE "payload"."assignments" FROM anon, authenticated;
REVOKE ALL ON TABLE "payload"."assignments_work_items" FROM anon, authenticated;

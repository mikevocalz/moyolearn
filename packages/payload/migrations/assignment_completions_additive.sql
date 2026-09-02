-- Additive migration for the `assignment-completions` collection.
-- Apply with the Supabase MCP `apply_migration`, name: `assignment_completions_collection`.
--
-- HAND-EXTRACTED, for the same reason assignments_additive.sql was: this repo
-- has no migration baseline, so `payload migrate:create` treats every run as
-- INITIAL, emits every table, and dies on the first duplicate. A completion is
-- the learner's self-reported "I did it" for one published assignment
-- (packages/payload/src/collections/AssignmentCompletions.ts) — the return
-- half of J1's arrival signal.
--
-- Everything below is additive and idempotent: one table (no enums), one
-- unique constraint, indexes, one locked-documents column, and the privilege
-- pins. It drops nothing and alters no existing column.
-- SOT: packages/payload/src/collections/AssignmentCompletions.ts · packages/app/features/assignments/learner-assignments.service.ts
-- SOT-KEYWORDS: assignment completions migration sql additive supabase mark done unique double-tap

CREATE TABLE IF NOT EXISTS "payload"."assignment_completions" (
  "id" serial PRIMARY KEY NOT NULL,
  -- The completed assignment — an `assignments` document id, a pointer by
  -- convention like every *AuthId in this schema (doc 13 §5): no
  -- cross-collection FK.
  "assignment_id" varchar NOT NULL,
  "learner_auth_id" varchar NOT NULL,
  -- The assignment's class at the moment of completion, denormalized so
  -- teacher counts group by class without a join back through `assignments`.
  "class_id" varchar NOT NULL,
  "completed_at" timestamp(3) with time zone NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- One row per (assignment, learner): the service checks first, but THIS is
-- what makes a double-tap on a slow network physically unable to double-count.
-- Both handlers, as handoff_codes_additive.sql learned: a duplicate UNIQUE
-- constraint surfaces as 42P07 `duplicate_table` (the backing index), not
-- `duplicate_object`.
DO $$ BEGIN
  ALTER TABLE "payload"."assignment_completions"
    ADD CONSTRAINT "assignment_completions_assignment_learner_unique"
    UNIQUE ("assignment_id", "learner_auth_id");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- The teacher-count read (by assignment) and the learner's own-state read (by
-- learner) each get their dimension; class_id serves the per-class rollup.
CREATE INDEX IF NOT EXISTS "assignment_completions_assignment_id_idx"
  ON "payload"."assignment_completions" USING btree ("assignment_id");
CREATE INDEX IF NOT EXISTS "assignment_completions_learner_auth_id_idx"
  ON "payload"."assignment_completions" USING btree ("learner_auth_id");
CREATE INDEX IF NOT EXISTS "assignment_completions_class_id_idx"
  ON "payload"."assignment_completions" USING btree ("class_id");
CREATE INDEX IF NOT EXISTS "assignment_completions_updated_at_idx"
  ON "payload"."assignment_completions" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "assignment_completions_created_at_idx"
  ON "payload"."assignment_completions" USING btree ("created_at");

-- The locked-documents column every registered collection carries. Payload's
-- `checkDocumentLockStatus` selects every collection's rels column in one
-- query, so a single missing column fails updates for ALL collections — the
-- outage handoff_codes_additive.sql documents.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "assignment_completions_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_assignment_completions_fk"
    FOREIGN KEY ("assignment_completions_id") REFERENCES "payload"."assignment_completions"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_assignment_completions_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("assignment_completions_id");

-- Privileges, pinned as the siblings pin theirs: learner activity data should
-- not depend on a default set in a different migration to keep the anon key
-- away from it.
REVOKE ALL ON TABLE "payload"."assignment_completions" FROM anon, authenticated;

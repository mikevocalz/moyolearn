-- Additive migration for ADR-124 — the `homeworkSubmissions`, `homeworkQuestions`
-- and `homeworkPracticeSets` collections.
-- Apply with the Supabase MCP `apply_migration`, name: `homework_collections`.
--
-- HAND-EXTRACTED, for the reason every *_additive.sql beside it records: this
-- repo has no migration baseline, so `payload migrate:create` treats every run
-- as INITIAL, emits every table, dies on the first `CREATE TABLE "users"` and
-- offers a down() that drops the production schema. `PAYLOAD_PUSH` is off for
-- the same reason.
--
-- Everything below is additive and idempotent: four enums, three tables, four
-- unique constraints, the indexes, and three nullable columns on Payload's admin
-- lock table. It drops nothing and alters no existing column.
--
-- THREE RETENTION FACTS ARE IN THE SHAPE, NOT IN A JOB.
--   1. No `expires_at` on any of the three tables. A worksheet, its confirmed
--      text and the guardian's practice set are the learner's record of work:
--      `sweep.sql` deletes on `expires_at` predicates and so cannot reach them,
--      and the only deleter is the account cascade (`SUBJECT_COLLECTIONS` in
--      apps/web/lib/account-deletion.repository.ts), by `learner_auth_id`.
--   2. `homework_questions.crop_expires_at` is the child image's own clock,
--      seven days from capture (`MEDIA_TTL_DAYS`). `sweep.sql` nulls `crop`
--      when it passes and leaves the row; the partial index below keeps that
--      predicate the size of the crops still alive.
--   3. `(submission_id, order_index)` is UNIQUE (the collection's `indexes`
--      entry, named as families_org_id_name_unique is): ten questions become exactly ten ordered rows, and a retried
--      create that raced its first attempt collides here instead of putting an
--      eleventh question in front of a child.
-- SOT: docs/decisions/adr-124-homework-submissions-persistence.md · docs/work/pr-100/contract.md §Data · packages/payload/src/collections/HomeworkSubmissions.ts · HomeworkQuestions.ts · HomeworkPracticeSets.ts
-- SOT-KEYWORDS: homework migration sql additive supabase submissions questions practice sets cursor revisions crop expiry unique order index

DO $$ BEGIN
  CREATE TYPE "payload"."enum_homework_submissions_status"
    AS ENUM ('reviewing', 'ready', 'in-progress', 'complete', 'abandoned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_homework_submissions_pipeline_status"
    AS ENUM ('pending', 'extracting', 'extracted', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_homework_questions_outcome"
    AS ENUM ('unattempted', 'skipped', 'attempted', 'supported-with-hints', 'solved-independently', 'unresolved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_homework_practice_sets_status"
    AS ENUM ('draft', 'approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── homework_submissions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "payload"."homework_submissions" (
  "id" serial PRIMARY KEY NOT NULL,
  -- Client-minted UUID. Unique, so a retried POST lands on the row it already
  -- made rather than creating a second homework record.
  "submission_id" varchar NOT NULL,
  -- Pointers to Better Auth, never foreign keys (doc 13 §5). `created_by` is
  -- the guardian when a parent uploaded for a ward; the service accepted that
  -- only against an ACTIVE guardianship.
  "learner_auth_id" varchar NOT NULL,
  "created_by_auth_id" varchar NOT NULL,
  "subject" varchar NOT NULL,
  "title" varchar NOT NULL,
  "instructions" varchar DEFAULT '' NOT NULL,
  -- The learner's local calendar date, `YYYY-MM-DD`; text so the guardian
  -- timeline groups by the day the child worked, not by a UTC instant.
  "local_date" varchar NOT NULL,
  "status" "payload"."enum_homework_submissions_status" DEFAULT 'reviewing' NOT NULL,
  "pipeline_status" "payload"."enum_homework_submissions_pipeline_status" DEFAULT 'pending' NOT NULL,
  "pipeline_error" varchar,
  -- THE CURSOR. Moved only by `advanceSubmission`, in the same transaction that
  -- records the outgoing question's outcome.
  "current_index" numeric DEFAULT 0 NOT NULL,
  "current_question_id" varchar NOT NULL,
  -- Text pointer into `tutor_sessions.session_id`, set when Natalie opens.
  "tutor_session_id" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payload"."homework_submissions"
    ADD CONSTRAINT "homework_submissions_submission_id_unique" UNIQUE ("submission_id");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "homework_submissions_submission_id_idx"
  ON "payload"."homework_submissions" USING btree ("submission_id");
CREATE INDEX IF NOT EXISTS "homework_submissions_learner_auth_id_idx"
  ON "payload"."homework_submissions" USING btree ("learner_auth_id");
CREATE INDEX IF NOT EXISTS "homework_submissions_created_by_auth_id_idx"
  ON "payload"."homework_submissions" USING btree ("created_by_auth_id");
CREATE INDEX IF NOT EXISTS "homework_submissions_local_date_idx"
  ON "payload"."homework_submissions" USING btree ("local_date");
CREATE INDEX IF NOT EXISTS "homework_submissions_status_idx"
  ON "payload"."homework_submissions" USING btree ("status");
CREATE INDEX IF NOT EXISTS "homework_submissions_tutor_session_id_idx"
  ON "payload"."homework_submissions" USING btree ("tutor_session_id");
CREATE INDEX IF NOT EXISTS "homework_submissions_updated_at_idx"
  ON "payload"."homework_submissions" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "homework_submissions_created_at_idx"
  ON "payload"."homework_submissions" USING btree ("created_at");

-- The timeline read is "this learner, newest first" and runs on every open of
-- Student Today and Parent Daily Work.
CREATE INDEX IF NOT EXISTS "homework_submissions_timeline_idx"
  ON "payload"."homework_submissions" USING btree ("learner_auth_id", "created_at" DESC);

-- ── homework_questions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "payload"."homework_questions" (
  "id" serial PRIMARY KEY NOT NULL,
  -- Server-minted. Unique because `edu.questions.question_id` points at it.
  "question_id" varchar NOT NULL,
  -- Pointer to `homework_submissions.submission_id`.
  "submission_id" varchar NOT NULL,
  -- Denormalised from the submission so the account cascade deletes this table
  -- by `learner_auth_id` without a join.
  "learner_auth_id" varchar NOT NULL,
  "order_index" numeric NOT NULL,
  "source_page" numeric NOT NULL,
  "source_number" numeric,
  -- The revision `edu.questions` was last issued under (ADR-119).
  "current_revision" varchar NOT NULL,
  "text" varchar NOT NULL,
  -- `QuestionRevision[]`, oldest first, append-only.
  "revisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- `QuestionCrop | NULL`. The child image; nulled by the sweep at expiry.
  "crop" jsonb,
  "crop_expires_at" timestamp(3) with time zone,
  "outcome" "payload"."enum_homework_questions_outcome" DEFAULT 'unattempted' NOT NULL,
  "attempts" numeric DEFAULT 0 NOT NULL,
  "hints_used" numeric DEFAULT 0 NOT NULL,
  -- `string[]` of misconception tags.
  "misconception_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "started_at" timestamp(3) with time zone,
  "completed_at" timestamp(3) with time zone,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payload"."homework_questions"
    ADD CONSTRAINT "homework_questions_question_id_unique" UNIQUE ("question_id");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- Ten questions, ten rows, in order. Mirrors `indexes` in HomeworkQuestions.ts.
DO $$ BEGIN
  ALTER TABLE "payload"."homework_questions"
    ADD CONSTRAINT "homework_questions_submission_id_order_index_unique" UNIQUE ("submission_id", "order_index");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "homework_questions_question_id_idx"
  ON "payload"."homework_questions" USING btree ("question_id");
CREATE INDEX IF NOT EXISTS "homework_questions_submission_id_idx"
  ON "payload"."homework_questions" USING btree ("submission_id");
CREATE INDEX IF NOT EXISTS "homework_questions_learner_auth_id_idx"
  ON "payload"."homework_questions" USING btree ("learner_auth_id");
CREATE INDEX IF NOT EXISTS "homework_questions_outcome_idx"
  ON "payload"."homework_questions" USING btree ("outcome");
CREATE INDEX IF NOT EXISTS "homework_questions_crop_expires_at_idx"
  ON "payload"."homework_questions" USING btree ("crop_expires_at");
CREATE INDEX IF NOT EXISTS "homework_questions_updated_at_idx"
  ON "payload"."homework_questions" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "homework_questions_created_at_idx"
  ON "payload"."homework_questions" USING btree ("created_at");

-- The sweep's predicate: crops that still exist and have a clock. Partial, so
-- the index is the size of the live images rather than of every question the
-- product has ever held — and empty once every crop has been nulled.
CREATE INDEX IF NOT EXISTS "homework_questions_live_crop_idx"
  ON "payload"."homework_questions" USING btree ("crop_expires_at")
  WHERE "crop" IS NOT NULL AND "crop_expires_at" IS NOT NULL;

-- ── homework_practice_sets ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "payload"."homework_practice_sets" (
  "id" serial PRIMARY KEY NOT NULL,
  "practice_set_id" varchar NOT NULL,
  -- Pointer to `homework_submissions.submission_id`.
  "submission_id" varchar NOT NULL,
  "learner_auth_id" varchar NOT NULL,
  -- The guardian who drafted and may approve. Every read and the approve write
  -- carry `guardian_auth_id = ctx.learnerId`; `items[].answer` is the key and
  -- is guardian-only by that scoping.
  "guardian_auth_id" varchar NOT NULL,
  "status" "payload"."enum_homework_practice_sets_status" DEFAULT 'draft' NOT NULL,
  "seed" varchar NOT NULL,
  -- `string[]` of skill tags targeted.
  "targeted_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- `PracticeItem[]`, each `answer` verified by `checkExactMath` before save.
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payload"."homework_practice_sets"
    ADD CONSTRAINT "homework_practice_sets_practice_set_id_unique" UNIQUE ("practice_set_id");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "homework_practice_sets_practice_set_id_idx"
  ON "payload"."homework_practice_sets" USING btree ("practice_set_id");
CREATE INDEX IF NOT EXISTS "homework_practice_sets_submission_id_idx"
  ON "payload"."homework_practice_sets" USING btree ("submission_id");
CREATE INDEX IF NOT EXISTS "homework_practice_sets_learner_auth_id_idx"
  ON "payload"."homework_practice_sets" USING btree ("learner_auth_id");
CREATE INDEX IF NOT EXISTS "homework_practice_sets_guardian_auth_id_idx"
  ON "payload"."homework_practice_sets" USING btree ("guardian_auth_id");
CREATE INDEX IF NOT EXISTS "homework_practice_sets_status_idx"
  ON "payload"."homework_practice_sets" USING btree ("status");
CREATE INDEX IF NOT EXISTS "homework_practice_sets_updated_at_idx"
  ON "payload"."homework_practice_sets" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "homework_practice_sets_created_at_idx"
  ON "payload"."homework_practice_sets" USING btree ("created_at");

-- ── Payload's admin lock table ───────────────────────────────────────────────
-- One nullable column per collection, as every collection's migration does;
-- without it the admin panel cannot hold an edit lock on a row. Nullable, so
-- adding each rewrites no existing row.

ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "homework_submissions_id" integer;
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "homework_questions_id" integer;
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "homework_practice_sets_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_homework_submissions_fk"
    FOREIGN KEY ("homework_submissions_id") REFERENCES "payload"."homework_submissions"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_homework_questions_fk"
    FOREIGN KEY ("homework_questions_id") REFERENCES "payload"."homework_questions"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_homework_practice_sets_fk"
    FOREIGN KEY ("homework_practice_sets_id") REFERENCES "payload"."homework_practice_sets"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_homework_submissions_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("homework_submissions_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_homework_questions_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("homework_questions_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_homework_practice_sets_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("homework_practice_sets_id");

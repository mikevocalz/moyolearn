-- Requires homework_additive.sql. No classifier is enabled by this migration.
DO $$ BEGIN
  CREATE TYPE "payload"."enum_homework_questions_prior_work"
    AS ENUM ('none', 'partial', 'complete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_homework_questions_prior_work_source"
    AS ENUM ('detected', 'guardian');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "payload"."homework_questions"
  ADD COLUMN IF NOT EXISTS "prior_work" "payload"."enum_homework_questions_prior_work" DEFAULT 'none' NOT NULL;
ALTER TABLE "payload"."homework_questions"
  ADD COLUMN IF NOT EXISTS "prior_work_confidence" numeric;
ALTER TABLE "payload"."homework_questions"
  ADD COLUMN IF NOT EXISTS "prior_work_source" "payload"."enum_homework_questions_prior_work_source";
ALTER TABLE "payload"."homework_questions"
  ADD COLUMN IF NOT EXISTS "prior_work_revisions" jsonb DEFAULT '[]'::jsonb NOT NULL;

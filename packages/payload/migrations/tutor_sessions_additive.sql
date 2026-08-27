-- Additive migration for the `tutorSessions` collection (doc 23).
-- Apply with the Supabase MCP `apply_migration`, name: `tutor_sessions_collection`.
--
-- HAND-EXTRACTED, for the reason leads_additive.sql and organizations_additive.sql
-- both record: this repo has no migration baseline, so `payload migrate:create`
-- treats every run as INITIAL, emits all 31 tables, dies on the first
-- `CREATE TABLE "users"` and offers a down() that drops the production schema.
--
-- Everything below is additive and idempotent: one table, one unique constraint,
-- five indexes, and one nullable column on Payload's admin lock table. It drops
-- nothing and alters no existing column.
-- SOT: docs/pack/23-tutorstage-handoff.md · packages/payload/src/collections/TutorSessions.ts
-- SOT-KEYWORDS: tutor sessions migration sql additive supabase conversation messages schema

CREATE TABLE IF NOT EXISTS "payload"."tutor_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  -- The handle a second device resolves the thread BY. Unique, because two rows
  -- sharing it fork the conversation silently — the fork is invisible until a
  -- parent notices half the session missing.
  "session_id" varchar NOT NULL,
  -- A pointer to the Better Auth user, never a foreign key. Same convention as
  -- consents, guardianships and student_model_facts: learner learning data never
  -- joins itself to an auth row (doc 13 §5).
  "learner_auth_id" varchar NOT NULL,
  "problem" varchar,
  -- `StoredMessage[]`, attachments nested one level down. jsonb rather than two
  -- generated join tables, because the document is always read and written whole.
  "messages" jsonb NOT NULL,
  -- NULL is the open session. A nullable timestamp rather than an is_open flag:
  -- "when did this end" is the question retention and ops actually ask.
  "closed_at" timestamp(3) with time zone,
  -- Written once at creation from the transcript window (doc 07 §4 / ADR-006).
  -- No update path in the repository names this column, which is what replaces
  -- session_transcripts' immutability on a collection that must be appendable.
  "expires_at" timestamp(3) with time zone NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payload"."tutor_sessions"
    ADD CONSTRAINT "tutor_sessions_session_id_unique" UNIQUE ("session_id");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "tutor_sessions_session_id_idx"
  ON "payload"."tutor_sessions" USING btree ("session_id");
CREATE INDEX IF NOT EXISTS "tutor_sessions_learner_auth_id_idx"
  ON "payload"."tutor_sessions" USING btree ("learner_auth_id");
CREATE INDEX IF NOT EXISTS "tutor_sessions_expires_at_idx"
  ON "payload"."tutor_sessions" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "tutor_sessions_updated_at_idx"
  ON "payload"."tutor_sessions" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "tutor_sessions_created_at_idx"
  ON "payload"."tutor_sessions" USING btree ("created_at");

-- The resume read is "this learner, still open, newest first" and it runs on
-- every tutor stage mount. A partial index, so it stays the size of the live
-- conversations rather than of every session the product has ever held.
CREATE INDEX IF NOT EXISTS "tutor_sessions_open_by_learner_idx"
  ON "payload"."tutor_sessions" USING btree ("learner_auth_id", "created_at")
  WHERE "closed_at" IS NULL;

-- Payload's admin lock table needs a column per collection. Nullable, so adding
-- it rewrites no existing row.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "tutor_sessions_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_tutor_sessions_fk"
    FOREIGN KEY ("tutor_sessions_id") REFERENCES "payload"."tutor_sessions"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tutor_sessions_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("tutor_sessions_id");

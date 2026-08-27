-- Additive migration for the `safetyEvents` collection (doc 07 §3 layer 7, doc 12 §5).
-- Apply with the Supabase MCP `apply_migration`, name: `safety_events_collection`.
--
-- HAND-EXTRACTED, for the reason leads_additive.sql, organizations_additive.sql
-- and tutor_sessions_additive.sql all record: this repo has no migration
-- baseline, so `payload migrate:create` treats every run as INITIAL, emits every
-- table, dies on the first `CREATE TABLE "users"` and offers a down() that drops
-- the production schema.
--
-- Everything below is additive and idempotent: two enums, one table, one unique
-- constraint, six indexes, and one nullable column on Payload's admin lock
-- table. It drops nothing and alters no existing column.
--
-- THE STORE IS SEPARATE ON PURPOSE. Doc 07 §3 layer 7 keeps safety events out of
-- the pedagogical student model entirely, and doc 12 §7 keeps audit and safety
-- events in "separate stores with separate retention". `expires_at` here is
-- written from `SAFETY_EVENT_TTL_DAYS` (90 days) — not from the transcript's 30
-- and not from a derived fact's 400 — and the sweep in
-- `packages/payload/src/retention/sweep.sql` deletes on it.
-- SOT: docs/pack/07-security-child-ai-safety-spec.md §3 §7 · docs/pack/12-systems-design-prompt.md §5 §7 · packages/payload/src/collections/SafetyEvents.ts
-- SOT-KEYWORDS: safety events migration sql additive supabase guardian alert crisis pause retention trace

-- Payload's postgres adapter models a `select` field as a native enum. Created
-- with the same guard the collection's own values carry: `paused` is doc 12 §5's
-- fail-closed status and is NOT one of doc 07 §S26's three alert categories,
-- because nothing about a timed-out classifier is a fact about the child.
DO $$ BEGIN
  CREATE TYPE "payload"."enum_safety_events_category" AS ENUM ('crisis', 'safety', 'boundary', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_safety_events_disposition" AS ENUM ('crisis', 'blocked', 'redirect', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."safety_events" (
  "id" serial PRIMARY KEY NOT NULL,
  -- Minted by `safetyEventFor` before the write, so a retried turn collides
  -- instead of putting the same alert in front of a parent twice.
  "event_id" varchar NOT NULL,
  -- A pointer to the Better Auth user, never a foreign key. Same convention as
  -- consents, guardianships, tutor_sessions and student_model_facts: learner
  -- data never joins itself to an auth row (doc 13 §5).
  "learner_auth_id" varchar NOT NULL,
  -- Nullable: a turn can be screened before a session row exists.
  "session_id" varchar,
  "category" "payload"."enum_safety_events_category" NOT NULL,
  "disposition" "payload"."enum_safety_events_disposition" NOT NULL,
  -- `PlaneLog.layer` of the last trace entry. Text rather than an enum so a
  -- layer added to the plane records correctly the day it is added.
  "stopped_at" varchar NOT NULL,
  -- `PlaneLog[]`. Layer ids and verdict labels ONLY — no message, no draft, no
  -- excerpt. The words stay in session_transcripts on the transcript's clock;
  -- a copy here would be a second copy of a child's words on a second schedule.
  "trace" jsonb NOT NULL,
  -- Stored rather than re-derived at read time: a row re-judged by a later
  -- build would change what a parent was shown about something that already
  -- happened.
  "guardian_visible" boolean DEFAULT false NOT NULL,
  "occurred_at" timestamp(3) with time zone NOT NULL,
  -- The store's OWN window (90 days), written once at creation. There is no
  -- update access on the collection, so no code path renews it.
  "expires_at" timestamp(3) with time zone NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payload"."safety_events"
    ADD CONSTRAINT "safety_events_event_id_unique" UNIQUE ("event_id");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "safety_events_event_id_idx"
  ON "payload"."safety_events" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "safety_events_learner_auth_id_idx"
  ON "payload"."safety_events" USING btree ("learner_auth_id");
CREATE INDEX IF NOT EXISTS "safety_events_session_id_idx"
  ON "payload"."safety_events" USING btree ("session_id");
CREATE INDEX IF NOT EXISTS "safety_events_category_idx"
  ON "payload"."safety_events" USING btree ("category");
CREATE INDEX IF NOT EXISTS "safety_events_guardian_visible_idx"
  ON "payload"."safety_events" USING btree ("guardian_visible");
CREATE INDEX IF NOT EXISTS "safety_events_occurred_at_idx"
  ON "payload"."safety_events" USING btree ("occurred_at");
CREATE INDEX IF NOT EXISTS "safety_events_expires_at_idx"
  ON "payload"."safety_events" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "safety_events_updated_at_idx"
  ON "payload"."safety_events" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "safety_events_created_at_idx"
  ON "payload"."safety_events" USING btree ("created_at");

-- The guardian read is "these learners, guardian-visible, newest first" and it
-- runs on every load of S12. A partial index, so it stays the size of the alerts
-- a parent can actually be shown rather than of every fence a curious kid ever
-- tripped.
CREATE INDEX IF NOT EXISTS "safety_events_guardian_feed_idx"
  ON "payload"."safety_events" USING btree ("learner_auth_id", "occurred_at")
  WHERE "guardian_visible";

-- Payload's admin lock table needs a column per collection. Nullable, so adding
-- it rewrites no existing row.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "safety_events_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_safety_events_fk"
    FOREIGN KEY ("safety_events_id") REFERENCES "payload"."safety_events"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_safety_events_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("safety_events_id");

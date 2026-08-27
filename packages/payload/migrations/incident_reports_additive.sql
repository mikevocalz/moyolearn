-- Additive migration for doc 31 §3 (the S1–S4 tier on `safety_events`) and §4
-- (the `incidentReports` collection).
-- Applied with the Supabase MCP `apply_migration`, name: `incident_reports_collection`.
--
-- HAND-EXTRACTED, for the reason leads_additive.sql, organizations_additive.sql,
-- tutor_sessions_additive.sql and safety_events_additive.sql all record: this
-- repo has no migration baseline, so `payload migrate:create` treats every run
-- as INITIAL, emits every table, dies on the first `CREATE TABLE "users"` and
-- offers a down() that drops the production schema. `PAYLOAD_PUSH` is off for
-- the same reason.
--
-- Everything below is additive and idempotent: six enums, one column on an
-- existing table plus its backfill, two tables, one unique constraint, the
-- indexes, and one nullable column on Payload's admin lock table. It drops
-- nothing and rewrites no existing column's type.
--
-- THE ONE NON-OBVIOUS PIECE IS THE BACKFILL. `safety_events.tier` is doc 31
-- §3.2's ladder arriving on a store that already had rows, and the mapping is
-- `packages/safety/src/ladder.ts:tierFor` written in SQL — crisis→S4, safety→S3,
-- boundary→S1, paused→NULL. It is a MIGRATION of the severity dimension, not a
-- second one beside it: `guardian_visible` was `category <> 'boundary'` and is
-- now `tier IS NULL OR tier >= 'S3'`, which is the same answer for every row
-- that exists, which is the point — doc 31's taxonomy replaces the old one
-- without silently starting or stopping one notification to one parent.
-- SOT: docs/pack/31-grade-voice-safety-incidents.md §3.2 §4 · packages/payload/src/collections/IncidentReports.ts · packages/safety/src/ladder.ts
-- SOT-KEYWORDS: incident reports migration sql additive supabase tier ladder S1 S2 S3 S4 legal hold sla timeline append only retention sweep

-- ── doc 31 §3.2 · the ladder on the existing event store ────────────────────
DO $$ BEGIN
  CREATE TYPE "payload"."enum_safety_events_tier" AS ENUM ('S1', 'S2', 'S3', 'S4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Nullable, and the null is load-bearing rather than a convenience: doc 12 §5's
-- fail-closed `paused` row is a fact about a classifier that could not answer,
-- and there is no severity of CHILD BEHAVIOUR to assign to it. A NOT NULL column
-- here would force an S1 onto a system outage.
ALTER TABLE "payload"."safety_events"
  ADD COLUMN IF NOT EXISTS "tier" "payload"."enum_safety_events_tier";

UPDATE "payload"."safety_events"
   SET "tier" = CASE "category"
                  WHEN 'crisis'   THEN 'S4'
                  WHEN 'safety'   THEN 'S3'
                  WHEN 'boundary' THEN 'S1'
                  ELSE NULL
                END::"payload"."enum_safety_events_tier"
 WHERE "tier" IS NULL
   AND "category" <> 'paused';

CREATE INDEX IF NOT EXISTS "safety_events_tier_idx"
  ON "payload"."safety_events" USING btree ("tier");

-- ── doc 31 §4 · the incident store ──────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "payload"."enum_incident_reports_source" AS ENUM ('automated', 'submitted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_incident_reports_reporter_role"
    AS ENUM ('system', 'tutor', 'staff', 'guardian', 'learner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_incident_reports_category" AS ENUM (
    'profanity', 'sexual-content', 'bullying', 'pii-shared', 'violence',
    'substances', 'self-harm', 'abuse-disclosure', 'tutor-behavior',
    'safety-concern', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_incident_reports_severity" AS ENUM ('S1', 'S2', 'S3', 'S4');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_incident_reports_status"
    AS ENUM ('new', 'triaged', 'in-review', 'actioned', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."incident_reports" (
  "id" serial PRIMARY KEY NOT NULL,
  -- Minted before the write, so a retried file collides instead of putting the
  -- same case in front of a parent twice.
  "incident_id" varchar NOT NULL,
  "source" "payload"."enum_incident_reports_source" NOT NULL,
  "reporter_role" "payload"."enum_incident_reports_reporter_role" NOT NULL,
  -- NULL when anonymous, in the ROW and not merely hidden in the UI. §4's
  -- anonymous-reporting evidence is about people trusting that; a row that still
  -- holds the id is a promise broken by the first person with a connection.
  "reporter_auth_id" varchar,
  "anonymous" boolean DEFAULT false NOT NULL,
  -- Pointers to Better Auth users, never foreign keys. Same convention as
  -- consents, guardianships, tutor_sessions and safety_events: learner data
  -- never joins itself to an auth row (doc 13 §5).
  "subject_learner_auth_id" varchar NOT NULL,
  "related_session_id" varchar,
  -- `safety_events.event_id`, as a pointer. NOT a foreign key: the event store
  -- keeps 90 days and this one keeps the learner-content window, so the two
  -- expire independently and an expiring event must not take the case with it.
  "related_event_id" varchar,
  "category" "payload"."enum_incident_reports_category" NOT NULL,
  "severity" "payload"."enum_incident_reports_severity" NOT NULL,
  "occurred_at" timestamp(3) with time zone NOT NULL,
  -- Observable behaviour, never inferred intent (doc 31 §3.2's closing note).
  "summary" varchar NOT NULL,
  -- `{ sessionId, messageIds }`. A REFERENCE rendered under permission, never a
  -- copy — the words stay in session_transcripts on the transcript's own clock.
  "transcript_excerpt" jsonb,
  "immediate_action_taken" varchar,
  "status" "payload"."enum_incident_reports_status" DEFAULT 'new' NOT NULL,
  "assignee_auth_id" varchar,
  -- §4.3, from severity at creation. NULL below S3, which owes no clock.
  "sla_due_at" timestamp(3) with time zone,
  "guardian_visible" boolean DEFAULT false NOT NULL,
  "guardian_acknowledged_at" timestamp(3) with time zone,
  "resolution" varchar,
  -- `IncidentTimelineEntry[]`, append-only. The append is a property of
  -- `packages/safety/src/incidents.ts:appendTimeline` — which spreads rather
  -- than mutates — and of the repository, which refuses a write whose trail is
  -- shorter than the row's.
  "timeline" jsonb NOT NULL,
  "expires_at" timestamp(3) with time zone NOT NULL,
  /*
    THE MARKER THE SWEEP REFUSES TO CROSS, and a REASON rather than a boolean:
    "why is this eleven-month-old record still here" is the question a hold has
    to be able to answer. Written for every S4 record and every abuse disclosure
    (doc 31 §4.1) and never cleared by any code path in this repository —
    releasing a hold is a decision for counsel, taken outside the code.
  */
  "legal_hold" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- Payload models a `hasMany: true` text field as a side table. Bunny object ids
-- (doc 29's token-auth class) — ids and never URLs, so the link is minted at
-- read time under permission rather than stored.
CREATE TABLE IF NOT EXISTS "payload"."incident_reports_texts" (
  "id" serial PRIMARY KEY NOT NULL,
  "order" integer NOT NULL,
  "parent_id" integer NOT NULL,
  "path" varchar NOT NULL,
  "text" varchar
);

DO $$ BEGIN
  ALTER TABLE "payload"."incident_reports"
    ADD CONSTRAINT "incident_reports_incident_id_unique" UNIQUE ("incident_id");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payload"."incident_reports_texts"
    ADD CONSTRAINT "incident_reports_texts_parent_fk"
    FOREIGN KEY ("parent_id") REFERENCES "payload"."incident_reports"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "incident_reports_texts_order_parent"
  ON "payload"."incident_reports_texts" USING btree ("order", "parent_id");

CREATE INDEX IF NOT EXISTS "incident_reports_incident_id_idx"
  ON "payload"."incident_reports" USING btree ("incident_id");
CREATE INDEX IF NOT EXISTS "incident_reports_source_idx"
  ON "payload"."incident_reports" USING btree ("source");
CREATE INDEX IF NOT EXISTS "incident_reports_reporter_auth_id_idx"
  ON "payload"."incident_reports" USING btree ("reporter_auth_id");
CREATE INDEX IF NOT EXISTS "incident_reports_subject_learner_auth_id_idx"
  ON "payload"."incident_reports" USING btree ("subject_learner_auth_id");
CREATE INDEX IF NOT EXISTS "incident_reports_related_session_id_idx"
  ON "payload"."incident_reports" USING btree ("related_session_id");
CREATE INDEX IF NOT EXISTS "incident_reports_related_event_id_idx"
  ON "payload"."incident_reports" USING btree ("related_event_id");
CREATE INDEX IF NOT EXISTS "incident_reports_category_idx"
  ON "payload"."incident_reports" USING btree ("category");
CREATE INDEX IF NOT EXISTS "incident_reports_severity_idx"
  ON "payload"."incident_reports" USING btree ("severity");
CREATE INDEX IF NOT EXISTS "incident_reports_occurred_at_idx"
  ON "payload"."incident_reports" USING btree ("occurred_at");
CREATE INDEX IF NOT EXISTS "incident_reports_status_idx"
  ON "payload"."incident_reports" USING btree ("status");
CREATE INDEX IF NOT EXISTS "incident_reports_assignee_auth_id_idx"
  ON "payload"."incident_reports" USING btree ("assignee_auth_id");
CREATE INDEX IF NOT EXISTS "incident_reports_sla_due_at_idx"
  ON "payload"."incident_reports" USING btree ("sla_due_at");
CREATE INDEX IF NOT EXISTS "incident_reports_guardian_visible_idx"
  ON "payload"."incident_reports" USING btree ("guardian_visible");
CREATE INDEX IF NOT EXISTS "incident_reports_expires_at_idx"
  ON "payload"."incident_reports" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "incident_reports_legal_hold_idx"
  ON "payload"."incident_reports" USING btree ("legal_hold");
CREATE INDEX IF NOT EXISTS "incident_reports_updated_at_idx"
  ON "payload"."incident_reports" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "incident_reports_created_at_idx"
  ON "payload"."incident_reports" USING btree ("created_at");

-- §4.2's guardian read is "these learners, guardian-visible, newest first" and
-- runs on every load of the family's incident list. Partial, so it stays the
-- size of what a parent may actually be shown rather than of every case ever
-- filed — including the tutor-behaviour reports that are deliberately not
-- theirs.
CREATE INDEX IF NOT EXISTS "incident_reports_guardian_feed_idx"
  ON "payload"."incident_reports" USING btree ("subject_learner_auth_id", "occurred_at")
  WHERE "guardian_visible";

-- §5.3's triage queue is "open cases, soonest deadline first", and the SLA
-- countdown is the column it sorts on. Partial on the two statuses that still
-- owe somebody an answer, because a resolved case has no clock.
CREATE INDEX IF NOT EXISTS "incident_reports_sla_queue_idx"
  ON "payload"."incident_reports" USING btree ("sla_due_at")
  WHERE "status" NOT IN ('resolved', 'closed');

-- The sweep's own predicate, so `expires_at < now() AND legal_hold IS NULL`
-- never walks the held rows it is forbidden to touch.
CREATE INDEX IF NOT EXISTS "incident_reports_sweep_idx"
  ON "payload"."incident_reports" USING btree ("expires_at")
  WHERE "legal_hold" IS NULL;

-- Payload's admin lock table needs a column per collection. Nullable, so adding
-- it rewrites no existing row.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "incident_reports_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_incident_reports_fk"
    FOREIGN KEY ("incident_reports_id") REFERENCES "payload"."incident_reports"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_incident_reports_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("incident_reports_id");

-- ── doc 31 §4.3 · the two natural keys the fan-out queues needed ────────────
-- `docs/design/jobs.md` §3 requires two idempotency mechanisms per queue and is
-- explicit they are not interchangeable: the `singletonKey` stops a double
-- ENQUEUE, a natural key makes a second EXECUTION a no-op. These two columns are
-- the second half, and their absence is why `safety.alert.guardian` and
-- `safety.review.enqueue` sat `declared` in the topology — a guardian alert with
-- no durable dedupe tells a parent the same thing twice.
ALTER TABLE "payload"."incident_reports"
  ADD COLUMN IF NOT EXISTS "guardian_notified_at" timestamp(3) with time zone;
ALTER TABLE "payload"."incident_reports"
  ADD COLUMN IF NOT EXISTS "review_paged_at" timestamp(3) with time zone;

CREATE INDEX IF NOT EXISTS "incident_reports_guardian_notified_at_idx"
  ON "payload"."incident_reports" USING btree ("guardian_notified_at");
CREATE INDEX IF NOT EXISTS "incident_reports_review_paged_at_idx"
  ON "payload"."incident_reports" USING btree ("review_paged_at");

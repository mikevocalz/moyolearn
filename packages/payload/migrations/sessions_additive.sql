-- Additive migration for the `sessions` collection (ADR-110's human-tutoring
-- session — doc 01 §7.1's calendar-engine core event).
-- Apply with the Supabase MCP `apply_migration`, name: `sessions_collection`.
--
-- HAND-EXTRACTED, for the reason every sibling records: this repo has no
-- migration baseline, so `payload migrate:create` treats every run as INITIAL,
-- emits every table, dies on the first duplicate and offers a down() that
-- drops the production schema. `PAYLOAD_PUSH` is off for the same reason.
--
-- Everything below is additive and idempotent: two enums, one table, the
-- indexes, one locked-documents column, and the privilege pins. It drops
-- nothing and alters no existing column. NOT the better_auth `session` table —
-- this lives in the payload schema, beside `leads` where doc 28 §2 places it.
-- SOT: docs/decisions/adr-110-sessions-object.md · packages/payload/src/collections/Sessions.ts
-- SOT-KEYWORDS: sessions migration sql additive supabase calendar event human tutoring scheduled tutor edge ops hero my sessions

DO $$ BEGIN
  CREATE TYPE "payload"."enum_sessions_status" AS ENUM ('scheduled', 'completed', 'canceled', 'missed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_sessions_mode" AS ENUM ('virtual', 'in-person');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  -- The org slug the session belongs to, the same string that names the
  -- tenant in better_auth `member.organizationId` and in `ctx.orgId`.
  "org_id" varchar NOT NULL,
  -- The session→tutor edge ADR-108 recorded as missing: a Better Auth user id
  -- as a pointer, never a foreign key (doc 13 §5) — the same convention as
  -- tutor_engagements, consents and incident_reports.
  "tutor_auth_id" varchar NOT NULL,
  -- Display text plus an optional identity-doc pointer, the Leads precedent:
  -- the CRM side never joins into learner identity (doc 28 §2's LearnerRef).
  "learner" varchar NOT NULL,
  "learner_ref" varchar,
  "subject" varchar,
  "scheduled_at" timestamp(3) with time zone NOT NULL,
  "ends_at" timestamp(3) with time zone NOT NULL,
  "status" "payload"."enum_sessions_status" DEFAULT 'scheduled' NOT NULL,
  -- Doc 10 §2.3's lowercase literals; the union's carriers are nullable here
  -- and narrowed in the read model.
  "mode" "payload"."enum_sessions_mode" DEFAULT 'virtual' NOT NULL,
  "join_url" varchar,
  "room" varchar,
  "needs_attention" boolean DEFAULT false,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "sessions_org_id_idx"
  ON "payload"."sessions" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "sessions_tutor_auth_id_idx"
  ON "payload"."sessions" USING btree ("tutor_auth_id");
CREATE INDEX IF NOT EXISTS "sessions_scheduled_at_idx"
  ON "payload"."sessions" USING btree ("scheduled_at");
CREATE INDEX IF NOT EXISTS "sessions_ends_at_idx"
  ON "payload"."sessions" USING btree ("ends_at");
CREATE INDEX IF NOT EXISTS "sessions_status_idx"
  ON "payload"."sessions" USING btree ("status");
CREATE INDEX IF NOT EXISTS "sessions_updated_at_idx"
  ON "payload"."sessions" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "sessions_created_at_idx"
  ON "payload"."sessions" USING btree ("created_at");

-- The two real access paths, as composites (Sessions.ts `indexes`): the ops
-- hero reads "this org, inside a window, in start order"; the incident scope
-- reads "this tutor's sessions".
CREATE INDEX IF NOT EXISTS "sessions_org_id_scheduled_at_idx"
  ON "payload"."sessions" USING btree ("org_id", "scheduled_at");
CREATE INDEX IF NOT EXISTS "sessions_tutor_auth_id_scheduled_at_idx"
  ON "payload"."sessions" USING btree ("tutor_auth_id", "scheduled_at");

-- The locked-documents column every registered collection carries. Payload's
-- `checkDocumentLockStatus` selects every collection's rels column in one
-- query, so a single missing column fails updates for ALL collections — the
-- outage handoff_codes_additive.sql documents.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "sessions_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk"
    FOREIGN KEY ("sessions_id") REFERENCES "payload"."sessions"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sessions_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("sessions_id");

-- Privileges, pinned as the siblings pin theirs: a calendar of which child
-- meets which tutor when should not depend on a default set in a different
-- migration to keep the anon key away from it.
REVOKE ALL ON TABLE "payload"."sessions" FROM anon, authenticated;

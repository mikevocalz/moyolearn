-- Additive migration for the `tutorEngagements` collection (ADR-108's
-- tutor↔learner roster edge).
-- Apply with the Supabase MCP `apply_migration`, name: `tutor_engagements_collection`.
--
-- HAND-EXTRACTED, for the reason every sibling records: this repo has no
-- migration baseline, so `payload migrate:create` treats every run as INITIAL,
-- emits every table, dies on the first duplicate and offers a down() that
-- drops the production schema. `PAYLOAD_PUSH` is off for the same reason.
--
-- Everything below is additive and idempotent: one enum, one table, one unique
-- constraint, the indexes, one locked-documents column, and the privilege
-- pins. It drops nothing and alters no existing column.
-- SOT: docs/decisions/adr-108-tutor-learner-edge.md · packages/payload/src/collections/TutorEngagements.ts
-- SOT-KEYWORDS: tutor engagements migration sql additive supabase roster edge learner org active ended intake subject verification

DO $$ BEGIN
  CREATE TYPE "payload"."enum_tutor_engagements_status" AS ENUM ('active', 'ended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."tutor_engagements" (
  "id" serial PRIMARY KEY NOT NULL,
  -- Better Auth user ids as pointers, never foreign keys — the same convention
  -- as consents, guardianships, tutor_sessions and incident_reports (doc 13
  -- §5): learner data never joins itself to an auth row.
  "tutor_auth_id" varchar NOT NULL,
  "learner_auth_id" varchar NOT NULL,
  -- The org slug the engagement is held in, the same string that names the
  -- tenant in better_auth `member.organizationId` and in `ctx.orgId`.
  "org_id" varchar NOT NULL,
  -- `ended`, never deleted: an ended engagement still explains why a past
  -- incident's subject was once verifiable.
  "status" "payload"."enum_tutor_engagements_status" DEFAULT 'active' NOT NULL,
  "started_at" timestamp(3) with time zone NOT NULL,
  "ended_at" timestamp(3) with time zone,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- One row per (tutor, learner, org) — the DECISION, not just a guard (ADR-108).
-- The row is the edge's current state rather than its history: a re-engagement
-- flips `status` back to `active` instead of appending a second row, so "is
-- this tutor engaged with this learner" stays a one-row question — a safety
-- check reads it, and two live rows for one pair would make the answer a
-- query-plan accident. Both exception handlers, as handoff_codes_additive.sql
-- learned: a duplicate UNIQUE surfaces as 42P07 `duplicate_table` (the backing
-- index), not `duplicate_object`.
DO $$ BEGIN
  ALTER TABLE "payload"."tutor_engagements"
    ADD CONSTRAINT "tutor_engagements_tutor_learner_org_unique"
    UNIQUE ("tutor_auth_id", "learner_auth_id", "org_id");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "tutor_engagements_tutor_auth_id_idx"
  ON "payload"."tutor_engagements" USING btree ("tutor_auth_id");
CREATE INDEX IF NOT EXISTS "tutor_engagements_learner_auth_id_idx"
  ON "payload"."tutor_engagements" USING btree ("learner_auth_id");
CREATE INDEX IF NOT EXISTS "tutor_engagements_org_id_idx"
  ON "payload"."tutor_engagements" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "tutor_engagements_status_idx"
  ON "payload"."tutor_engagements" USING btree ("status");
CREATE INDEX IF NOT EXISTS "tutor_engagements_updated_at_idx"
  ON "payload"."tutor_engagements" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "tutor_engagements_created_at_idx"
  ON "payload"."tutor_engagements" USING btree ("created_at");

-- The intake verification and the future My-learners read are both "this
-- tutor's ACTIVE engagements". Partial, so the roster read stays the size of
-- the living roster rather than of every engagement ever ended.
CREATE INDEX IF NOT EXISTS "tutor_engagements_roster_idx"
  ON "payload"."tutor_engagements" USING btree ("tutor_auth_id")
  WHERE "status" = 'active';

-- The locked-documents column every registered collection carries. Payload's
-- `checkDocumentLockStatus` selects every collection's rels column in one
-- query, so a single missing column fails updates for ALL collections — the
-- outage handoff_codes_additive.sql documents.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "tutor_engagements_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_tutor_engagements_fk"
    FOREIGN KEY ("tutor_engagements_id") REFERENCES "payload"."tutor_engagements"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tutor_engagements_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("tutor_engagements_id");

-- Privileges, pinned as the siblings pin theirs: a roster of which tutor works
-- with which child should not depend on a default set in a different migration
-- to keep the anon key away from it.
REVOKE ALL ON TABLE "payload"."tutor_engagements" FROM anon, authenticated;

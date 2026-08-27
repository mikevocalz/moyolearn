-- Additive migration for doc 34 §3 — the `sessionSummaries` collection.
-- Applied with the Supabase MCP `apply_migration`, name: `session_summaries_collection`.
--
-- HAND-EXTRACTED, for the reason every *_additive.sql beside it records: this
-- repo has no migration baseline, so `payload migrate:create` treats every run
-- as INITIAL, emits every table, dies on the first `CREATE TABLE "users"` and
-- offers a down() that drops the production schema. `PAYLOAD_PUSH` is off for
-- the same reason.
--
-- Everything below is additive and idempotent: three enums, one table, one
-- unique constraint, the indexes. It drops nothing and rewrites nothing.
--
-- THE ONE NON-OBVIOUS PIECE IS THE COLUMN THAT ISN'T HERE. There is NO
-- `expires_at` on this table, and that absence is doc 34 §3's retention class:
-- summaries are the durable record of learning and may OUTLIVE transcripts.
-- `packages/payload/src/retention/sweep.sql` deletes on `expires_at` predicates
-- and therefore cannot touch this table by construction — the only deleter is
-- the guardian's S27 erasure cascade, which removes rows by `learner_auth_id`
-- (`packages/student-model/src/erasure.ts`, proved by
-- `erasure.integration.test.mjs`). `suppressed` status is the takedown path and
-- keeps the row.
-- SOT: docs/pack/34-session-summary-reports.md §3 · packages/payload/src/collections/SessionSummaries.ts
-- SOT-KEYWORDS: session summaries migration sql additive supabase eight blocks retention class no expires guardian erasure teacher share token hash

DO $$ BEGIN
  CREATE TYPE "payload"."enum_session_summaries_session_kind"
    AS ENUM ('ai-tutor', 'human-tutor', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_session_summaries_band"
    AS ENUM ('k-2', '3-5', '6-8', '9-12');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "payload"."enum_session_summaries_status"
    AS ENUM ('generating', 'draft', 'published', 'suppressed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "payload"."session_summaries" (
  "id" serial PRIMARY KEY NOT NULL,
  -- THE NATURAL KEY: one session, one summary. Unique, so a pg-boss retry or a
  -- dead-letter replay regenerating the same session collides here instead of
  -- putting two reports about one session in front of a parent.
  "session_id" varchar NOT NULL,
  -- Pointer to Better Auth, never a foreign key (doc 13 §5) — and the summary
  -- may outlive every other row about the session, so it joins nothing.
  "learner_auth_id" varchar NOT NULL,
  "session_kind" "payload"."enum_session_summaries_session_kind" DEFAULT 'ai-tutor' NOT NULL,
  "band" "payload"."enum_session_summaries_band" NOT NULL,
  -- ── Doc 34 §2's eight blocks, fixed order, as columns ──────────────────────
  "headline" varchar NOT NULL,
  -- WorkedOnSkill[]: { skillId, parentLabel, whyItMatters }
  "worked_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- ProblemRow[] — deterministic from session events, never generated. The
  -- questionRef is an id (capture crop) or the problem text; the crop URL is
  -- minted at read time under permission (doc 29 §5), never stored.
  "problems" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- MasteryMovement[]: movement and position, two axes never conflated (§2.4).
  "mastery" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- { copy, evidenceRef } | NULL — omitted when no event evidences it (§2.5).
  "effort_moment" jsonb,
  "next_up" varchar NOT NULL,
  -- { conversationStarter, activity } — exactly two items, by shape (§2.7).
  "home_support" jsonb NOT NULL,
  -- { durationMin, attempted, solvedIndependently, solvedWithHelp } (§2.8).
  "facts" jsonb NOT NULL,
  -- EvidenceRef[]: { kind: 'message'|'event'|'problem', id }. Ids only; the
  -- render degrades to "source expired" when the transcript TTLs out.
  "evidence_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  -- { model, promptVersion, schemaVersion } — auditable provenance (§3).
  "generator" jsonb NOT NULL,
  "safety_screened" boolean DEFAULT false NOT NULL,
  -- Human-tutor path: the AI drafts, the human owns (§4 step 5).
  "tutor_draft" varchar,
  "tutor_approved_by_auth_id" varchar,
  "status" "payload"."enum_session_summaries_status" DEFAULT 'generating' NOT NULL,
  "published_at" timestamp(3) with time zone,
  -- The visibility loop — viewed-rate, not sent-rate, is the honest metric (§5).
  "guardian_viewed_at" timestamp(3) with time zone,
  -- Logged suppression, never silent deletion (§3).
  "suppression_reason" varchar,
  "suppressed_at" timestamp(3) with time zone,
  -- { enabled, tokenHash, expiresAt, revokedAt } | NULL. A HASH, never the
  -- token — a stored URL is a token in a database.
  "teacher_share" jsonb,
  "digest_batch_id" varchar,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "payload"."session_summaries"
    ADD CONSTRAINT "session_summaries_session_id_unique" UNIQUE ("session_id");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "session_summaries_session_id_idx"
  ON "payload"."session_summaries" USING btree ("session_id");
CREATE INDEX IF NOT EXISTS "session_summaries_learner_auth_id_idx"
  ON "payload"."session_summaries" USING btree ("learner_auth_id");
CREATE INDEX IF NOT EXISTS "session_summaries_status_idx"
  ON "payload"."session_summaries" USING btree ("status");
CREATE INDEX IF NOT EXISTS "session_summaries_tutor_approved_by_auth_id_idx"
  ON "payload"."session_summaries" USING btree ("tutor_approved_by_auth_id");
CREATE INDEX IF NOT EXISTS "session_summaries_digest_batch_id_idx"
  ON "payload"."session_summaries" USING btree ("digest_batch_id");
CREATE INDEX IF NOT EXISTS "session_summaries_updated_at_idx"
  ON "payload"."session_summaries" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "session_summaries_created_at_idx"
  ON "payload"."session_summaries" USING btree ("created_at");

-- The guardian read is "these learners' published reports, newest first" and
-- runs on every open of the family feed. Partial on `published`, so the index
-- stays the size of what a parent may actually be shown — drafts a tutor still
-- owns and suppressed rows are deliberately not in it.
CREATE INDEX IF NOT EXISTS "session_summaries_guardian_feed_idx"
  ON "payload"."session_summaries" USING btree ("learner_auth_id", "published_at" DESC)
  WHERE "status" = 'published';

-- The tutor draft queue (§5, doc 28 DataTable): org-side review of human/hybrid
-- session drafts, oldest first so nothing rots at the bottom.
CREATE INDEX IF NOT EXISTS "session_summaries_draft_queue_idx"
  ON "payload"."session_summaries" USING btree ("created_at")
  WHERE "status" = 'draft';

-- Payload's admin lock table learns the collection, as every collection's
-- migration does — without it the admin panel cannot hold an edit lock on a row.
ALTER TABLE "payload"."payload_locked_documents_rels"
  ADD COLUMN IF NOT EXISTS "session_summaries_id" integer;

DO $$ BEGIN
  ALTER TABLE "payload"."payload_locked_documents_rels"
    ADD CONSTRAINT "payload_locked_documents_rels_session_summaries_fk"
    FOREIGN KEY ("session_summaries_id") REFERENCES "payload"."session_summaries"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_session_summaries_id_idx"
  ON "payload"."payload_locked_documents_rels" USING btree ("session_summaries_id");

-- The CUTOVER backfill: the tutoring path's existing rows, moved into the
-- educational store. Apply with the Supabase MCP `apply_migration`, name:
-- `edu_backfill_from_payload`. Requires `edu_schema` first.
--
-- Doc 12 §4 put the educational store in `edu`, `edu_schema.sql` built it, and
-- `check-store-separation.mjs` gated it — and it held zero rows, because
-- `student-model.repository.ts` still wrote `payload.session_transcripts` and
-- `payload.student_model_facts`. A separation with no rows on the far side is a
-- diagram. This file is the half of the cutover the code cannot do: the write
-- path changing where it lands does nothing for the transcripts and beliefs a
-- child already has.
--
-- COPIES, does not move. Nothing is deleted here, and the `payload` collections
-- are deliberately left in place — see the note at the foot of this file for
-- why, and for what ends them.
--
-- Idempotent by primary key: `ON CONFLICT DO NOTHING` on both tables, so a
-- re-run after a partial failure resumes rather than duplicating, and a re-run
-- after success is a no-op. It never UPDATES an `edu` row, because after cutover
-- `edu` is authoritative — a second application must not be able to overwrite a
-- live belief with the stale `payload` copy it was seeded from.
-- SOT: docs/pack/12-systems-design-prompt.md §3 §4 · packages/payload/migrations/edu_schema.sql · apps/web/lib/edu.repository.ts
-- SOT-KEYWORDS: edu backfill cutover migration transcripts knowledge graph payload copy idempotent provenance separation

-- ---------------------------------------------------------------------------
-- edu.transcripts ← payload.session_transcripts
--
-- Every column maps one to one; the only judgement is `turns`, which is NOT NULL
-- on both sides but is coalesced anyway. `transcripts_turns_shape` accepts an
-- empty array and rejects a null, so an unexpectedly null document becomes an
-- empty transcript rather than aborting the backfill for all 42 rows.
--
-- `distilled_at`, `created_at` and `updated_at` have no destination and are not
-- given one. They are Payload bookkeeping about a row, not facts about a child,
-- and doc 12 §4's educational store carries the second kind only.
-- ---------------------------------------------------------------------------
INSERT INTO "edu"."transcripts" (
  "session_id", "learner_id", "captured_at", "expires_at", "turns"
)
SELECT
  s."session_id",
  s."learner_auth_id",
  s."captured_at",
  s."expires_at",
  COALESCE(s."turns", '[]'::jsonb)
FROM "payload"."session_transcripts" s
WHERE s."session_id" IS NOT NULL
  AND s."learner_auth_id" IS NOT NULL
ON CONFLICT ("session_id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- edu.knowledge_graph ← payload.student_model_facts (+ its `_texts` side table)
--
-- This is the lossy direction, and every loss is deliberate.
--
--   `sentence` is DROPPED. `edu.knowledge_graph` has no column for it because
--   `facts.ts` builds it deterministically from the structured values, and
--   `edu.repository.ts:factFromRow` rebuilds it by calling the same constructor.
--   Carrying the old string across would create a second, editable copy of prose
--   about a child — the exact thing the schema is shaped to make impossible.
--
--   `detail->>'strategy'` is DROPPED. A misconception's strategy is a constant
--   of the curated `MISCONCEPTIONS` taxonomy keyed by `tag`; it is curriculum
--   content, not learner data, and `edu_schema.sql` says so at length.
--
--   `skill_id` (the integer relationship to the skills collection) is DROPPED
--   and is NOT the source of `edu`'s `skill_id`. The two are unrelated: Payload's
--   is a row pointer, `edu`'s is the curriculum label the distiller keys on,
--   which lives in `detail->>'skillId'`.
--
-- The one INFERENCE, stated rather than hidden: `skill_title` for a scaffolding
-- fact. `scaffoldingFact` takes `skillTitle`, spends it on the sentence and does
-- not put it on `ScaffoldingFact`, so `detail` never held it — while
-- `knowledge_graph_variant_shape` requires it. It is resolved as
-- `skillTitle ?? skillId`, which is exact for every row this product has
-- produced (`tutor.service.ts` sets `skillId: skillTitle` from the same
-- `inferSkillTitle` call) and is the same fallback the live write path uses
-- when a batch carries no titled fact for the skill. Never invented: a row
-- whose `detail` has neither key would fail `edu.label` and abort the insert,
-- which is the correct outcome for a fact nobody can name.
--
-- Rows with EMPTY provenance are skipped, not force-fed a placeholder.
-- `knowledge_graph_has_provenance` exists because `erasure.ts` deletes a fact
-- left with no source rather than keeping it as an orphan belief; a `payload`
-- fact that already has none is that orphan, and copying it into the store that
-- forbids it would be laundering it. (There are none today — the count is
-- reported by the assertion at the foot of this file.)
-- ---------------------------------------------------------------------------
INSERT INTO "edu"."knowledge_graph" (
  "fact_id", "learner_id", "kind",
  "skill_id", "skill_title", "tag", "p", "attempts",
  "due_at", "interval_days", "hint_depth", "active", "guardian_approved",
  "derived_from", "observed_at", "expires_at"
)
SELECT
  f."fact_id",
  f."learner_auth_id",
  f."kind"::text::"edu"."fact_kind",

  CASE WHEN f."kind"::text IN ('mastery', 'review', 'scaffolding', 'misconception')
       THEN f."detail" ->> 'skillId' END,
  CASE WHEN f."kind"::text IN ('mastery', 'review', 'scaffolding')
       THEN COALESCE(NULLIF(f."detail" ->> 'skillTitle', ''), f."detail" ->> 'skillId') END,
  CASE WHEN f."kind"::text IN ('misconception', 'interest')
       THEN f."detail" ->> 'tag' END,
  CASE WHEN f."kind"::text = 'mastery'     THEN (f."detail" ->> 'p')::numeric(4,3) END,
  CASE WHEN f."kind"::text = 'mastery'     THEN (f."detail" ->> 'attempts')::integer END,
  CASE WHEN f."kind"::text = 'review'      THEN (f."detail" ->> 'dueAt')::timestamptz END,
  CASE WHEN f."kind"::text = 'review'      THEN (f."detail" ->> 'intervalDays')::integer END,
  CASE WHEN f."kind"::text = 'scaffolding' THEN (f."detail" ->> 'hintDepth')::numeric(5,2) END,
  CASE WHEN f."kind"::text = 'misconception' THEN (f."detail" ->> 'active')::boolean END,
  CASE WHEN f."kind"::text = 'interest'    THEN (f."detail" ->> 'guardianApproved')::boolean END,

  prov."derived_from"::"edu"."opaque_id"[],
  f."observed_at",
  f."expires_at"
FROM "payload"."student_model_facts" f
/*
  LATERAL rather than a GROUP BY over a join: `derivedFrom` is an ordered
  `_texts` side table, and aggregating it per fact in a subquery keeps the outer
  row count equal to the fact count — a fact with no provenance rows still
  produces one row here, so the WHERE below can reject it explicitly instead of
  it vanishing into an inner join and being "migrated" by not existing.
*/
CROSS JOIN LATERAL (
  SELECT COALESCE(
           array_agg(t."text" ORDER BY t."order") FILTER (WHERE t."text" IS NOT NULL),
           '{}'::text[]
         ) AS "derived_from"
    FROM "payload"."student_model_facts_texts" t
   WHERE t."parent_id" = f."id" AND t."path" = 'derivedFrom'
) prov
WHERE f."learner_auth_id" IS NOT NULL
  AND cardinality(prov."derived_from") > 0
ON CONFLICT ("fact_id") DO NOTHING;

-- ---------------------------------------------------------------------------
-- The reconciliation, run inside the migration rather than trusted to a human
-- re-reading two counts in a terminal.
--
-- It asserts the only property that matters: every source row that COULD be
-- migrated now exists in `edu`. It is not `count(payload) = count(edu)` — `edu`
-- may legitimately hold more, because after cutover the live write path lands
-- there and `payload` stops growing.
--
-- An orphan-provenance fact is reported as a NOTICE, not raised: it is a row the
-- educational store correctly refuses, and the sweep in `payload` will remove it
-- on its own schedule. Failing the migration over one would block the cutover on
-- a row that is already scheduled for deletion.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing_transcripts bigint;
  missing_facts       bigint;
  orphan_facts        bigint;
BEGIN
  SELECT count(*) INTO missing_transcripts
    FROM "payload"."session_transcripts" s
   WHERE s."session_id" IS NOT NULL
     AND s."learner_auth_id" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM "edu"."transcripts" e WHERE e."session_id" = s."session_id"
     );

  SELECT
    count(*) FILTER (WHERE prov.n > 0 AND NOT migrated),
    count(*) FILTER (WHERE prov.n = 0)
    INTO missing_facts, orphan_facts
    FROM "payload"."student_model_facts" f
    CROSS JOIN LATERAL (
      SELECT count(*) AS n
        FROM "payload"."student_model_facts_texts" t
       WHERE t."parent_id" = f."id" AND t."path" = 'derivedFrom' AND t."text" IS NOT NULL
    ) prov
    CROSS JOIN LATERAL (
      SELECT EXISTS (
        SELECT 1 FROM "edu"."knowledge_graph" k WHERE k."fact_id" = f."fact_id"
      ) AS migrated
    ) m
   WHERE f."learner_auth_id" IS NOT NULL;

  IF missing_transcripts > 0 OR missing_facts > 0 THEN
    RAISE EXCEPTION
      'edu backfill incomplete: % transcript(s) and % fact(s) in payload have no row in edu. The cutover must not proceed on a partial copy.',
      missing_transcripts, missing_facts;
  END IF;

  IF orphan_facts > 0 THEN
    RAISE NOTICE
      'edu backfill left % payload fact(s) behind: they carry no provenance, which knowledge_graph_has_provenance forbids. erasure.ts deletes such a fact rather than keeping it as an orphan belief.',
      orphan_facts;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- WHAT HAPPENS TO THE `payload` COLLECTIONS — decided here, not left open.
--
-- They STAY, and nothing in this file drops them. Three reasons, in order:
--
--   1. This migration is the rollback. Reverting the write path is one import
--      change, and it is only a rollback if the rows it reads are still there.
--      Dropping the source in the same change that starts writing elsewhere
--      leaves no way back that does not involve a restore.
--   2. They drain themselves. `sessionTranscripts` and `studentModelFacts` are
--      still swept by `apps/web/app/api/retention/sweep` through
--      `retention.repository.ts`, so the copies age out on the published 30/400
--      day windows exactly as they would have. Retention does not depend on
--      anyone remembering to finish this.
--   3. Dropping a Payload collection is not a `DROP TABLE`. It is a config
--      change plus its `_v` shadow tables plus its `_texts` side tables, and
--      doing that through hand-written SQL is how a schema and a config stop
--      agreeing.
--
-- What ends them: the day the swept counts for both collections have been zero
-- for a full transcript window and nothing reads them, the collections come out
-- of `payload.config.ts` and Payload drops the tables. Until then they hold a
-- copy of rows that ALSO exist in `edu`, which is duplication with a purpose and
-- a stated end, not an accident.
-- ---------------------------------------------------------------------------

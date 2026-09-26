-- The row that authorizes a grade. Apply with the Supabase MCP `apply_migration`,
-- name: `edu_questions`.
--
-- WHY THIS TABLE EXISTS. `tutor.service.ts` has held a `withCurrentEvidence`
-- port since the assessment gate was written, and no production repository
-- implemented it — so `/api/tutor/evaluate` could not grade anything at all,
-- because the only alternative was a client saying "this source is verified",
-- and a client saying that is a claim rather than a fact. This is the server's
-- copy of what it asked the child, held for the write that grades the answer.
--
-- NO PROBLEM TEXT. Doc 12 §4 and the standing assertion at the foot of
-- `edu_schema.sql` keep raw strings out of the educational store, and a question
-- a child is working on is exactly such a string. `problem_digest` is
-- `tutor.service.ts:problemDigest` — SHA-256, hex — which answers the only
-- question the grader asks ("is this the problem you were issued") without the
-- store holding the homework.
--
-- Additive and idempotent: one table, plus two nullable columns on
-- `edu.transcripts` that record which revision a graded turn was bound to.
-- SOT: packages/app/features/tutor/tutor.service.ts · docs/pack/12-systems-design-prompt.md §3 §4 · docs/pack/19-learning-outcomes-spec.md §3 · packages/payload/migrations/edu_schema.sql
-- SOT-KEYWORDS: edu questions evidence revision grading assessment authorize current revision digest migration additive supabase separation

-- ---------------------------------------------------------------------------
-- edu.questions — one row per issued question, holding its CURRENT revision.
--
-- The revision lives on the question rather than in a history table because the
-- grader's question is "is this the revision that is current NOW", and a row
-- per revision would make that a `max()` over a set — a query that races with
-- the re-issue it is supposed to lose to. Re-issuing UPDATES this row, so a
-- turn quoting the previous revision has nothing to match and cannot grade,
-- which is the whole guarantee.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "edu"."questions" (
  "question_id" "edu"."opaque_id" PRIMARY KEY,

  -- The owner. Every read is `where question_id = $1 and learner_id = $2`: a
  -- learner naming someone else's question gets an empty result, which the
  -- service reads as "no evidence", which is an ungraded turn. There is no code
  -- path where the id alone is sufficient — the same posture as
  -- `tutor-session.repository.ts`.
  "learner_id" "edu"."opaque_id" NOT NULL,

  -- Null for a learner with no organization, which is a real state (a family
  -- account) and not a missing value. It is compared, not defaulted: a question
  -- issued inside a district cannot be graded outside it.
  "org_id" "edu"."opaque_id",

  "revision" "edu"."opaque_id" NOT NULL,

  -- SHA-256 of the issued problem, hex. `opaque_id` already forbids control
  -- characters and anything longer than 128; the CHECK pins it to the exact
  -- shape of a digest so a caller cannot store the problem itself here by
  -- writing it into a column whose name says otherwise.
  "problem_digest" "edu"."opaque_id" NOT NULL,
  CONSTRAINT "questions_digest_shape" CHECK ("problem_digest" ~ '^[0-9a-f]{64}$'),

  -- Whether the SERVER believes this question is answerable and gradable —
  -- false while a source is still being read or a review is outstanding. A
  -- photographed page whose text nobody has confirmed is issued unready, so it
  -- coaches and never grades.
  "evaluation_ready" boolean NOT NULL,

  "issued_at"  timestamp(3) with time zone NOT NULL,
  "expires_at" timestamp(3) with time zone NOT NULL,

  -- A question is gradable for a week and then it is not. The window is a
  -- constraint rather than a default for the reason `transcripts_ttl_window`
  -- gives: no writer gets to quietly grant itself a longer one. Eight days
  -- rather than seven on the upper bound because `addDays` is exact
  -- milliseconds and `interval '7 days'` is DST-aware, and this constraint's job
  -- is to stop a writer asking for a year, not to unit-test arithmetic.
  CONSTRAINT "questions_gradable_window" CHECK (
    "expires_at" > "issued_at" AND "expires_at" <= "issued_at" + interval '8 days'
  )
);

-- The sweep's predicate, and the erasure cascade's. The primary key serves the
-- grader's lookup; neither `expires_at` nor `learner_id` leads it.
CREATE INDEX IF NOT EXISTS "questions_expires_at_idx" ON "edu"."questions" ("expires_at");
CREATE INDEX IF NOT EXISTS "questions_learner_id_idx" ON "edu"."questions" ("learner_id");

-- ---------------------------------------------------------------------------
-- edu.transcripts — which revision authorized the grade.
--
-- Nullable because every row written before this migration was graded by
-- nothing, and backfilling an id there would be inventing the evidence this
-- whole change exists to require. Null means "not bound to a server revision",
-- which is the truth about those rows.
--
-- No foreign key, deliberately. The expiry sweep deletes questions on a
-- published seven-day window while a transcript lives for thirty, so a FK would
-- force a choice between deleting the child's turn early and blanking the audit
-- link on a live one. The pair is a record of what happened, not a join.
-- ---------------------------------------------------------------------------
ALTER TABLE "edu"."transcripts" ADD COLUMN IF NOT EXISTS "question_id" "edu"."opaque_id";
ALTER TABLE "edu"."transcripts" ADD COLUMN IF NOT EXISTS "revision" "edu"."opaque_id";

-- ---------------------------------------------------------------------------
-- Privileges, restated for the same reason `edu_blocked_tags.sql` restates
-- them: a migration that only works when another one ran first silently grants
-- when replayed against a fresh database.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE "edu"."questions" FROM anon, authenticated;
ALTER TABLE "edu"."questions" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- The standing assertion, re-run — the proof that this table did not open the
-- hole `edu_schema.sql` exists to close. Every column here is a domain, a
-- boolean or a timestamp; none is a bare string.
-- ---------------------------------------------------------------------------
DO $$
DECLARE offenders text;
BEGIN
  SELECT string_agg(format('%I.%I (%s)', c.relname, a.attname,
                           format_type(a.atttypid, a.atttypmod)), ', ')
    INTO offenders
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'edu'
     AND c.relkind = 'r'
     AND a.attnum > 0
     AND NOT a.attisdropped
     AND a.atttypid IN ('text'::regtype, 'varchar'::regtype,
                        'json'::regtype, 'jsonb'::regtype)
     AND NOT (c.relname = 'transcripts' AND a.attname = 'turns');

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION
      'edu schema holds an unconstrained string or JSON column: %. Doc 12 §4: derived facts, never raw text. Use edu.opaque_id, edu.tag, edu.label or edu.fact_key.',
      offenders;
  END IF;
END $$;

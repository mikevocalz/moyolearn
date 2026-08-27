-- The EDUCATIONAL store, doc 12 §4: its own `edu` schema in the same Postgres.
-- Apply with the Supabase MCP `apply_migration`, name: `edu_schema`.
--
-- HAND-WRITTEN, and NOT reachable by `payload migrate` at all — no Payload
-- collection maps to these tables. Doc 12 §11.3 splits the two paths on purpose:
-- DDL goes through `apply_migration`, reads go through the `pg` driver. Payload
-- owns the `payload` schema and nothing else.
--
-- Doc 12 §3 puts the three-store separation in the repository layer plus a build
-- check rather than in three databases. That is a policy, and a policy on its own
-- decays. Everything below is the half that cannot decay: types, constraints and
-- privileges that make the wrong row unrepresentable rather than merely
-- discouraged. The build check is `tooling/check-store-separation.mjs`.
--
-- Additive and idempotent throughout: one schema, four domains, one enum, two
-- tables, indexes. It drops nothing and alters nothing that already exists.
-- SOT: docs/pack/12-systems-design-prompt.md §3 §4 · docs/pack/07-security-child-ai-safety-spec.md §4 · packages/student-model/src/facts.ts · packages/student-model/src/distill.ts
-- SOT-KEYWORDS: edu schema educational store transcripts knowledge graph derived facts provenance ttl migration additive supabase separation

CREATE SCHEMA IF NOT EXISTS "edu";

-- ---------------------------------------------------------------------------
-- Domains, not `text`.
--
-- A CHECK on a column is a decision about that column; a DOMAIN is a decision
-- about the TYPE, so it travels to the next column somebody adds. This schema
-- deliberately has no bare `text` or `varchar` column at all, which is what
-- turns doc 12 §4's "never raw text" from a sentence in a spec into something
-- the database refuses. The DO-block assertion at the foot of this file is what
-- keeps that true after the next ALTER.
-- ---------------------------------------------------------------------------

-- Machine handles: auth ids, session uuids, content ids, model ids. No spaces,
-- so this type cannot hold a phrase, let alone an utterance.
DO $$ BEGIN
  CREATE DOMAIN "edu"."opaque_id" AS text
    CHECK (VALUE ~ '^[A-Za-z0-9._:-]{1,128}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- `packages/student-model/src/distill.ts:factId` — `learnerId:kind:subject`.
-- Spaces are allowed here and ONLY here, because the subject half is a curriculum
-- label and live rows already read `dev-learner-1:scaffolding:Order of operations`.
-- Sentence punctuation is not: a key is an address, and an address has no `?`.
DO $$ BEGIN
  CREATE DOMAIN "edu"."fact_key" AS text
    CHECK (VALUE ~ '^[^[:cntrl:]]{1,160}$' AND VALUE !~ '[.?!]');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Curated taxonomy tags — misconceptions and guardian-approved interests.
-- A slug, lowercase, hyphenated, 48 characters. `facts.ts` says a tag the
-- taxonomy does not know "is a model writing prose about a child"; this is the
-- shape that cannot BE prose.
DO $$ BEGIN
  CREATE DOMAIN "edu"."tag" AS text
    CHECK (VALUE ~ '^[a-z0-9][a-z0-9-]{0,47}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Curriculum labels: a skill's id and its human title. 48 characters, no control
-- characters, no sentence-terminal punctuation. A skill is named, never narrated.
DO $$ BEGIN
  CREATE DOMAIN "edu"."label" AS text
    CHECK (VALUE ~ '^[^[:cntrl:]]{1,48}$' AND VALUE !~ '[.?!]');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- `packages/student-model/src/facts.ts:FactKind`, one variant per thing tracked.
DO $$ BEGIN
  CREATE TYPE "edu"."fact_kind" AS ENUM(
    'mastery', 'misconception', 'review', 'interest', 'scaffolding'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- edu.transcripts — `packages/student-model/src/distill.ts:SessionTranscript`
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "edu"."transcripts" (
  -- `SessionTranscript.id`. The session's own handle is the primary key rather
  -- than a surrogate serial, because that id is what distillation writes into a
  -- fact's provenance — the edge the erasure cascade walks. A surrogate would
  -- mean the cascade and the storage disagree about what a transcript is called.
  "session_id"  "edu"."opaque_id" PRIMARY KEY,
  "learner_id"  "edu"."opaque_id" NOT NULL,
  "captured_at" timestamp(3) with time zone NOT NULL,
  "expires_at"  timestamp(3) with time zone NOT NULL,

  -- `readonly SessionTurn[]`. jsonb because the document is always read and
  -- written whole, exactly as `payload.tutor_sessions.messages` is.
  "turns" jsonb NOT NULL,

  -- TRANSCRIPT_TTL_DAYS = 30 (facts.ts), applied by `transcriptExpiry`. The
  -- published window is a promise made to a family, so it is a constraint and
  -- not a default: no writer can quietly grant itself a longer one.
  --
  -- 31 rather than 30 on purpose. `addDays` adds exactly 30 × 86_400_000 ms while
  -- `timestamptz + interval '30 days'` is DST-aware and can be an hour short, so
  -- an exact bound would reject correct rows twice a year. The constraint's job
  -- is to stop a writer asking for a year, not to unit-test `addDays`.
  CONSTRAINT "transcripts_ttl_window" CHECK (
    "expires_at" > "captured_at"
    AND "expires_at" <= "captured_at" + interval '31 days'
  ),

  -- THE KEY WHITELIST. `SessionTurn` is entirely structural — a skill id, a
  -- boolean, a hint count, taxonomy tags, and the Safety Plane's storable
  -- verdict. There is no field on it that holds what the child said, and this
  -- constraint is what stops one appearing: any turn carrying a key the domain
  -- type does not declare is rejected by the database.
  --
  -- Written as a jsonpath predicate because a CHECK may not contain a subquery
  -- or a set-returning function, which rules out the obvious
  -- `jsonb_array_elements` formulation. `@?` is immutable, so it is legal here.
  CONSTRAINT "transcripts_turns_shape" CHECK (
    jsonb_typeof("turns") = 'array'
    AND NOT ("turns" @? '$[*].keyvalue() ? (@.key != "skillId" && @.key != "skillTitle" && @.key != "correct" && @.key != "hintDepth" && @.key != "misconceptionTag" && @.key != "interestTags" && @.key != "storable")')
  )
);

CREATE INDEX IF NOT EXISTS "edu_transcripts_learner_idx"
  ON "edu"."transcripts" USING btree ("learner_id");
-- The sweep's access path and doc 12 §4's "indexed on learner + expiry": the TTL
-- pass reads by expiry alone, a guardian erasure reads by learner then expiry.
CREATE INDEX IF NOT EXISTS "edu_transcripts_expires_at_idx"
  ON "edu"."transcripts" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "edu_transcripts_learner_expires_at_idx"
  ON "edu"."transcripts" USING btree ("learner_id", "expires_at");

-- ---------------------------------------------------------------------------
-- edu.knowledge_graph — `packages/student-model/src/facts.ts:DerivedFact`
--
-- Doc 12 §4: "derived facts … never raw text". Three deliberate absences do that
-- work, and they matter more than any column present:
--
--   1. NO `sentence` COLUMN. `facts.ts` says the sentence is built by the
--      constructor and never at render, and it is built deterministically from
--      the structured values below. Storing it would put a second copy of prose
--      in the row for a reader that can regenerate it exactly; regenerating it
--      through `masteryFact`/`misconceptionFact`/… on the way out keeps ONE
--      author of that sentence and leaves nowhere in this table to put one.
--   2. NO `strategy` COLUMN. A misconception's strategy is a constant of the
--      curated taxonomy (`MISCONCEPTIONS`), keyed by `tag`. It is content, not
--      learner data, and copying it per learner row would be the longest string
--      in the schema for no reason.
--   3. NO `jsonb` DETAIL BLOB. `payload.student_model_facts` has `detail jsonb`,
--      and an untyped blob on a learner row is the escape hatch through which
--      free text eventually arrives. Every variant field is its own typed,
--      domain-constrained column here instead.
--
-- What remains is numbers, booleans, timestamps, one enum, and strings that are
-- structurally incapable of being a sentence.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "edu"."knowledge_graph" (
  -- `distill.ts:factId` — deterministic per learner+kind+subject, so distillation
  -- UPSERTS a current belief instead of appending an observation log.
  "fact_id"    "edu"."fact_key" PRIMARY KEY,
  "learner_id" "edu"."opaque_id" NOT NULL,
  "kind"       "edu"."fact_kind" NOT NULL,

  -- Variant fields. Every one is nullable at the column level and made mandatory
  -- per-kind by `knowledge_graph_variant_shape` below, which is the SQL spelling
  -- of the discriminated union in `facts.ts` — CLAUDE.md §Types: invalid state
  -- combinations must be unrepresentable, not merely unusual.
  --
  -- The columns mirror what each CONSTRUCTOR consumes, which is not always what
  -- its output type keeps. `scaffoldingFact` takes `skillTitle`, spends it on the
  -- sentence and does not put it on `ScaffoldingFact`; a store shaped only to the
  -- output type could therefore never rebuild that fact through the one function
  -- allowed to author its sentence. Storing the input is what makes the row
  -- reconstructible, and it is not a second model — every column here is an
  -- argument some constructor in `facts.ts` already takes.
  "skill_id"          "edu"."label",
  "skill_title"       "edu"."label",
  "tag"               "edu"."tag",
  "p"                 numeric(4,3) CHECK ("p" IS NULL OR ("p" >= 0 AND "p" <= 1)),
  "attempts"          integer      CHECK ("attempts" IS NULL OR "attempts" >= 0),
  "due_at"            timestamp(3) with time zone,
  "interval_days"     integer      CHECK ("interval_days" IS NULL OR "interval_days" > 0),
  "hint_depth"        numeric(5,2) CHECK ("hint_depth" IS NULL OR "hint_depth" >= 0),
  "active"            boolean,
  "guardian_approved" boolean,

  -- `FactProvenance`. An array of transcript ids, GIN-indexed, because the
  -- cascade's question is "which facts name this transcript".
  "derived_from" "edu"."opaque_id"[] NOT NULL,
  "observed_at"  timestamp(3) with time zone NOT NULL,
  "expires_at"   timestamp(3) with time zone NOT NULL,

  -- `erasure.ts`: "A fact left with no provenance is DELETED, never kept as an
  -- orphan." That rule lives in one pure function today and a caller can forget
  -- it. Here the orphan state has no representation — a fact whose last source
  -- is removed cannot be written back, only deleted.
  CONSTRAINT "knowledge_graph_has_provenance" CHECK (cardinality("derived_from") > 0),

  -- FACT_TTL_DAYS = 400 (facts.ts). Same reasoning and same slack as the
  -- transcript window above.
  CONSTRAINT "knowledge_graph_ttl_window" CHECK (
    "expires_at" > "observed_at"
    AND "expires_at" <= "observed_at" + interval '401 days'
  ),

  -- `MISCONCEPTIONS` in `facts.ts` is a closed list, and `isMisconceptionTag`
  -- drops anything else before it can be stored. Closed here too: extending the
  -- taxonomy costs a migration, which is the point of curating it.
  CONSTRAINT "knowledge_graph_misconception_taxonomy" CHECK (
    "kind" <> 'misconception'
    OR "tag" IN (
      'adds-denominators',
      'fraction-as-two-wholes',
      'multiplication-always-grows',
      'equals-means-answer',
      'ignores-place-value'
    )
  ),

  CONSTRAINT "knowledge_graph_variant_shape" CHECK (
    CASE "kind"
      WHEN 'mastery' THEN
        "skill_id" IS NOT NULL AND "skill_title" IS NOT NULL
        AND "p" IS NOT NULL AND "attempts" IS NOT NULL
        AND "tag" IS NULL AND "due_at" IS NULL AND "interval_days" IS NULL
        AND "hint_depth" IS NULL AND "active" IS NULL AND "guardian_approved" IS NULL
      WHEN 'misconception' THEN
        "skill_id" IS NOT NULL AND "tag" IS NOT NULL AND "active" IS NOT NULL
        AND "skill_title" IS NULL AND "p" IS NULL AND "attempts" IS NULL
        AND "due_at" IS NULL AND "interval_days" IS NULL AND "hint_depth" IS NULL
        AND "guardian_approved" IS NULL
      WHEN 'review' THEN
        "skill_id" IS NOT NULL AND "skill_title" IS NOT NULL
        AND "due_at" IS NOT NULL AND "interval_days" IS NOT NULL
        AND "tag" IS NULL AND "p" IS NULL AND "attempts" IS NULL
        AND "hint_depth" IS NULL AND "active" IS NULL AND "guardian_approved" IS NULL
      WHEN 'interest' THEN
        "tag" IS NOT NULL AND "guardian_approved" IS NOT NULL
        AND "skill_id" IS NULL AND "skill_title" IS NULL AND "p" IS NULL
        AND "attempts" IS NULL AND "due_at" IS NULL AND "interval_days" IS NULL
        AND "hint_depth" IS NULL AND "active" IS NULL
      WHEN 'scaffolding' THEN
        "skill_id" IS NOT NULL AND "skill_title" IS NOT NULL AND "hint_depth" IS NOT NULL
        AND "tag" IS NULL AND "p" IS NULL
        AND "attempts" IS NULL AND "due_at" IS NULL AND "interval_days" IS NULL
        AND "active" IS NULL AND "guardian_approved" IS NULL
    END
  )
);

CREATE INDEX IF NOT EXISTS "edu_knowledge_graph_learner_idx"
  ON "edu"."knowledge_graph" USING btree ("learner_id");
CREATE INDEX IF NOT EXISTS "edu_knowledge_graph_learner_kind_idx"
  ON "edu"."knowledge_graph" USING btree ("learner_id", "kind");
CREATE INDEX IF NOT EXISTS "edu_knowledge_graph_expires_at_idx"
  ON "edu"."knowledge_graph" USING btree ("expires_at");
-- The cascade's only lookup: every fact that names a given transcript.
-- `derived_from && $1` needs GIN; a btree here would be a sequential scan of a
-- child's whole model on every erasure.
CREATE INDEX IF NOT EXISTS "edu_knowledge_graph_derived_from_idx"
  ON "edu"."knowledge_graph" USING gin ("derived_from");
-- The retrieval read that runs on every tutoring turn is "what is due for this
-- learner". Partial, so it stays the size of the review set rather than of the
-- whole graph.
CREATE INDEX IF NOT EXISTS "edu_knowledge_graph_due_idx"
  ON "edu"."knowledge_graph" USING btree ("learner_id", "due_at")
  WHERE "kind" = 'review';

-- ---------------------------------------------------------------------------
-- Privileges. Same posture and same order as `payload_schema_deny_anon`:
-- privileges first, policies second.
--
-- A missing GRANT is simpler and stricter than a policy, and it holds whether or
-- not PostgREST ever learns this schema exists. The ALTER DEFAULT PRIVILEGES
-- lines are the ones that keep holding — without them the next table created
-- here arrives with grants and the posture decays one migration at a time.
-- ---------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA "edu" FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "edu" FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "edu" FROM anon, authenticated;
REVOKE ALL ON SCHEMA "edu" FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA "edu"
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "edu"
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA "edu"
  REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- Default-deny backstop: RLS on, no policies at all. Doc 12 §4 — "the Block is
-- the enforcement, RLS is the seatbelt." Deliberately NOT `FORCE ROW LEVEL
-- SECURITY`: the app connects as `postgres`, which owns these tables and carries
-- rolbypassrls, and forcing it would take the educational store down for the
-- only role that may read it.
ALTER TABLE "edu"."transcripts"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "edu"."knowledge_graph" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- The standing assertion.
--
-- Everything above makes raw text unrepresentable TODAY. This makes it stay that
-- way: any future `ALTER TABLE edu.* ADD COLUMN … text` fails the next time this
-- migration is re-applied, and the message names the column. `edu.transcripts.turns`
-- is the single declared exception — its shape is pinned by the key whitelist
-- above rather than by its type.
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

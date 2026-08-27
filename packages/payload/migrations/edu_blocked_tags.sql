-- The durable half of erasure — what a family has told us to stop deriving.
-- Apply with the Supabase MCP `apply_migration`, name: `edu_blocked_tags`.
--
-- WHY THIS TABLE EXISTS. `packages/student-model/src/erasure.ts` says it in its
-- own header: "Deleting a fact that the next session would re-derive is
-- theatre." `withoutBlockedTags` was written to prevent exactly that, was
-- exported, was tested — and had nowhere to read a blocked tag FROM, so it had
-- no production call site and erasure worked once, on one device, until the
-- guardian reloaded S27. A tag blocked in a zustand store is a preference held
-- by a browser tab. This is the row that outlives the tab.
--
-- Same posture as `edu_schema.sql` and the same reasons: domains rather than
-- bare text, CHECKs that make the wrong row unrepresentable, no grants for the
-- anon roles, RLS on as the seatbelt, and the standing DO-block assertion
-- re-run at the foot so this table is held to the no-raw-text rule too.
--
-- Additive and idempotent: one table, no index, no ALTER of anything existing.
-- SOT: packages/student-model/src/erasure.ts · docs/pack/07-security-child-ai-safety-spec.md §4 §S27 · docs/pack/12-systems-design-prompt.md §3 §4 · packages/payload/migrations/edu_schema.sql
-- SOT-KEYWORDS: edu blocked tags erasure re-derivation guard interest misconception guardian delete migration additive supabase separation

-- ---------------------------------------------------------------------------
-- edu.blocked_tags — `erasure.ts:withoutBlockedTags`'s input, per learner.
--
-- NO NEW DOMAIN AND NO NEW TYPE. Every column here reuses one `edu_schema.sql`
-- already declared, which is the point of having declared them: a second
-- `tag`-shaped domain would be a second opinion about what a tag may contain,
-- and the two would drift the first time the taxonomy's slug rules changed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "edu"."blocked_tags" (
  "learner_id" "edu"."opaque_id" NOT NULL,
  "tag"        "edu"."tag"       NOT NULL,

  -- Which kind of fact the guardian erased to produce this row. Recorded rather
  -- than inferred because the tag alone cannot answer it later, and "why is
  -- Natalie no longer allowed to notice this" is the question a family asks.
  "kind" "edu"."fact_kind" NOT NULL,

  -- No TTL and no `expires_at`, deliberately, and this is the one place in `edu`
  -- where that is true. Everything else here is learner content on a published
  -- window; this is a family's INSTRUCTION about that content, and an
  -- instruction that quietly expired would restore a deleted belief on a
  -- schedule nobody was told about. `erasure.ts`: "a deleted interest stays
  -- deleted until the family says otherwise."
  "blocked_at" timestamp(3) with time zone NOT NULL DEFAULT now(),

  -- The natural key, and the reason there is no surrogate id: the question the
  -- distillation path asks is "is this tag blocked for this learner", and the
  -- primary key IS that question. It also makes the write idempotent — a
  -- guardian erasing the same line twice, or a retry of the same request, is
  -- `ON CONFLICT DO NOTHING` rather than a second row.
  --
  -- One row per (learner, tag) and NOT per (learner, tag, kind), because
  -- `withoutBlockedTags` filters interests and misconceptions against a single
  -- flat set of strings. Keying on the kind as well would let the table hold a
  -- distinction the filter cannot express, which is how a row ends up meaning
  -- something no reader honours.
  CONSTRAINT "blocked_tags_pkey" PRIMARY KEY ("learner_id", "tag"),

  -- `erasure.ts` again: "Mastery and review are deliberately NOT blockable: they
  -- are a record of work the child did, and suppressing them permanently would
  -- leave the tutor teaching a child it is forbidden to notice is improving."
  -- That sentence is a comment in a pure function a caller can bypass. Here the
  -- forbidden row has no representation. `scaffolding` is excluded for the same
  -- reason as mastery — it is a measurement of how much help the child asked
  -- for, not a claim about who she is.
  CONSTRAINT "blocked_tags_blockable_kind" CHECK ("kind" IN ('interest', 'misconception'))
);

-- NO INDEX. The only read is `where learner_id = $1`, and `learner_id` is the
-- leading column of the primary key, so the PK's implicit btree already serves
-- it. A second index on the same prefix would be a write cost on the erasure
-- path bought with nothing.

-- ---------------------------------------------------------------------------
-- Privileges. Same posture and same order as `edu_schema.sql`: privileges
-- first, policies second, and the ALTER DEFAULT PRIVILEGES lines in that file
-- already cover a table created after them — these are restated because a
-- migration that only works when another one ran first is a migration that
-- silently grants when replayed against a fresh database.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE "edu"."blocked_tags" FROM anon, authenticated;

-- Default-deny backstop, exactly as the two tables in `edu_schema.sql`: RLS on,
-- no policies at all, and NOT `FORCE` — the app connects as the owning role and
-- forcing it would take erasure down for the only role permitted to record one.
ALTER TABLE "edu"."blocked_tags" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- The standing assertion, re-run.
--
-- `edu_schema.sql` ends with this block and it is schema-wide, so re-running it
-- here is what proves the new table did not open the hole that file exists to
-- close. `kind` is an enum, `blocked_at` a timestamp, and `learner_id`/`tag` are
-- domains over text with a regex — none of the four is a bare string column, and
-- this is the check that says so rather than the commit message.
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

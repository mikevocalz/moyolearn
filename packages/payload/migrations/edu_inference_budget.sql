-- The per-learner daily inference budget, made DURABLE (doc 12 §7).
-- Apply with the Supabase MCP `apply_migration`, name: `edu_inference_budget`.
--
-- `packages/inference/src/budget.ts` shipped `inMemoryLedger()` and said so in
-- its own header: "a restart forgives the day, and two server processes count
-- separately." On Vercel that is not a caveat, it is the absence of the control:
-- every deploy zeroes every child's day, and two lambdas serving the same child
-- each believe they are the only one counting. The §7 cost model rests on a
-- ceiling that therefore did not hold. This table is the ceiling.
--
-- WHY `edu` AND NOT A FOURTH SCHEMA. The row is keyed by a learner id and is a
-- record of a child's activity on a day. Doc 07 §4 wants exactly one door onto
-- anything shaped like that, and `tooling/check-store-separation.mjs` already
-- makes `edu` reachable only through `apps/web/lib/*.repository.ts`. A separate
-- `ops` schema would be a second place a learner id lives that the retention
-- sweep does not know about — which is how a "we delete everything about your
-- child" promise acquires an exception nobody wrote down. The check's `EDU_SQL`
-- pattern is extended to name this table in the same commit, so the ledger
-- inherits that door rather than needing a new one.
--
-- The gateway still cannot reach it. `@acme/inference` holds the `BudgetLedger`
-- PORT; the implementation is `apps/web/lib/budget-ledger.repository.ts` and is
-- injected. `tooling/check-no-training-path.mjs` still fails the build the day
-- that package grows an import of a repository, which is the property that made
-- the port a port in the first place.
--
-- Additive and idempotent: one new table, two indexes, no ALTER to anything the
-- concurrent tutoring-path cutover touches.
-- SOT: docs/pack/12-systems-design-prompt.md §4 §7 · packages/inference/src/budget.ts · apps/web/lib/budget-ledger.repository.ts
-- SOT-KEYWORDS: inference budget ledger durable daily turns usd ceiling learner edu schema migration additive supabase break nudge

-- ---------------------------------------------------------------------------
-- edu.inference_budget — `packages/inference/src/budget.ts:LedgerDay`
--
-- The composite primary key IS the ledger key. `budget.ts:dayKey` returns a UTC
-- calendar day and explains why (a rolling window gives a child a different
-- allowance at 5pm than at 7pm for reasons no guardian could be told), so `day`
-- is a `date` rather than a timestamp: the type makes the calendar-day decision
-- unrepresentable as anything else, and a writer cannot quietly re-key the
-- ledger to a rolling window without an ALTER somebody has to review.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "edu"."inference_budget" (
  "learner_id" "edu"."opaque_id" NOT NULL,
  "day" date NOT NULL,

  -- The two counters `LedgerDay` carries. Both non-negative and both defaulted,
  -- so the UPSERT that increments them has no branch for "row does not exist
  -- yet" — see the repository's single-statement `record`.
  "turns" integer NOT NULL DEFAULT 0 CHECK ("turns" >= 0),

  -- `numeric`, not `double precision`. A day's spend is a sum of per-turn prices
  -- computed from token counts (`models.ts:priceUsd`), and floating-point
  -- addition of forty of those drifts in the direction nobody notices until the
  -- ceiling is the thing being argued about. Six decimal places because a cheap
  -- classifier turn is fractions of a cent.
  "usd" numeric(12,6) NOT NULL DEFAULT 0 CHECK ("usd" >= 0),

  -- Operational, not learner-facing. `first_turn_at` is what tells an operator
  -- whether a day that hit the ceiling was a child working steadily or a loop
  -- burning the allowance in ninety seconds — the distinction `budget.ts`
  -- already cares about in `endedOnCeiling`, which today can only say THAT it
  -- happened and not how fast.
  "first_turn_at" timestamp(3) with time zone NOT NULL DEFAULT now(),
  "last_turn_at" timestamp(3) with time zone NOT NULL DEFAULT now(),

  -- GENERATED, not defaulted.
  --
  -- Same posture as `edu.transcripts`' TTL constraint: the retention window is a
  -- promise made to a family, so no writer may hand itself a longer one. A
  -- DEFAULT can be overridden by any INSERT that names the column; a generated
  -- column cannot be written at all. 30 days matches `TRANSCRIPT_TTL_DAYS`
  -- (`packages/student-model/src/facts.ts`) on purpose — a derived record of
  -- when a child was working must not outlive the transcripts it was derived
  -- alongside, and picking a second number would be picking which of two
  -- retention promises to believe.
  --
  -- `date + interval` and `timezone(text, timestamp)` are both IMMUTABLE, which
  -- is what makes STORED legal here.
  "expires_at" timestamp(3) with time zone
    GENERATED ALWAYS AS ((("day" + INTERVAL '30 days') AT TIME ZONE 'UTC')) STORED,

  CONSTRAINT "inference_budget_pkey" PRIMARY KEY ("learner_id", "day")
);

-- The sweep's access path. It reads by expiry alone, so a single-column btree is
-- the whole index it needs; the primary key already serves every read the
-- gateway makes (`learner_id`, `day` — an exact-match lookup of one row).
CREATE INDEX IF NOT EXISTS "edu_inference_budget_expires_at_idx"
  ON "edu"."inference_budget" USING btree ("expires_at");

-- ---------------------------------------------------------------------------
-- Privileges. Identical posture to the rest of `edu` — a missing GRANT is
-- simpler and stricter than a policy, and the schema-level REVOKE in
-- `edu_schema.sql` plus its ALTER DEFAULT PRIVILEGES already cover a table
-- created afterwards. Repeated here anyway, because a table whose safety
-- depends on a different file having run first is a table that is unsafe the one
-- time it is created by hand.
-- ---------------------------------------------------------------------------
REVOKE ALL ON TABLE "edu"."inference_budget" FROM anon, authenticated;

-- Default-deny backstop: RLS on, no policies. Doc 12 §4 — "the Block is the
-- enforcement, RLS is the seatbelt." Not FORCE, for the reason `edu_schema.sql`
-- gives: the app connects as the owning role, and forcing it would take the
-- ledger down for the only role allowed to read it.
ALTER TABLE "edu"."inference_budget" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- The standing assertion from `edu_schema.sql`, re-run.
--
-- That file's DO block only proves the schema is clean at the moment IT is
-- applied. Re-running it here is what makes this migration prove that IT did
-- not introduce the first unconstrained string column — the table above is
-- deliberately all domains, dates and numerics, and this is the line that keeps
-- that true if somebody later adds "just one text column for a note".
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

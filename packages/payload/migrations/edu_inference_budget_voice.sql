-- The per-learner daily VOICE budget columns (doc 32 §5) — additive.
-- Apply with the Supabase MCP `apply_migration`, name: `edu_inference_budget_voice`.
--
-- TTS joins doc 12 §7's per-learner-day cost model as ITS OWN line, on the
-- SAME row as the inference budget. Same row because a learner-day is one
-- record of a child's activity: it inherits `edu.inference_budget`'s primary
-- key, its atomic upsert, its generated `expires_at` and therefore the same
-- 30-day retention sweep — no second table for the "forget everything" promise
-- to miss. Separate COLUMNS because doc 32 §6's shed order ("voice degrades to
-- text before tutoring degrades at all") requires voice spend and tutoring
-- spend to hit different ceilings, and because voice is priced per character,
-- not per turn — `turns` is never incremented by a voice debit.
--
-- The learner-facing consequence of these numbers is SILENCE, never a surface:
-- a spent voice day renders as text-only chat, which is doc 32 §2's stated
-- degraded mode. No screen renders either column (CLAUDE.md §Children's
-- surfaces).
-- SOT: docs/pack/32-tutor-voice-tone.md §5 §6 · packages/voice/src/budget.ts · apps/web/lib/budget-ledger.repository.ts
-- SOT-KEYWORDS: voice budget columns chars usd additive shed order text only retention same row

ALTER TABLE "edu"."inference_budget"
  ADD COLUMN IF NOT EXISTS "voice_chars" integer NOT NULL DEFAULT 0 CHECK ("voice_chars" >= 0);

-- numeric, not double precision — same drift argument as `usd` one column over:
-- a day's voice spend is a sum of many sub-cent per-sentence estimates.
ALTER TABLE "edu"."inference_budget"
  ADD COLUMN IF NOT EXISTS "voice_usd" numeric(12,6) NOT NULL DEFAULT 0 CHECK ("voice_usd" >= 0);

-- ---------------------------------------------------------------------------
-- The standing assertion from `edu_schema.sql`, re-run: this migration adds
-- integers and numerics only, and this proves it stayed that way.
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

-- The retention sweep: expired conversations, and any version shadow of them.
--
-- Doc 12 §11.1. Two things this has to survive, and the first version survived
-- neither.
--
-- ONE: the `_v` tables may not exist. Versions are off on every collection and
-- the twelve shadow tables were dropped once emptied, so naming them directly
-- raises 42P01 — and because this file is executed as ONE multi-statement
-- string, libpq wraps it in an implicit transaction and a single missing
-- relation aborts every other statement with it. That is exactly what happened:
-- the version-table deletes were written to close a retention hole, and by
-- naming tables that had just been dropped they silently took the expired-parent
-- deletes down too. The sweep stopped sweeping ANYTHING, in the same change that
-- was supposed to make it thorough.
--
-- TWO: they may exist again. `tooling/check-versions-off.mjs` makes re-enabling
-- versions a lint failure, but a lint check guards the repository, not the
-- database — a restored backup or a hand-run push can put them back.
--
-- So the shadow pass is guarded by `to_regclass` and driven dynamically: present
-- and it runs, absent and it is a no-op. Idempotent either way.
-- SOT: docs/pack/12-systems-design.md §11.1 · docs/pack/07-security-child-ai-safety-spec.md §4
-- SOT-KEYWORDS: retention sweep erasure cascade version tables expired orphan learner

DO $$
DECLARE
  pair record;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('_tutor_sessions_v',            'tutor_sessions'),
      ('_session_transcripts_v',       'session_transcripts'),
      ('_student_model_facts_v',       'student_model_facts'),
      ('_consents_v',                  'consents'),
      ('_guardianships_v',             'guardianships')
    ) AS t(shadow, parent)
  LOOP
    CONTINUE WHEN to_regclass('payload.' || quote_ident(pair.shadow)) IS NULL;

    -- Children of an expired parent.
    IF to_regclass('payload.' || quote_ident(pair.parent)) IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema='payload' AND table_name=pair.parent
                     AND column_name='expires_at') THEN
      EXECUTE format(
        'DELETE FROM payload.%I v USING payload.%I s WHERE v.parent_id = s.id AND s.expires_at < now()',
        pair.shadow, pair.parent);
    END IF;

    /*
      Orphans. This is the case that makes the guarantee FALSE rather than
      merely late: Payload's version FK is ON DELETE SET NULL, not CASCADE, so
      erasing a parent nulls the pointer and leaves the child's words behind.
      The row that survives is the one nothing can trace to anybody.
    */
    IF to_regclass('payload.' || quote_ident(pair.parent)) IS NOT NULL THEN
      EXECUTE format(
        'DELETE FROM payload.%I v WHERE NOT EXISTS (SELECT 1 FROM payload.%I s WHERE s.id = v.parent_id)',
        pair.shadow, pair.parent);
    ELSE
      EXECUTE format('DELETE FROM payload.%I', pair.shadow);
    END IF;
  END LOOP;
END $$;

-- Expired parents themselves, last: deleting a parent before its versions would
-- turn every one of them into an orphan mid-transaction.
DELETE FROM payload.tutor_sessions      WHERE expires_at < now();
DELETE FROM payload.session_transcripts WHERE expires_at < now();

/*
  Safety events, on a DIFFERENT clock and swept by the same job.

  Doc 12 §7 keeps audit and safety events in "separate stores with separate
  retention", and this is the separation made real: the two DELETEs above act on
  a 30-day window over a child's WORDS, and this one acts on a 90-day window over
  a verdict that contains none. Same sweeper because two schedulers is two things
  to forget to run, not because the windows are related — `SAFETY_EVENT_TTL_DAYS`
  in `packages/safety/src/events.ts` owns the number and says why.

  GUARDED, for the reason this file's header records at length: the whole script
  runs as one multi-statement string inside an implicit transaction, so naming a
  table that does not exist yet raises 42P01 and takes every other statement down
  with it. That is exactly how the sweep once stopped sweeping anything, in the
  change that was meant to make it thorough. A database that has not had
  `safety_events_additive.sql` applied is a no-op here, not a broken sweep.
*/
DO $$ BEGIN
  IF to_regclass('payload.safety_events') IS NOT NULL THEN
    EXECUTE 'DELETE FROM payload.safety_events WHERE expires_at < now()';
  END IF;
END $$;

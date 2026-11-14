DO $$
DECLARE q payload.homework_questions%ROWTYPE;
BEGIN
  SELECT * INTO STRICT q FROM payload.homework_questions WHERE question_id = 'scratch-question';
  IF q.prior_work <> 'none' OR q.prior_work_confidence IS NOT NULL
     OR q.prior_work_source IS NOT NULL OR q.prior_work_revisions <> '[]'::jsonb THEN
    RAISE EXCEPTION 'legacy prior-work defaults changed';
  END IF;
  IF (to_jsonb(q) - ARRAY['prior_work', 'prior_work_confidence', 'prior_work_source', 'prior_work_revisions'])
     IS DISTINCT FROM (SELECT original FROM legacy_snapshot) THEN
    RAISE EXCEPTION 'migration modified a legacy field, crop or learning outcome';
  END IF;
END $$;

-- A guardian mark remains separate from the attempted learning outcome.
UPDATE payload.homework_questions
SET prior_work = 'complete', prior_work_source = 'guardian', prior_work_confidence = NULL,
    prior_work_revisions = '[{"priorWork":"complete","source":"guardian","createdAt":"2026-11-14T00:00:00Z"}]'::jsonb
WHERE question_id = 'scratch-question';

CREATE TEMP TABLE marked_snapshot AS
SELECT to_jsonb(q) AS marked FROM payload.homework_questions q;

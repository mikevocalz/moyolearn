DO $$
DECLARE q payload.homework_questions%ROWTYPE;
BEGIN
  SELECT * INTO STRICT q FROM payload.homework_questions WHERE question_id = 'scratch-question';
  IF to_jsonb(q) IS DISTINCT FROM (SELECT marked FROM marked_snapshot) THEN
    RAISE EXCEPTION 'migration rerun modified the guardian mark, history, crop or outcome';
  END IF;
  IF q.prior_work <> 'complete' OR q.prior_work_source <> 'guardian'
     OR q.prior_work_revisions -> 0 ->> 'source' <> 'guardian' OR q.outcome <> 'attempted' THEN
    RAISE EXCEPTION 'guardian mark was not persisted independently of outcome';
  END IF;
  IF enum_range(NULL::payload.enum_homework_questions_prior_work)::text <> '{none,partial,complete}' THEN
    RAISE EXCEPTION 'prior-work enum differs from the API contract';
  END IF;
  BEGIN
    UPDATE payload.homework_questions SET prior_work = 'correct' WHERE question_id = 'scratch-question';
    RAISE EXCEPTION 'invalid prior-work value was accepted';
  EXCEPTION WHEN invalid_text_representation THEN NULL;
  END;
END $$;

SELECT 'PASS: legacy defaults; unchanged legacy row/crop/outcome; guardian mark/history; idempotent rerun; enum rejection' AS result;

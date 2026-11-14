DO $$
DECLARE q payload.homework_questions%ROWTYPE;
BEGIN
  IF (SELECT count(*) FROM payload.homework_questions) <> 2 THEN
    RAISE EXCEPTION 'crop sweep deleted homework rows';
  END IF;
  SELECT * INTO STRICT q FROM payload.homework_questions WHERE question_id = 'scratch-question';
  IF q.crop IS NOT NULL THEN
    RAISE EXCEPTION 'expired crop survived production sweep';
  END IF;
  IF (to_jsonb(q) - 'crop') IS DISTINCT FROM
     (SELECT original - 'crop' FROM before_crop_sweep WHERE question_id = q.question_id) THEN
    RAISE EXCEPTION 'crop sweep changed prior work, history, text or learning outcomes';
  END IF;
  SELECT * INTO STRICT q FROM payload.homework_questions WHERE question_id = 'scratch-live-question';
  IF to_jsonb(q) IS DISTINCT FROM
     (SELECT original FROM before_crop_sweep WHERE question_id = q.question_id) THEN
    RAISE EXCEPTION 'crop sweep changed the live control row';
  END IF;
END $$;

SELECT 'PASS: expired crop removed; mark/history/text/outcome retained; live crop unchanged' AS result;

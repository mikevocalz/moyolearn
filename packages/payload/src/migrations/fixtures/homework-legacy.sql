-- Synthetic legacy data, inserted before prior-work columns exist.
INSERT INTO payload.homework_submissions
  (submission_id, learner_auth_id, created_by_auth_id, subject, title, local_date, current_question_id)
VALUES ('scratch-submission', 'scratch-learner', 'scratch-guardian', 'Math', 'Scratch worksheet', '2026-11-14', 'scratch-question');

INSERT INTO payload.homework_questions
  (question_id, submission_id, learner_auth_id, order_index, source_page, current_revision,
   text, revisions, crop, crop_expires_at, outcome, attempts, hints_used)
VALUES
  ('scratch-question', 'scratch-submission', 'scratch-learner', 0, 1, 'scratch-revision',
   '2 + 2', '[{"revision":"scratch-revision","text":"2 + 2","author":"guardian"}]',
   '{"storageKey":"synthetic-crop","width":10,"height":10}', '2026-11-21T00:00:00Z', 'attempted', 2, 1);

CREATE TEMP TABLE legacy_snapshot AS
SELECT to_jsonb(q) AS original FROM payload.homework_questions q;

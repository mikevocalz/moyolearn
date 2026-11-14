-- Minimal empty prerequisites for the complete production sweep.sql. These are
-- not a Payload bootstrap or a test of transcript/account deletion.
CREATE TABLE payload.tutor_sessions (id serial PRIMARY KEY, expires_at timestamptz);
CREATE TABLE payload.session_transcripts (id serial PRIMARY KEY, expires_at timestamptz);

-- Expire the synthetic crop already marked by the migration test.
UPDATE payload.homework_questions
SET crop_expires_at = now() - interval '1 hour'
WHERE question_id = 'scratch-question';

-- A control crop still within its retention period must survive.
INSERT INTO payload.homework_questions
  (question_id, submission_id, learner_auth_id, order_index, source_page, current_revision,
   text, crop, crop_expires_at, prior_work, prior_work_source, prior_work_revisions)
VALUES
  ('scratch-live-question', 'scratch-submission', 'scratch-learner', 1, 1, 'scratch-live-revision',
   '3 + 3', '{"storageKey":"synthetic-live-crop","width":10,"height":10}', now() + interval '6 days',
   'complete', 'guardian', '[{"priorWork":"complete","source":"guardian","createdAt":"2026-11-14T00:00:00Z"}]');

CREATE TEMP TABLE before_crop_sweep AS
SELECT question_id, to_jsonb(q) AS original FROM payload.homework_questions q;

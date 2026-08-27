-- The retention sweep, including the shadow tables the guarantee forgot.
--
-- Doc 12 §11.1. `expires_at` on the main table was the whole sweep, and Payload
-- mirrors every write into `_<table>_v`. So an expired transcript survived in its
-- own version table and "delete my child's data" did not delete it. Versions are
-- off now, which stops NEW shadows; these statements clear the ones already
-- written and keep clearing any that a future collection re-introduces.
--
-- Ordered children-before-parents so a failure part-way leaves orphans rather
-- than dangling references, and idempotent so a retried job is a no-op.
-- SOT: docs/pack/12-systems-design.md §11.1 · docs/pack/07-security-child-ai-safety-spec.md §4
-- SOT-KEYWORDS: retention sweep erasure cascade version tables expired orphan learner

-- 1. Version rows whose parent has expired.
DELETE FROM payload._tutor_sessions_v v
USING payload.tutor_sessions s
WHERE v.parent_id = s.id AND s.expires_at < now();

DELETE FROM payload._session_transcripts_v v
USING payload.session_transcripts s
WHERE v.parent_id = s.id AND s.expires_at < now();

-- 2. Orphans: the parent is already erased and the version outlived it. This is
--    the case that makes the guarantee false rather than merely late.
DELETE FROM payload._tutor_sessions_v v
WHERE NOT EXISTS (SELECT 1 FROM payload.tutor_sessions s WHERE s.id = v.parent_id);

DELETE FROM payload._session_transcripts_v v
WHERE NOT EXISTS (SELECT 1 FROM payload.session_transcripts s WHERE s.id = v.parent_id);

DELETE FROM payload._student_model_facts_v_texts t
WHERE NOT EXISTS (SELECT 1 FROM payload._student_model_facts_v v WHERE v.id = t.parent_id);

DELETE FROM payload._student_model_facts_v v
WHERE NOT EXISTS (SELECT 1 FROM payload.student_model_facts f WHERE f.id = v.parent_id);

DELETE FROM payload._consents_v v
WHERE NOT EXISTS (SELECT 1 FROM payload.consents c WHERE c.id = v.parent_id);

DELETE FROM payload._guardianships_v v
WHERE NOT EXISTS (SELECT 1 FROM payload.guardianships g WHERE g.id = v.parent_id);

-- 3. Expired parents themselves, last: a parent deleted before its versions
--    would turn every one of them into an orphan mid-transaction.
DELETE FROM payload.tutor_sessions      WHERE expires_at < now();
DELETE FROM payload.session_transcripts WHERE expires_at < now();

-- Enable Row Level Security on every payload.* table that shipped without it.
--
-- Why this is safe for Payload: the app connects as the table OWNER, and an
-- owner bypasses RLS unless FORCE ROW LEVEL SECURITY is set — which this file
-- deliberately does not set. Eight sibling tables (users, guardianships,
-- consents, session_transcripts, student_model_facts…) have run RLS-enabled
-- in production already, which is the lived proof of that bypass.
--
-- Why it is still worth doing: the schema's standing walls were (1) not being
-- in PostgREST's exposed-schemas list and (2) the explicit
-- `REVOKE ALL … FROM anon, authenticated` pins every migration carries. RLS
-- deny-by-default is the third, and the only one that survives someone later
-- exposing the schema or re-granting a role — a wall that holds when the
-- other two are misconfigured is the point of having three.
--
-- No policies on purpose: nothing but the owner should read these tables from
-- a Supabase client role, so "no policy" IS the policy.
-- Idempotent: ENABLE ROW LEVEL SECURITY is a no-op when already enabled.
-- SOT: supabase advisor rls_disabled · packages/payload/migrations/* privilege pins
-- SOT-KEYWORDS: rls enable payload schema deny default owner bypass anon revoke

ALTER TABLE "payload"."media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."skills_rels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."misconceptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."payload_kv" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."payload_locked_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."payload_locked_documents_rels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."payload_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."payload_preferences_rels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."payload_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."leads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."tutor_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."safety_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."incident_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."incident_reports_texts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."session_summaries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."handoff_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."assignments_work_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."assignment_completions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."tutor_engagements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."families" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."families_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."families_learner_refs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payload"."sessions" ENABLE ROW LEVEL SECURITY;

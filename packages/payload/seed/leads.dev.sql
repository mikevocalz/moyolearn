-- Dev seed for the ops pipeline. NOT a migration: it is data, it targets the
-- mock session's tenant (`dev-org-1`, see core/protected-operation), and nothing
-- outside development should ever run it.
--
-- Idempotent by tenant rather than by row: there is no natural key on a lead, so
-- the guard asks "does this org already have a pipeline?" and does nothing if so.
-- Re-running it therefore cannot duplicate the pipeline or overwrite a stage
-- somebody moved by hand.
--
-- `cohort_size` straddles MIN_COHORT (10) on purpose: three rows sit below it, so
-- the dashboard exercises k-anonymity suppression from the default seed rather
-- than only from a test (doc 19 §5).
-- SOT: docs/pack/28-crm-spec.md §2–§3 · docs/pack/19-learning-outcomes-spec.md §5
-- SOT-KEYWORDS: leads seed dev fixtures ops crm pipeline suppression cohort tenant

INSERT INTO "payload"."leads"
  (org_id, family, learner, subject, stage, owner, value_cents, currency,
   sessions, next_session_at, needs_attention, attendance_pct, cohort_size, created_at, updated_at)
SELECT * FROM (VALUES
  ('dev-org-1','Okafor','Daniel','Fractions','Trial scheduled'::"payload"."enum_leads_stage",'Amara',4500,'USD',1,(current_date + time '10:00') AT TIME ZONE 'America/New_York',true,NULL::numeric,3,now() - interval '1 hour'),
  ('dev-org-1','Whitfield','Noah','Algebra I','Proposal','Amara',0,'USD',0,NULL,true,NULL,0,now() - interval '2 hours'),
  ('dev-org-1','Bell','Sofia','Reading','At risk','Jonah',49500,'USD',11,(current_date + time '14:30') AT TIME ZONE 'America/New_York',true,61,14,now() - interval '3 hours'),
  ('dev-org-1','Rodriguez','Maya','Algebra II','Enrolled','Amara',108000,'USD',24,(current_date + time '09:00') AT TIME ZONE 'America/New_York',false,96,22,now() - interval '4 hours'),
  ('dev-org-1','Fischer','Elena','Reading','Enrolled','Jonah',171000,'USD',38,(current_date + time '16:00') AT TIME ZONE 'America/New_York',false,99,31,now() - interval '5 hours'),
  ('dev-org-1','Adeyemi','Tomi','Chemistry','Trial completed','Jonah',4500,'USD',1,NULL,false,NULL,2,now() - interval '6 hours'),
  ('dev-org-1','Nakamura','Rin','Geometry','Inquiry','Amara',0,'USD',0,NULL,false,NULL,0,now() - interval '7 hours')
) AS seed(org_id, family, learner, subject, stage, owner, value_cents, currency,
          sessions, next_session_at, needs_attention, attendance_pct, cohort_size, created_at),
  LATERAL (SELECT seed.created_at AS updated_at) u
WHERE NOT EXISTS (SELECT 1 FROM "payload"."leads" WHERE org_id = 'dev-org-1');

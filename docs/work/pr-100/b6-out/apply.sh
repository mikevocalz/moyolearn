#!/bin/bash
cd /Users/mikevocalz/moyolearn-pr100/packages/payload/migrations
DB=${1:-pr100_e2e}
ORDER="edu_schema edu_questions edu_blocked_tags edu_embeddings edu_inference_budget edu_inference_budget_voice edu_backfill_from_payload better_auth_schema better_auth_tables member_education_role_additive learner_email_verified_backfill jobs_schema jobs_pgboss_schema_38_to_42 jobs_pg_cron_maintenance organizations_additive organizations_district_brand_theme_additive organizations_logo_aspect families_additive leads_additive leads_family_id_additive classes_additive enrollments_additive enrollments_class_id_additive assignments_additive assignment_completions_additive tutor_engagements_additive sessions_additive handoff_codes_additive incident_reports_additive safety_events_additive session_summaries_additive tutor_sessions_additive tutor_sessions_board users_voice_bands homework_additive payload_rls_enable"
n=0
for f in $ORDER; do n=$((n+1)); out=$(docker exec -i moyo-pr100-pg psql -U postgres -d $DB -v ON_ERROR_STOP=1 -q -f - < $f.sql 2>&1); rc=$?; echo "$n $f rc=$rc $(echo "$out" | grep -E 'ERROR' | head -2 | cut -c1-220)"; done

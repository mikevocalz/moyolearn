# Moyo AI Model Control Center — Payload first slice

Status: draft, 2026-10-15. Adds an access-controlled Payload collection and editable synthetic-evaluation preferences. **Does not change production routing.**

The native Payload admin at admin.moyolearn.com/admin is the only AI settings console. This app must not gain a duplicate custom AI dashboard or separate database. The ai-model-routes collection belongs in the existing Payload/Postgres schema. Only addresses in the server-side MOYO_AI_ADMIN_EMAILS allowlist may access it. If the list is absent, all requests are denied, including signed-in ordinary staff.

An admin can choose a school-subject lane, see Claude options, select **only one** Qwen fallback candidate (qwen3.8-max), attach review references, and save an evaluation-only preference. Qwen 4 is not an available deployment option. No production option is offered, because the current inference gateway's provider approval list is empty for real learners and the grade-band subject evaluation suite is incomplete.

## Delivery gates

1. Apply an additive schema migration and regenerate Payload types/import map against the actual canary version. Test admin read/write and deny default on an authenticated school, student and guardian account.
2. Add append-only audit event persistence (not Payload version shadow rows), with operator identity, previous policy digest, new digest, reason and date.
3. Introduce server-backed evaluation result references, provider agreement records, and a four-eyes production approval action. A free-form text reference is not proof.
4. Connect only verified policy revisions to the existing inference routing gateway. Enforce provider approval, subject x grade x task, learner eligibility, safety and budget on every dispatch. Never let client JSON or a dashboard flag bypass this.
5. Expose read-only telemetry for model served, cost, latency, withheld-answer rate, refusals, timeout and rollback readiness. Do not include children's identity, voice or assignments in analytics.
6. Add real staged rollout, rollback and audit tests before permitting a 'production' mode. Until then the options are disabled and synthetic evaluation only.

## Review ownership

Principal Payload/Postgres engineer, identity and authorization engineer, safety/privacy reviewer, tutoring subject evaluator, UX/accessibility owner, operations/SRE and quality engineer. Mandatory repo skills: Expo + Solito, FWC adaptive/split layout where relevant, @acme/ui semantic components, Mobbin, immaculate/impeccable visual review, no-ai-slop documentation and mature PR QA. Any future custom admin page must extend Payload's admin UI, not use raw HTML screens.

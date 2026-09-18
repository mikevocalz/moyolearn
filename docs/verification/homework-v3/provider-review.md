# Provider and capability boundary review

Date: 2026-09-16. Implemented gates, not authorization to launch.

The accepted architecture in doc 18 keeps Claude as Natalie. The repository contains no recorded contract approvals or subject-model evaluation results. Production approvals are therefore empty and capability cells are unevaluated. The current learner coaching route returns fixed text-only manual recovery after Safety Plane input screening. Crisis and guardian-disabled handling still run before that recovery.

The catalog distinguishes Anthropic API, Gemini Developer API, Vertex, Nano, Apple Foundation Models and specialist products. None of the Google, local-generation or specialist entries can serve a learner cloud route through this implementation. Credentials and a paid tier are not approval records. UI age band `adult` names grades 9–12; it is not proof that a learner is legally 18 or older.

Approval checks bind product, endpoint, model, task, under-18 scope, US region, retention, training policy, safety version and expiry. Checks run before dispatch, including the lazy stream iteration that actually starts the Anthropic transport. There is no refusal-triggered alternate model. The SDK endpoint is pinned. The catalog currently supports zero-retention approval only; broader contract policies need an explicit reviewed implementation.

Source review consulted the [Gemini API terms](https://ai.google.dev/gemini-api/terms), [ML Kit GenAI terms](https://developers.google.com/ml-kit/genai-terms), [Google Cloud service terms](https://cloud.google.com/terms/service-terms), and [Anthropic's minors guidance](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors). These public terms do not supply Moyo's private approvals or test results. Cloud and product eligibility must be reviewed for the exact deployment, not inferred from another product's branding.

## Review and tests

CodeRabbit CLI 0.7.6 reviewed the uncommitted foundation changes and returned three findings: bind approval to adapter product; use the server clock for approval expiry; fix version/unit spacing in the native research report. All were addressed. A further local review caught delayed stream dispatch and added a revocation-before-first-token regression.

Fake-transport tests cover missing/expired/malformed/mismatched/ambiguous approvals, revocation, all existing gateway task roles, denial without dispatch, historical-budget-clock bypass, delayed-stream revocation and provider refusal without fallback. Synthetic approvals are explicitly test fixtures. No live provider request or pedagogical evaluation was run.

## Remaining boundaries

Approval records need a real reviewed source and operational revocation ownership before activation. Capability evaluation metadata is not a substitute for running the subject suites. The full language, tool-version, curriculum and revision-bound evidence orchestration remains pending. TTS has its existing independent voice approval boundary; these model-product checks are not a replacement for it.

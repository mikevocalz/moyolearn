# v1 release checklist

v1 is one loop for one family: parent signs up and consents, adds a child, starts the trial, uploads homework and marks what is already done; the child works the first undone problem with Natalie on a phone; the parent sees the summary; the same child works the same problem with bare hands on Quest. It is done when every line in `docs/verification/v1-readiness-2026-11.md` is signed with device evidence.

Status values: `open`, `blocked`, `in review`, `done`. "Done" needs the evidence file named in the row.

## Repository

| Item | Owner | Status | Evidence |
| --- | --- | --- | --- |
| Billing, homework data, homework UI and hands lines on `main` | lane A | in review, waiting on CI | `docs/verification/v1-integration-2026-11.md` |
| CI green on `main` for turbo, iOS simulator, Android mobile-runtime, Quest assembly | lane A | open | Actions run on the merge commit |
| `homework_prior_work_additive.sql` and `better_auth_stripe_organization.sql` applied to staging and production | Mike (needs `DATABASE_URL`), lane B | open | applied-migration record with timestamps |
| No open draft PR holds v1 work (#153, #154, #155, virocore #121) | lane A | open | PR list |
| Branch cleanup: 56 remote branches contained in `main` proposed for deletion | Mike approves, lane A | open | list in the integration record |

## Phone

| Item | Owner | Status | Evidence |
| --- | --- | --- | --- |
| Persona hatch `apps/mobile/app/onboarding/dev.tsx` removed from release builds | lane C | in source, PR #160 (route deleted, `mobile-release-bundle` CI job greps the export) | bundle grep in CI |
| Mock auth, mock subscriptions and demo consent channel excluded from release bundles | lane C | in source, PR #160 (literal `__DEV__` require blocks; local release export clean) | bundle grep in CI |
| Guardian signup creates an account (today the account step stores an email only) | lane C | in source, PR #160 (`signUp.email`); device run owed | device run |
| OTP, forgot and reset routes exist on mobile (server has no `emailOTP` plugin; verification is link-based) | lane C | in source, PR #160 (forgot and reset routes, link-based verification kept); device run owed | device run |
| Parental consent verified server-side (today `DevConsentChannel`, in memory) | lane C | in source, PR #160 (hashed code in `consent-verifications`, learner create reads only the server row); needs the additive migration and `RESEND_API_KEY`/`AUTH_EMAIL_FROM` | server log of a stored consent |
| One price catalog that matches moyolearn.com (today three disagreeing literal sets) | lane C | in source, PR #158 (`packages/auth/src/plan-catalog.ts`); screenshot still owed | screenshot per paywall surface |
| `PlanCard` honours its `tier` prop so business tiers cannot render for a family | lane C | in source, PR #158 (`packages/ui/plan-card-guard.test.ts`, 5 tests); screenshot still owed | unit test plus screenshot |
| Entitlement states trial, active, lapsed, cancel-at-period-end, restore modelled and tested | lane C | in source, PR #158 (`packages/auth/src/entitlement-state.test.ts`, 18-row table plus transitions) | `subscription-reader` tests |
| Signed iOS build on TestFlight, signed Android build on Play internal testing (Android release currently signs with the debug keystore) | Mike (credentials), lane B | blocked | store listing |

## Quest

| Item | Owner | Status | Evidence |
| --- | --- | --- | --- |
| virocore #121 high findings fixed: metric switch mid-press, armed-on-first-sample, single-frame cancel policy | lane D | open | host tests wired into CMake and run |
| Candidate APK installed and Tutor Room entered with controllers off | lane D | blocked (no Quest attached) | recording |
| Pinch thresholds qualified from device traces | lane D | blocked | trace files and the updated handoff doc |
| Direct-touch ink implemented and holding a continuous stroke | lane D | open | recording |
| Board reach conflict decided on device (1.5 m board vs 0.6 m seated reach) | lane D | blocked | token change with the measurement |
| Child's current homework problem shown on the board panel | lane D | open | recording |
| Quest build on a Meta release channel (no pipeline exists in-repo) | Mike (Meta developer account), lane B | blocked | release channel listing |
| PICO build compiles and controllers still work | lane D | open | build log and recording |

## Production readiness

| Item | Owner | Status | Evidence |
| --- | --- | --- | --- |
| Security pass findings resolved | lane B | in review | `docs/verification/security-pass-2026-11.md` |
| Sentry reporting with child-privacy scrubbing confirmed | lane B | open | one scrubbed event in Sentry |
| Vercel spend cap and deployment retention set; only `main` and `release/*` build (not configured in-repo) | Mike (dashboard) | open | dashboard screenshot |
| Guardian incident reaches a real parent channel (today an in-app timeline marker only) | lane C | in source, PR #159 (email through the Resend sender, idempotent per guardian and incident); delivery to a real inbox still owed | device run |

## Non-code blockers (Mike)

| Item | Owner | Status |
| --- | --- | --- |
| Signed child-data agreement with each model provider in the tutor path (ElevenLabs voice; the coach model behind the Safety Plane generator) | Mike | open |
| Privacy policy and parental-consent text reviewed by counsel | Mike | open |
| MOYO trademark clearance | Mike | open |
| Auth cutover sign-off, which needs production credentials | Mike | open |
| Decision: accept the sales-inquiry commits on the billing line as-is, or land homework and hands without the billing line | lane A | decided 2026-11-25: ship the line; family invoice capture and the family inquiry option struck (`c5193fe2`, `dfbe5b29`) |

# Moyo Learn v1 security pass (build prompt 7.6)

Tree: /Volumes/QNX/clones/moyolearn-v1-20261125, integrate/v1-main-20261125, HEAD 1457ff92. Read-only, static. No .env files read, no secret values printed. The Skill tool was not available, so `no-ai-slop` and `better-auth-security-best-practices` were not loaded.
Paths are relative to the clone root.

## Summary

Server-side identity and ward scoping on the homework, handoff, summary and guardian routes holds up: identity comes from ctx, and every by-id path re-proves ownership. No server secrets were found in the bundle or source. The serious gaps are on three fronts. Consent is client-asserted. The S3/S4 guardian alert is a marker with no delivery channel. Two data-hygiene paths are open: any signed-in user can sign any CDN URL, and `tutor_messages` is never swept.

## Critical

None found statically.

## High

H1. Safety fan-out has no delivery channel (confirmed).
- `apps/web/lib/jobs.ts:223-234`: `safety.alert.guardian` only calls `markFannedOut(report,'guardian','in-app')` and saves the incident. `safety.review.enqueue` only marks `'on-call'`. The comment at jobs.ts:213-221 says there is no notification sender.
- Effect: an S3 reaches the parent only as a timeline entry they see if they open the app (`apps/web/app/api/guardian/incidents/route.ts:37-45`). ladder.ts S3 and S4 (`packages/safety/src/ladder.ts:112-129`) promise "guardian in-app + email" and an on-call page for S4. Neither happens. S4 ("guardian immediately, on-call human paged, 2h SLA") has no page.
- `apps/web/lib/incident.service.ts:49-64` runs detached and swallows failures. A failed enqueue is only `console.error` plus Sentry (incident.service.ts:105-115).

H2. Summary exclusion does not read incidents (confirmed).
- `packages/app/features/summary/summary.service.ts:354-392` (`screenSummary`) re-classifies the rendered narrative and each child answer with `coachClassifier.classifyOutput` and drops only `crisis` or `prohibited`. No reference to `incidentReports` or `safetyEvents` anywhere under `packages/app/features/summary/` or `apps/web/lib/summary.repository.ts`.
- Effect: an S3 filed from the input classifier (category `safety`, ladder.ts:155-156) is not excluded from the summary unless the output classifier independently agrees. The docstring at summary.service.ts:349-352 says "already an incident ... withheld", but the code only repeats the classification. Whether the output classifier and the input classifier agree is not checkable statically. A session in safe mode (S4) has no summary gate either (no `safeMode` reference in summary.service.ts).

H3. Child consent is not verified server-side.
- Client: `packages/app/features/onboarding/consent/consent.store.ts:70` defaults to `createDevConsentChannel()`. `setChannel` has no caller outside the store and tests (`rg setChannel(`).
- Server: `apps/web/app/api/family/learners/route.ts:36-55` accepts `consent.{method,scope,policyVersion,evidenceRef}` from the body. The route header (lines 6-9) says verification "ran there". `createManagedLearner` validates shape only (cannot confirm the content from this pass).
- Effect: any signed-in adult can mint a child account with a fabricated COPPA consent record. Verification is the client's word. Needs a server-verified consent step (or an explicit, documented v1 acceptance).

H4. `/api/media/view` signs any CDN URL for any signed-in user.
- `apps/web/app/api/media/view/route.ts:22-36`: checks only `url.startsWith(base)` and a session; no ownership check. Keys are `image/<learnerId or orgId>/<date>/<uuid>/...` (`packages/app/features/media/presign.rules.ts:58-59`, `presign.service.ts:70-72`), so the UUID is the only barrier. The Bunny pull zone is token-gated (bunny-token.ts), which makes this the one door to all families' homework photos.
- Related: `apps/web/app/api/tutor/session/attachment/route.ts:43-66` stores a client-supplied `url` and `storageKey` with no check that either sits under the caller's prefix or the CDN (`apps/web/lib/tutor-session.repository.ts:277`). A learner can attach any URL; it is later rendered to the guardian. Exploiting H4 needs a leaked or guessed URL, so rank High on blast radius, not on ease.

H5. `tutor_messages` has no sweep.
- `packages/payload/src/collections/TutorMessages.ts:48` requires `expiresAt`, and the table holds the child and tutor turn text (line 41-43). `packages/payload/src/retention/sweep.sql:68-69` deletes only `tutor_sessions` and `session_transcripts`; no statement names `tutor_messages` (rg across sweep.sql, retention.repository.ts, retention/sweep/route.ts: no hit). `tutor-session.repository.ts:151` says turns "live in tutorMessages now" and the session column is empty, so the 30-day sweep deletes empty session rows and leaves the transcript. No FK cascade is visible: no migration creates `tutor_messages` (the table comes from Payload push), so cascade behavior is unverified.
- Account deletion does cover it (`apps/web/lib/account-deletion.repository.ts:97`).
- Verify against the live DB before relying on the 30-day promise.

## Medium

M1. Dev persona hatch ships (confirmed, scoped).
- `apps/mobile/app/onboarding/dev.tsx:15-22` has no `__DEV__` or auth gate; registered at `apps/mobile/app/_layout.tsx:188` (title map at :63). `packages/app/features/onboarding/dev-persona-switch.tsx:19-33` calls `setPersona` with a fixture. The embedded copy in `public-entry-content.tsx:78` is gated by `__DEV__`; the route is not. Reachable by deep link `moyo://onboarding/dev`.
- Mitigation: it changes client store only. Server routes re-derive identity (`packages/app/core/protected-operation.ts:395-450`), so a persona gets UI shells, not data. Mock mode on the server needs `NEXT_PUBLIC_AUTH_MODE==='mock' && NODE_ENV==='development'` (protected-operation.ts:255-260, proxy.ts:64-90). Release risk is UI-level role spoofing and an App Review finding.
- `packages/app/providers/session/auth-mode.ts:16-22` defaults to mock; `apps/mobile/eas.json:15,26,37` sets live for all three profiles. A local release build without the var ships mock. Mock provider, `PERSONAS` and mock subscriptions import statically (`providers/session/session.tsx:7-9`, `dev-persona-switch.tsx:1-3`).

M2. Android backup rules cannot be verified, and the files are missing from the tree.
- `apps/mobile/android/app/src/main/AndroidManifest.xml:25`: `android:allowBackup="true"` with `fullBackupContent="@xml/secure_store_backup_rules"` and `dataExtractionRules="@xml/secure_store_data_extraction_rules"`. No `res/xml` directory exists in the tree (`git ls-files` shows none; not ignored). Either prebuild regenerates them or the resource link fails. Their content (what is excluded) is unreadable here.
- Quest and Pico flavors set `allowBackup=false` (`src/quest/AndroidManifest.xml:120`, `src/pico/AndroidManifest.xml:31`).
- Other MMKV stores (`capture` at `packages/app/features/capture/problem-storage.native.ts:7`, `onboarding`, `permissions`, `assign`) are created with no `encryptionKey`. `capture` persists the child's in-flight problem text (`PROBLEM_KEY`). Only the per-user store `packages/secure/src/cache.native.ts:57` is encrypted. Under `allowBackup=true` these are candidates for cloud backup unless the XML excludes them.

M3. Session storage on mobile is correct (SecureStore), with one caveat.
- `packages/app/providers/session/live.tsx:22-29` passes `betterAuthCookieStorage` to `createMoyoAuthClient`; native fork `packages/secure/src/better-auth-cookie-store.native.ts:10,25-27,39-46` uses `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. `expo-plugin.native.ts:9-17` leaves the plugin out if `storage` is missing; web fork is a no-op. No AsyncStorage for the session.
- Caveat: expo-secure-store on Android is Keystore-encrypted; backup of those prefs would be undecryptable on restore, so risk is low even if M2 is wrong.
- `packages/auth/src/server.ts:202`: `trustedOrigins: ['moyo://']`. A custom scheme can be claimed by another app on Android. Low in practice because the cookie goes through the Expo plugin, but note for the hand-off deep link.

M4. Handoff redeem has no throttle.
- Code is 6 chars from 31 symbols (`packages/auth/src/handoff-code.ts:13-15`, about 8.9e8), TTL 15 min, anonymous POST (`apps/web/app/api/handoff/redeem/route.ts:25-51`). No `rateLimit` config in `packages/auth/src/server.ts` (rg: none) and none in `apps/web/proxy.ts`. Better Auth's built-in limiter, if it applies to this custom route, is not visible here, and its default storage is per-instance memory on serverless. Many guardians minting at once multiplies hit odds. Redeem burns the row first (handoff.ts:141-143), which is good.
- Minting rotates the learner's password (handoff.ts:107-108); intended.

M5. Any Payload staff user has full read (and write on several) of learner content.
- `packages/payload/src/collections/HomeworkSubmissions.ts:50-52`, `HomeworkQuestions.ts:42-44`, `TutorSessions.ts:58`, `TutorMessages.ts:23-30`, `SessionSummaries.ts:69-82`, `IncidentReports.ts:71`, `Guardianships.ts:33`: `Boolean(req.user)`. No role or org split. `/admin` and `/api/payload` bypass the session proxy (`apps/web/proxy.ts:12-14`) and rely on Payload auth.
- `packages/payload/src/collections/Media.ts:24`: `read: () => true` (public via `/api/payload`).
- Not cross-family leakage for end users (they never hold a Payload session); an insider and staff-account-takeover risk.

M6. Payload DB connection is the table owner and skips TLS verification.
- `packages/payload/migrations/payload_rls_enable.sql:1-18`: app connects as owner, so RLS is not a policy layer for app queries (no policies, no FORCE). Scoping is entirely in application code (`where learnerAuthId`). Confirmed by `better_auth_tables.sql:121` and `edu_schema.sql:284`.
- `packages/payload/src/payload.config.ts:207-209`: `ssl: { rejectUnauthorized: false }` when the URL contains `supabase.co`.
- `payload.tutor_sessions` is in no `ENABLE ROW LEVEL SECURITY` statement (compared every `CREATE TABLE` against every `ENABLE ROW` across `packages/payload/migrations`), and `tutor_sessions_additive.sql` has no REVOKE. It holds child session metadata, and the legacy `messages` column. Whether `anon`/`authenticated` hold grants depends on the live DB.

M7. Error messages leak to clients.
- `apps/web/app/api/handoff/route.ts:50-51`, `apps/web/app/api/entitlements/route.ts:30-33`, `apps/web/app/api/guardian/incidents/route.ts:43-44`, `account/delete/route.ts:59-61`: unexpected `error.message` is returned with a 500. Homework routes avoid this (`apps/web/app/api/homework/_shared.ts:49-55`).

## Low

L1. `LogBox.ignoreAllLogs(true)` is unconditional (`apps/mobile/app/_layout.tsx:100`). Hides dev warnings and does nothing for release logs. The comment gives the PICO crash as the reason.
L2. `requireEmailVerification = NODE_ENV !== 'development'` (`packages/auth/src/server.ts:180,211`). Fail-closed for production builds; a staging deploy with `NODE_ENV=development` would skip verification.
L3. Bearer checks use `!==` on the secret, not constant-time (`apps/web/app/api/media/sweep/cron/route.ts:36`, `retention/sweep/cron/route.ts:40`, `packages/app/marketing/permissions/marketing.permissions.ts:165-166`, `api/jobs/drain/route.ts:39`). Each fails closed when the env is unset.
L4. Android release builds sign with the debug keystore (`apps/mobile/android/app/build.gradle:128-143`; `debug.keystore` is tracked). EAS remote builds sign with their own credentials, so this affects local release builds only.
L5. `marketingIdentityAccess` returns `true` for all updates and deletes when `MOYO_MARKETING_ADMIN_IDS` is unset (`packages/app/marketing/permissions/marketing.permissions.ts:49-58`); the allowlist protection then silently does nothing. The same env drives `isMarketingAdministrator`, which fails closed.
L6. `POST /api/homework/submissions` returns 409 when a client-chosen `submissionId` belongs to another learner (`apps/web/lib/homework.repository.ts:326-330`, `homework.service.ts` conflict mapping). Existence oracle plus squat on a globally unique id; ids are UUIDs, so exploitation needs a leak.
L7. `apps/mobile/src/telemetry.ts` and server config use `sendDefaultPii:false`; `packages/app/features/tutor/tutor-avatar-3d.native.tsx:319` logs a model-load failure (`JSON.stringify(event.nativeEvent)`) unguarded; no learner content.

## Check-by-check answers

### 1. Session storage and backup
See M2, M3. Session cookie: SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, 2KB limit assert (`packages/secure/src/better-auth-cookie-store.native.ts:40`). Android: `allowBackup="true"` on the phone manifest with rules referenced but absent; false on Quest/Pico. iOS `usesNonExemptEncryption:false` at `apps/mobile/app.config.ts:56`.

### 2. Secrets in the bundle
- Names found in source (`rg` over apps/packages/scripts): EXPO_PUBLIC_{API_URL, APP_URL, AUTH_MODE, AUTH_URL, MOCK_PERSONA, MOYO_NATIVE_BOARD, MOYO_NATIVE_RIVE, NATIVE_3D, SENTRY_DSN, SENTRY_DSN_MOBILE, SENTRY_ENVIRONMENT}; NEXT_PUBLIC_{APP_URL, AUTH_MODE, AUTH_URL, BUNNY_CDN_BASE_URL, BUNNY_STREAM_PULL_ZONE_URL, MOCK_PERSONA, NATIVE_3D, ROOT_DOMAIN, SENTRY_DSN, SENTRY_DSN_WEB, SENTRY_ENVIRONMENT, SITE_URL, VERCEL_ENV, VERCEL_GIT_COMMIT_SHA}. None is a server secret. Sentry DSNs are public by design. No `*_KEY`, `*_SECRET`, `*_TOKEN` NEXT_PUBLIC or EXPO_PUBLIC name exists.
- `apps/mobile/eas.json:12-39`: env blocks hold only APP_URL, AUTH_URL, AUTH_MODE, SENTRY_ENVIRONMENT.
- `apps/mobile/app.config.ts`: no `extra` block carries secrets; `HORIZON_APP_ID` read from `process.env` at config time (a store app id, not a credential).
- Grep for `sk_live|sk_test|whsec_|eyJ...|service_role|AKIA|re_...|PRIVATE KEY|sntrys_|DSN-with-key` in tracked source: only synthetic fixtures in `packages/auth/src/billing-payment.test.ts:181,209,217,232`. Long hex/base64 literals are commit pins and integrity hashes in `tooling/*.mjs`, `patches/`, `.github/workflows` (SHA pins). No tracked `.env`; `.env.example` files hold names only. `apps/mobile/android/app/debug.keystore` is tracked with the standard debug password (L4).

### 3. Cross-family isolation
- Identity always from ctx: `packages/app/core/protected-operation.ts:395-450` (session, then host tenant, then membership/capability). Mock branch gated by `isMockAuth()` (:255-260).
- Homework: `assertCanActFor` (`packages/app/features/homework/homework.service.ts:209-217`) allows self or an ACTIVE guardianship ward (`apps/web/lib/summary.repository.ts:272-285`). `ownerFor` (:223-228) resolves owner from the id, 404s unknown, then applies the ward rule. List (`:430-436`), create (`:413`), by-id read, start, advance, revise all pass through it. Repository queries also include `learnerAuthId` in every `where` (`apps/web/lib/homework.repository.ts:182,198,258,273,425,561`). `loadSubmissionOwner` (:211-221) is unscoped but returns an id only. `?learner=` and `forLearnerAuthId` are checked. Forbidden maps to 404 (`_shared.ts:53`).
- `revisePriorWork`: `reviseQuestionFor` (`homework.service.ts:455-470`) refuses a learner session (`ctx.isLearner`) or `owner === ctx.learnerId`, and requires `ownerFor` to pass, so only a user with an ACTIVE guardianship of that child. "Parent of that child only" is accurate for the guardianship table: any active guardian row qualifies (a co-guardian too), and `createSubmissionFor` blocks priorWork on learner-owned rows (:324-326).
- Handoff: mint requires an active guardian (`packages/auth/src/handoff.ts:91-93`) and a `guardianManaged` learner (:96-98); body carries only `learnerAuthId` (route.ts:30-46). Redeem is anonymous by design with one 404 for all misses.
- Entitlements: `apps/web/app/api/entitlements/route.ts:21-27` uses `ctx.learnerId`.
- Guardian reports, incidents, wards: guardianship-first queries (`apps/web/lib/incident.repository.ts`, summary.repository.ts), 404 for not-yours. Ops/family routes add `requiresMembership` (`apps/web/app/api/ops/families/[familyId]/route.ts:40-44`).
- Tutor session routes: sessionId is a claim; repository scopes by `ctx.learnerId` (`apps/web/app/api/tutor/session/message/route.ts:8-9`).
- RLS: enabled by `payload_rls_enable.sql` on listed tables, with no policies; the app connects as owner (M6). Isolation is application-layer only.
- No route found where learnerId/submissionId/orgId from the request is used without an ownership check, except the media view and attachment url gaps (H4). Not checked in depth: `teacher/*`, `business/campaigns`, `chemistry/energy`, `share/report`, `safety/*`, `progress`, `memory/erase` and `forget-all` routes (read headers only for `memory/erase-transcript`, `ops/families`).

### 4. Deletion and retention
- Crons: `vercel.json` schedules `/api/media/sweep/cron` (03:00), `/api/retention/sweep/cron` (04:00), `/api/marketing/sync` (every minute). All three require `Authorization: Bearer $CRON_SECRET`, and the sweep crons also need their own secret (`MEDIA_SWEEP_SECRET`, `RETENTION_SWEEP_SECRET`); missing env fails closed (`media/sweep/cron/route.ts:35-45`, `retention/sweep/cron/route.ts:39-52`). The proxy lists exact machine paths public (`proxy.ts:44-61`).
- Sweep coverage (`packages/payload/src/retention/sweep.sql`): `tutor_sessions` and `session_transcripts` at 30 days (:68-69), version shadows (:25-64), `safety_events` 90 days (:107-111), `incident_reports` except legal hold (:142-146), homework crop nulled after 7 days (:167-169). Not swept: `tutor_messages` (H5), homework text and submissions (no clock by design, ADR-125), session summaries (own class, by design). Media files: Bunny storage sweep, 7 days (`media/sweep/route.ts`, `MEDIA_TTL_DAYS`); Stream videos by schedule.
- Homework images: the 7-day clock covers Bunny objects and the `crop` column. The raw image sits under `image/<owner>/...`; for school (org) accounts the key has no learner segment, so per-child erase is refused and the 7-day sweep is the only remover (`presign.rules.ts:79-100`).
- Tutor audio: `audio/<owner>` prefix, same 7-day sweep.
- User-initiated delete: `POST /api/account/delete` (`apps/web/app/api/account/delete/route.ts:35-62`) deletes the account and its wards, and `POST /api/account/learners/delete` deletes one child. Collections cascaded: `account-deletion.repository.ts:95-131` (tutorSessions, sessionTranscripts, tutorMessages, studentModelFacts, safetyEvents, tutorEngagements, enrollments, assignment-completions, handoff-codes, homework*, consents, guardianships) plus summaries, incidents (holds counted and kept, :283-341), edu schema, media prefix, Better Auth user. Not in the cascade list: `families` and `leads` (CRM, text pointers by design, `Families.ts:13-14`) and Payload `users` row gradeBand (id-keyed). Org-scoped media is not erased (reported to the user).
- Legal hold: incidents under hold survive deletion (by design).

### 5. Sentry child privacy
- `packages/app/core/telemetry-scrub.ts:154-229`: masks `message`, `logentry` (params deleted), exception values (frame `vars` deleted), breadcrumb messages (data deleted), request url query-stripped, request `data/cookies/headers/query_string/env` deleted, spans' query stripped, contexts allowlisted with device name removed, `user/extra/server_name` deleted. Client masks with `dropText`; server uses `maskTelemetryText` (`apps/web/sentry.server.config.ts:64-73`).
- `telemetryInitOptions` (`packages/app/core/telemetry-options.ts`, `telemetryInitOptions` body): `sendDefaultPii:false`, `tracesSampleRate:0`, `enabled` only in production with a DSN. No replay; mobile `attachScreenshot:false` (`apps/mobile/src/telemetry.ts:68`).
- Gaps (all residual): event `tags` and `transaction` name are not scrubbed (tags set here are the allowlisted `surface`, `runtime`, `queue`, `jobId`: `apps/web/lib/jobs.ts:249-252`). The URL path is kept, so route params such as `/api/guardian/reports/<sessionId>` and `/api/homework/submissions/<id>` reach Sentry (ids, no content; `submissionId` is a client UUID). `captureRequestError` (`apps/web/instrumentation.ts:34`) goes through the same `beforeSend`. Native crash payloads on mobile and `extra` set by the SDK are outside what a JS `beforeSend` can prove.
- Transcript text and image URLs: error messages are masked before send; no code path attaches a transcript to a Sentry call (`rg captureException|setExtra|setContext` shows only `report-error.ts:31` and jobs tags). Image URLs appear in request URLs only for `/api/media/view?url=` and the query is stripped.
- Console on the tutor path: no `console.*` of learner content in `apps/web/app/api/tutor`, `packages/app/features/tutor` (only avatar/XR timing and model-load logs, mostly `__DEV__`), `homework`, `summary`. Server logs carry ids and verdicts only (`apps/web/lib/safety-event.repository.ts:135-140`, `homework` `_ports.ts:38-45` logs ids and reasons).

### 6. Marketing routes
- `apps/web/app/api/marketing/inquiries/route.ts`: unauthenticated by design, public path in the proxy (`proxy.ts:35`). Origin: `marketingPublicContext` requires an allowlisted origin (`marketing.permissions.ts:142`, default `https://www.moyolearn.com`); CORS echoes only an allowed origin else `'null'`. Body: content-type must be JSON and a streaming 8 KB cap (`packages/app/marketing/services/marketing.service.ts:28-62`). Rate limit: HMAC of `x-vercel-forwarded-for` plus day, 5 attempts per hour in Postgres (`marketing.repository.ts:98-104`). Origin check is only a browser control (a script can send any Origin); the per-IP limit is the real control and collapses to one shared bucket (`'unknown'`) when the Vercel header is absent. Fails closed 503 if `MOYO_MARKETING_RATE_SECRET` is unset. Touches adult business leads only; no family data. No honeypot or captcha.
- `apps/web/app/api/marketing/sync/route.ts`: `marketingCronContext` demands `Bearer $CRON_SECRET`, fails 401 (`marketing.permissions.ts:162-168`); logs state counts only.
- `packages/payload/src/collections/Users.ts:29-32`: update and delete go through `marketingIdentityAccess` (permissions.ts:49-65): the allowlisted sales ids cannot be changed or deleted by other staff, and you can still edit yourself. Read and create keep Payload defaults (any authenticated staff). Fail-open when the allowlist env is unset (L5).

### 7. Safety ladder
- Ladder: `packages/safety/src/ladder.ts:98-129`: S3 files an incident, `notifiesGuardian` true, SLA 48h; S4 files, notifies, pages, safe mode, SLA 2h. `escalate` climbs S1 to S2 to S3 on repetition (:205-227). `incident.service.ts:56-63` saves, then `fanOut`; legs enqueue to protected queues (`jobs.ts:362-384`).
- Delivery: marker only (H1). The guardian screen reads `incidentReports` where `guardianVisible` for active wards (`apps/web/lib/incident.repository.ts` `loadGuardianIncidents`); `guardianVisible` derives from tier and category (`packages/safety/src/incidents.ts:210,286,356`).
- Summary: re-classification, not incident lookup (H2).

## Cannot be verified statically

1. Contents of `secure_store_backup_rules.xml` and `secure_store_data_extraction_rules.xml`, and whether prebuild creates them (M2).
2. Whether the output classifier flags the same turns the input ladder files as S3 (H2). `tutor-safety.ts:102` holds the classifier; behavior needs a red-team run.
3. Live DB state: grants for `anon`/`authenticated` on `payload.*` and `edu.*`, whether `payload` is in PostgREST exposed schemas, whether `tutor_sessions` has RLS, whether `tutor_messages` has an FK or cascade, which role `DATABASE_URL` uses.
4. Whether Better Auth's default rate limiter is active in production, its storage, and whether it covers the custom `/api/handoff/redeem` route (M4).
5. Vercel env: presence of `CRON_SECRET`, `MEDIA_SWEEP_SECRET`, `RETENTION_SWEEP_SECRET`, `JOBS_DRAIN_SECRET`, `MOYO_MARKETING_RATE_SECRET`, `MOYO_MARKETING_ADMIN_IDS`, `BUNNY_PULL_ZONE_TOKEN_KEY`; and that no build sets `NEXT_PUBLIC_AUTH_MODE=mock`.
6. Whether the Bunny pull zone actually refuses unsigned reads (H4's blast radius).
7. Sentry-side settings (IP storage off, inbound filters, rate limits): listed as a manual checklist in `telemetry-options.ts:22-46`, some unchecked.
8. EAS build output: that the shipped release bundle carries `EXPO_PUBLIC_AUTH_MODE=live`, and what the native Sentry layer sends on a native crash.
9. `createManagedLearner` internals beyond the route (consent record validation depth), and the `teacher`, `business`, `share`, `safety`, `progress`, `memory/erase`, `memory/forget-all`, `learner/*` and `chemistry` routes (not read line by line).
10. Dependency CVEs (no `npm audit`, install not run).

No fixes were applied. No clones were made, so none to delete.

## Status after lane C2 (2026-11-25)

PR #159 fixes H1, H2, H4 and H5 and the M7 error-message leak. H3 (consent from the request body) is assigned to the front-door branch and is still open.

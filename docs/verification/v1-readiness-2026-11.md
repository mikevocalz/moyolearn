# v1 readiness evidence

Started 2026-11-25. Verifier lane F signs each line only against device evidence: a recording or screenshot from a release build on a physical device against the deployed backend at `https://app.moyolearn.com`. Source review, green builds and owner-reported test counts are recorded separately and never tick a box.

## Device state on 2026-11-25

Observed with argent `list-devices` and `adb devices -l`: no Quest, no Android phone. Mike's iPhone 17 Pro (iOS 27.0.1) is paired over local network only, tunnel disconnected, so it cannot be driven. One Android AVD exists and is not running. Devices are tested last by Mike's instruction, so every device line below is open.

The deployed backend answered: `/api/health` 200 with `{"ok":true}`, `/api/auth/ok` 200, `/api/users/me` 401 unauthenticated. The pricing page shows Moyo Plus $14.99/mo, Moyo Family $24.99/mo for up to three children, $11/mo per additional child, 30-day trial with a card.

## Phone, deployed backend, release build

- [ ] New parent: signup to trial started, with consent recorded.
- [ ] Child reaches their first problem without typing credentials.
- [ ] Sheet with problems 1 to 3 marked done opens on problem 4.
- [ ] Blank sheet opens on problem 1; fully marked sheet shows all-done.
- [ ] Child completes two problems with Natalie, with voice and captions.
- [ ] Parent sees the session summary; marked problems are not credited.
- [ ] Unsafe input triggers the ladder and a parent incident report.
- [ ] Lapsed subscription gates correctly; restore works.
- [ ] A second family cannot see the first family's data.
- [ ] VoiceOver and TalkBack pass on the parent path.
- [ ] iOS and Android both run the list above.

Source findings that will fail these lines before a device is touched (lane C, read from `integrate/v1-main-20261125`):

- Signup does not create an account. `packages/app/features/onboarding/guardian-onboarding-content.tsx:155-167` stores `draft.email` and never calls `authClient.signUp`. No OTP, forgot or reset route exists under `apps/mobile/app`; `packages/auth/src/server.ts:356-381` has no `emailOTP` plugin.
- Consent is in memory. `packages/app/features/onboarding/consent/consent.store.ts:70` defaults to `createDevConsentChannel()`; nothing stores or verifies consent server-side.
- A credential-free persona hatch ships. `apps/mobile/app/onboarding/dev.tsx:17-27` mounts `DevPersonaSwitch` with no `__DEV__` or auth-mode gate and is registered in `apps/mobile/app/_layout.tsx:188`. Fixed in PR #160, with signup, forgot and reset password, server-verified consent, and a CI job that greps the Android release export for mock-auth strings.
- Mock auth is the default mode (`packages/app/providers/session/auth-mode.ts:16-22`); release builds are live only because `apps/mobile/eas.json` sets `EXPO_PUBLIC_AUTH_MODE=live`. The mock provider and personas are statically imported and ship in every bundle.
- Prices disagree. `packages/app/features/paywall/paywall.data.ts:32,41` shows $11 and $15.99; `org-settings.data.ts:26-30` adds $19, $99, $299; the marketing site shows $14.99 and $24.99. `packages/ui/PlanCard.tsx:58,77,91` accepts a `tier` prop and ignores it. Fixed in PR #158 (stacked on #157): one catalogue in `packages/auth/src/plan-catalog.ts`, `PlanCard` scoped by `{context, tier}` with a learner context rendering nothing. Open after #158: no Stripe price id for Plus exists (`STRIPE_PRICE_PLUS` unset), business tier prices are unverified, and no paywall screenshot has been taken.
- Entitlements model `active | trialing | past_due | canceled | incomplete | none` (`packages/auth/src/subscription-reader.ts:37-46`); no expired or restoring state, `cancelAtPeriodEnd` unread. Fixed in PR #158: `entitlementStateOf` derives `none | trial | active | cancel-at-period-end | past-due | lapsed | restored` from status and dates, and `resolveEntitlement` picks the governing row where `subscriptionFor` used to return the first. Learner surfaces correctly render nothing when gated (`gate-decision.ts:36-58`, 7 tests).
- Incident fan-out is an in-app timeline marker only (`apps/web/lib/jobs.ts:214-234`); no push or email reaches the parent. Summaries re-classify text by regex (`summary.service.ts:354-394`) instead of reading `incidentReports`. Fixed in PR #159 (stacked on #157): the guardian job emails every active guardian with category, time and an `/alerts` link and no session text, and `generateSessionSummary` drops the turns an S3 or S4 incident names before extracting evidence. The same PR closes the media-view ownership gap and sweeps expired `tutor_messages`. PR #160 closes the consent gap.
- Homework path is wired: upload with `crop: null` (`capture-screen.tsx:622-623`), guardian marks via `revisePriorWork` under `FOR UPDATE` (`apps/web/lib/homework.repository.ts:494-546`), one `nextUndoneIndex` rule for create, start and advance, all-done state at `tutor-screen.tsx:998-1008`, summary exclusion in `homework-rows.ts:31,60,113-118`. Voice is one id from `ELEVENLABS_VOICE_ID` with a 204 text-only fallback (`apps/web/app/api/tutor/voice/route.ts:86-87`).

## Quest 3 or 3S, controllers powered off and unpaired

- [ ] Cold launch to inside the Tutor Room with hands only.
- [ ] The child's current homework problem is on the board.
- [ ] Continuous handwriting by fingertip, and by ray pinch.
- [ ] Every tray action, voice ask, recenter, exit and re-enter.
- [ ] Tracking loss and system gesture mid-stroke leave no stuck ink.
- [ ] Left-handed and one-handed passes.
- [ ] Frame pacing recorded while drawing.
- [ ] PICO build compiles and controllers still work.

Source findings (C++ review of virocore #121 head `3674d1cd`, `android/sharedCode/src/main/cpp/VROInputControllerOpenXR.cpp`):

- The pinch metric can switch between aim strength and joint distance mid-press when `XR_HAND_TRACKING_AIM_VALID_BIT_FB` flickers, because both feed one `_handPinch[hand]` state (lines 794-869). This can emit a spurious up or down and jumps the ray origin.
- `VROHandPinchState` starts armed, so a hand that first appears pinched fires down at once; session start and `setHandTrackingEnabled(true)` never pass through re-arm.
- One invalid frame cancels and disarms, so there is no stuck ink but a stroke breaks on a single tracking flicker. Policy decision needed.
- The host test file has no CMake wiring and its `assert`s vanish under `NDEBUG`.
- Hand input moved from source ids 0/1 to 13 to 16; any consumer filtering on the old ids loses hands. PICO's use of this controller is unverified.
- Direct touch is not implemented. Seams: `processHands` already reads `XR_HAND_JOINT_INDEX_TIP_EXT`; `dispatchSide` in `onProcess`; `queueButtonEvent`, `rayForSource`; `cancelHand` as the single tracking-loss choke point.

## Repo

- [ ] All three lines on `main`; CI green; migrations applied and recorded.
- [ ] No open draft PR holds v1 work.

Progress: the three lines plus the billing release line are merged on `integrate/v1-main-20261125` at `1457ff92` (record in `docs/verification/v1-integration-2026-11.md`). The sales-inquiry commits ship with the line; the two family exposures are closed by `c5193fe2` and `dfbe5b29` (decision in the integration record). The merge to `main` waits on CI. Migrations have run only against a local scratch Postgres (lane B record). PRs #153, #154, #155 and virocore #121 remain open drafts.

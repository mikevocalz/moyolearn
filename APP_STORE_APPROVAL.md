# App Store submission audit — Moyo

Audited 2026-09-13 · branch `feat/spatial-whiteboard-xr` @ `6e5707b` · **2 HARD BLOCK · 7 LIKELY REJECTION · 8 RISK FLAG**

Guidelines verified against the June 8, 2026 App Review Guidelines. Re-verify at
<https://developer.apple.com/app-store/review/guidelines/> before submitting.

**The gate does not pass.** It passes only at zero HARD BLOCKs.

## How this was produced

`npx expo prebuild --platform ios --clean` ran in a scratch git worktree at
`/private/tmp/claude-501/-Users-mikevocalz/c1b3c2d3-f6a4-424b-be82-f48c7f4949e8/scratchpad/ios-scan`,
never inside the repo. It exited 0. `bash ~/.claude/skills/app-store-approval/scripts/run_all.sh`
then ran against that generated `ios/` directory, and every finding below is traced back to the
source file that produces the behaviour — `apps/mobile/app.config.ts`, a config plugin, or a
`packages/*` module. Nothing cites a generated file as its cause.

The prebuild ran against committed `6e5707b`. Every JS finding was read from the **working tree**,
which at audit time carried uncommitted XR changes from other agents in
`packages/app/features/tutor/xr-*`, `packages/ui/xr/*` and `apps/mobile/app/(learner)/*`. Re-check
the XR findings (RISK FLAG 10) once those land.

Toolchain on this machine: Xcode 26.4.1, iOS 26.4 SDK. That clears the April 28, 2026 minimum
(iOS 26 SDK / Xcode 26+). CI must match — see the checklist.

Two scan results were corrected after reading the evidence:

- The scan reported `[HARD BLOCK] ITMS-91061 :: hermes ... no bundled PrivacyInfo.xcprivacy`.
  Pods were not installed in the scratch tree, so the `hermes-engine` pod's own manifest was not
  on disk to find. React Native 0.86 does ship manifests (`node_modules/react-native/React/Resources/PrivacyInfo.xcprivacy`,
  `ReactCommon/cxxreact/PrivacyInfo.xcprivacy`) and `apple.privacyManifestAggregationEnabled: "true"`
  is set in the generated `Podfile.properties.json`. Dropped as unsupported. The vendored Viro fork
  is a different matter — see LIKELY REJECTION 7.
- The scan reported `no third-party AI endpoints detected` and `no account-creation flow detected`.
  It scanned only `apps/mobile/`; the AI egress and the auth stack live in `packages/inference`,
  `packages/voice` and `packages/auth`. Both are findings, raised by hand below.

---

## HARD BLOCK

### 1. 5.1.1(v) — no in-app account deletion, for any role

**Evidence:**
- `packages/app/features/settings/settings-content.tsx:139-148` — the Session card offers `Sign out` and nothing else. The comment states the position outright: *"no 'Delete account' button: it was a dead control (onPress={() => {}}), and FD-26 — the deletion flow this contract's exit is declared against — is MISSING."*
- Accounts are created for guardians, teachers, tutors, school admins and district staff through `packages/auth/src/server.ts:162` (`emailAndPassword: { enabled: true }`), and for learners through `packages/auth/src/create-managed-learner.ts:23`.
- A repo-wide grep for `deleteAccount|delete-account|deleteMyAccount` returns only `packages/auth/src/payload-learner-writer.ts:33` and `create-managed-learner.ts:69`, both of which are the *rollback* path for a failed learner creation, not a user-initiated deletion.
- `packages/app/core/protected-operation.ts:215` exports `protectedOperation`, the required server-side gate. No deletion service calls it.

**Why:** Since June 30, 2022 an app that lets a user create an account must let them initiate deletion of that account from inside the app, and it must be a real server-side deletion, not a sign-out or a support-email link. Reviewers test this by hand. A children's product makes it worse: COPPA gives the guardian a right to delete the child's record, and the consent screen already promises it — `packages/app/features/onboarding/consent/consent-flow-content.tsx:82` tells the guardian *"you can withdraw it any time from the family screen."* There is no such control.

**Fix:** Build FD-26. One entry point per role that can sign in — guardian, teacher, tutor, school admin, district, and the guardian-initiated path for each managed learner. Route it through `protectedOperation` with `requires: 'write'`, cascade to Payload collections (`Consents`, `SessionTranscripts`, `StudentModelFacts`, `TutorSessions`, `SafetyEvents`, `Guardianships`) and to Better Auth's user/session/account rows, and confirm the erasure sweep reaches the versions tables. `packages/payload/src/collections/Consents.ts:29` already documents why `versions: false` matters here: a shadow row survives its own deletion. Surface the control in `settings-content.tsx` beside Sign out, and on the family screen for each child.

**Source:** <https://developer.apple.com/support/offering-account-deletion-in-your-app/>

### 2. 3.1.1 — subscription prices and a trial CTA ship on iOS with no in-app purchase anywhere

**Evidence:**
- `packages/app/features/paywall/paywall.data.ts:32` `monthly: '$11/month'`, `:41` `monthly: '$15.99/month'`.
- `packages/app/features/paywall/paywall-content.tsx:64-66` renders the price; `:84-89` renders `Start {n}-day free trial` as the screen's one primary action.
- `packages/app/features/onboarding/guardian/guardian-onboarding-content.tsx:163` mounts `PaywallContent` as the `plan` step of guardian onboarding, which is step 7 of `GUARDIAN_STEPS` (`packages/app/features/onboarding/guardian/steps.ts:26`) and runs in the mobile binary via `apps/mobile/app/onboarding/[flow].tsx`.
- A repo-wide grep for `StoreKit|react-native-iap|expo-in-app-purchases|react-native-purchases|requestSubscription` returns zero matches outside `node_modules`.
- Billing is Stripe, server-side: `packages/auth/src/server.ts:279` (`stripePlugin`), gated on `STRIPE_SECRET_KEY`.
- The trial CTA is also inert on device. `guardian-onboarding-content.tsx:163-166` passes `onStartTrial={complete}` and `onContinueFree={complete}` — both buttons advance the same step. No subscription is created by the tap.
- `packages/app/features/settings/settings-content.tsx:114-130` hides the "Manage plan" row on native because `managePlanHref` is web-only, so there is no billing surface in the app either.

**Why:** Two separate rejections in one screen. 3.1.1 requires that unlockable app features be purchased through in-app purchase; displaying subscription pricing and a purchase-shaped CTA while collection happens on the web is the pattern Apple rejects most often in this section, and the paywall's own entitlements (`packages/auth/src/entitlements.ts:80`) gate `write` and `practise` on that subscription. Separately, 2.1 covers controls that do nothing: a button reading "Start 30-day free trial" that only advances an onboarding step is an incomplete feature in a submitted build.

**Fix:** Pick one and make it true in the binary.
- Ship IAP: add StoreKit 2 (or `expo-iap`), create the matching auto-renewable subscriptions in App Store Connect, wire the receipt to the entitlement reader in `packages/auth/src/subscription-reader.ts`, and add Restore Purchases — 3.1.2 requires it. The paywall also needs the seven required elements (title, duration, full renewal price as the most prominent price, what the subscription provides, Terms, Privacy, Restore); today it carries duration, price and cancellation copy, and is missing Terms, Privacy and Restore.
- Or remove prices and the trial CTA from the iOS build entirely and let the guardian subscribe on the web. Sign-up must not link out to the purchase; 3.1.3(b) multiplatform allows the app to honour a subscription bought elsewhere, but not to advertise or link to it.

**Source:** <https://developer.apple.com/app-store/review/guidelines/#in-app-purchase>

---

## LIKELY REJECTION

### 3. 2.3.1 / 2.1 — `moyo://onboarding/dev` opens a QA persona switcher in a release build

**Evidence:**
- `apps/mobile/app/onboarding/dev.tsx:22` renders `<DevPersonaSwitch />` with no `__DEV__` guard.
- `packages/app/features/onboarding/dev-persona-switch.tsx:6` claims the opposite: *"It is gated by `__DEV__` everywhere it is mounted, so it cannot ship."* That is true of the only other mount — `packages/app/features/onboarding/public-entry-content.tsx:79` wraps it in `{__DEV__ ? ... : null}` — and false of the route.
- The screen renders a heading reading `Development only` in the danger colour (`dev-persona-switch.tsx:41-43`) over eleven fixture personas from `packages/app/fixtures/personas.ts`, and `apply()` (`:26-36`) writes a persona into the live session store and navigates into that role's shell.

**Why:** 2.3.1 forbids hidden or undocumented features; 2.1 forbids shipping placeholder and internal content. A screen that announces itself as development-only and lets the holder enter any role's shell is both. The route is reachable by URL in a release build because `scheme: 'moyo'` (`apps/mobile/app.config.ts:13`) is registered for release and Expo Router mounts every file under `app/`.

**Fix:** Guard the route body: `if (!__DEV__) return <Redirect href="/" />;`, or move the file behind a `+dev` exclusion so it is not bundled. Then delete the docstring claim at `dev-persona-switch.tsx:6` or make it true.

**Source:** <https://developer.apple.com/app-store/review/guidelines/#accurate-metadata>

### 4. 5.1.1 / ITMS-90683 — every purpose string is a framework default, authored nowhere in this repo

**Evidence:**
- `apps/mobile/app.config.ts:21-31` — the `ios` block sets `bundleIdentifier`, `supportsTablet` and `usesNonExemptEncryption`. There is no `infoPlist` key, so the repo authors no purpose string except Face ID (`app.config.ts:164`).
- The prebuild output carries `NSCameraUsageDescription = "Allow $(PRODUCT_NAME) to access your camera"`, `NSMicrophoneUsageDescription = "Allow $(PRODUCT_NAME) to access your microphone"`, `NSPhotoLibraryUsageDescription = "Allow $(PRODUCT_NAME) to access your photos"`. Those exact strings come from `expo-image-picker`'s auto-applied config plugin (`node_modules/expo-image-picker/plugin/src/withImagePicker.ts`), which `packages/app/package.json:41` pulls in. They are defaults nobody chose.
- The camera is used for two distinct things and names neither: homework capture through `react-native-vision-camera` at `packages/app/features/capture/guided-frame.native.tsx:11`, and — on this branch — ARKit world sensing to place the board in the room, through `packages/app/features/tutor/tutor-xr-screen.native.tsx`.
- The microphone records a child's voice note (`packages/ui/audio/VoiceRecorder.native.tsx:5`, `react-native-audio-api`'s `AudioRecorder`).

**Why:** 5.1.1 requires the string to name the feature and why the data is needed. Generic template strings are among the most common metadata rejections, and on a children's app the reviewer reads them as the parent would. `$(PRODUCT_NAME)` also renders as the literal target name rather than the display name in some contexts.

**Fix:** Author them in `apps/mobile/app.config.ts` under `ios.infoPlist`, where a config-plugin default can no longer win:

```ts
ios: {
  bundleIdentifier: 'com.moyolearn.app',
  supportsTablet: true,
  config: { usesNonExemptEncryption: false },
  infoPlist: {
    NSCameraUsageDescription:
      'Moyo uses the camera so your child can photograph a homework page for the tutor to read, and — on supported devices — to place their whiteboard on a real surface in the room.',
    NSMicrophoneUsageDescription:
      'Moyo uses the microphone so your child can record a voice note instead of typing. It is transcribed on this device.',
    NSPhotoLibraryUsageDescription:
      'Moyo opens your photo library so your child can attach a picture of work they already photographed.',
  },
},
```

Note that `tooling/check-copy-law.mjs` cannot vet these. Its scan scope is `apps/web-vite/src` only (`tooling/check-copy-law.mjs:33`), the marketing site. Running it today prints `copy-law OK — 60 site files carry no banned promise` and says nothing about the plist. If the purpose strings should be under copy law, the check needs a second scan root.

**Source:** <https://developer.apple.com/documentation/bundleresources/information-property-list/protected-resources>

### 5. 5.1.2(i) — no consent names the third parties that receive a child's homework, board and words

**Evidence:**
- Homework photographs leave the device as base64 JPEG: `packages/app/features/capture/photograph-for-model.native.ts:54-62` → `TurnImage` → `packages/inference/src/anthropic.ts:167-171`, an Anthropic `image` source block. `packages/inference/src/types.ts:55-60` states the residual risk plainly: *"a photograph of a page with a child's name written at the top sends that name."*
- Board PNG exports travel the same road: `packages/app/features/tutor/board-image.native.ts:24-44` writes the board to a cache file so `photograph-for-model.native` can encode it, and `packages/app/features/tutor/tutor-screen.tsx:814-840` stages it as a tutor attachment.
- The child's typed and transcribed words go out as `InferencePayload.message` (`packages/inference/src/types.ts:75-80`) to `claude-opus-5` (`packages/inference/src/routing.ts:60`).
- The consent notice names data categories but no recipient. `packages/auth/src/consent-flow.ts:32-45` lists *"What your child types, says, and uploads while working with the tutor"* with the reason *"So the tutor can help with the actual problem in front of them."* No vendor, no "sent to a third-party AI model", nothing about where the photo goes.
- `packages/auth/src/consent-flow.ts:65-68` sets `DEFAULT_CONSENT_ENVIRONMENT = { disclosesToThirdParties: false }`, and `availableMethods` (`:70-78`) unlocks text-plus consent on that flag. The file's own comment at `:56-59` says the flag exists so that *"the day someone adds a disclosure, the method turns itself off instead of quietly staying legal-looking."*

**Why:** 5.1.2(i) requires explicit permission before personal data is shared with a third party, and App Review has been applying it to hosted-model calls since the 2025 guidance. A disclosure that describes the data but not the recipient is not that permission. Whether a model vendor acting as a service provider counts as "disclosure" under COPPA is a separate legal question; Apple's requirement is independent of it.

**Fix:** Add the recipient to `CONSENT_DISCLOSURES` in `packages/auth/src/consent-flow.ts` and bump `CONSENT_POLICY_VERSION` (`:314`), which makes `needsReconsent` (`:321`) re-ask every existing guardian. Then reconcile `disclosesToThirdParties` with the facts: either set it `true` and let `availableMethods` withdraw text-plus as designed, or document in the same file why a service-provider call is excluded from that flag. Whichever way, the guardian must see the vendor named before the first turn leaves.

The containment tooling is worth keeping and worth not over-reading. `tooling/check-voice-egress.mjs` proves nothing learner-authored reaches ElevenLabs, and `tooling/check-no-training-path.mjs` proves no training pipeline reads the educational store (and prints that it is currently vacuous). Both bound what is shared. Neither is consent.

**Source:** <https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing>

### 6. 5.1.1(i) — the privacy policy and terms are not reachable from inside the app

**Evidence:**
- `packages/app/features/onboarding/onboarding-content.tsx:156` and `:161` render `I agree to the Terms of Use` and `I agree to the Privacy Policy` as `Switch` **labels**. They are text, not links.
- A repo-wide grep for `Linking.openURL`, `WebBrowser.open` or any `Linking.` call across `packages/` and `apps/mobile` returns zero matches. Nothing in the app opens either document.
- The documents exist on the marketing site: `apps/web-vite/src/routes/privacy.tsx`, `terms.tsx`, `childrens-privacy.tsx`.

**Why:** 5.1.1(i) requires a privacy policy link that is accessible in the app. Asking a guardian to agree to a document they cannot open is also the kind of consent failure a reviewer flags on a children's product without needing the guideline.

**Fix:** Make both labels tappable and open the live URLs, plus add a persistent Legal row in `settings-content.tsx` so the policy is reachable after onboarding. On a children's app, route the tap through the same grown-up verification the profile switcher already uses (`packages/app/features/switch-profile/profile-switcher.tsx:84-88`) so a learner cannot be dropped into an external browser — see RISK FLAG 12.

**Source:** <https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage>

### 7. ITMS-91061 — the vendored Viro fork ships no privacy manifest, and it is ours to ship

**Evidence:**
- `apps/mobile/package.json:22` depends on `"@reactvision/react-viro": "3.0.0-moyo.1"`, resolved from `vendors/reactvision-react-viro-3.0.0-moyo.1.tgz` (52 MB).
- `find node_modules/@reactvision/react-viro -name 'PrivacyInfo.xcprivacy'` returns nothing. The package ships two podspecs (`ios/ViroReact.podspec`, `ios/ViroReactUI.podspec`) and no manifest in either.

**Why:** ITMS-91061 rejects an upload when a listed SDK is embedded without a bundled, signed privacy manifest. The published `@reactvision/react-viro` is not currently on Apple's 86-SDK list, so this is not automatic — but a fork we build and vendor ourselves is our responsibility regardless. ViroCore touches ARKit, the camera and the file system, and the aggregated app manifest has to account for it.

**Fix:** Add `PrivacyInfo.xcprivacy` to the fork's `ios/` directory and list it in the podspec's `resource_bundles`, declaring at minimum `NSPrivacyAccessedAPICategoryFileTimestamp` and `NSPrivacyAccessedAPICategoryDiskSpace` if the renderer reads either, with `NSPrivacyCollectedDataTypes` empty and `NSPrivacyTracking` false. Cut a new `3.0.0-moyo.2` tarball into `vendors/` and record the change in `vendors/README.md`. This is not urgent until the XR route is actually shippable (see RISK FLAG 10), but it blocks that route when it is.

**Source:** <https://developer.apple.com/support/third-party-SDK-requirements/>

### 8. ITMS-91053 — the app's privacy manifest has no source, and `expo prebuild --clean` deletes it

**Evidence:**
- `apps/mobile/ios/Moyo/PrivacyInfo.xcprivacy` is committed (`git ls-files apps/mobile/ios` lists 23 files including this one) and correctly declares UserDefaults `CA92.1`, FileTimestamp `0A2A.1/3B52.1/C617.1`, DiskSpace `E174.1/85F4.1` and SystemBootTime `35F9.1`.
- Those declarations match what the binary uses: `react-native-mmkv` (`apps/mobile/package.json:49`) writes through `NSUserDefaults`; `expo-file-system` reads timestamps and free space on the upload path (`packages/app/features/media/transport.native.ts:16`); `@sentry/react-native` (`apps/mobile/package.json:23`, initialised at `apps/mobile/src/telemetry.ts:58`) reads system boot time.
- Nothing in source regenerates it. `apps/mobile/app.config.ts:44-168` registers ten plugins and none writes a privacy manifest; `apps/mobile/plugins/` contains only `with-webgpu-min-sdk.js`.
- Proved by running the prebuild: after `expo prebuild --platform ios --clean`, `ios/Moyo/PrivacyInfo.xcprivacy` does not exist in the generated tree. The committed copy is the only copy.

**Why:** ITMS-91053 is an upload-time rejection — nothing reaches review. It does not fire today, because `ios/` is tracked in git and EAS Build uses the committed directory as-is. It fires the moment anyone runs a clean prebuild, and the diff that would show it is one deleted file in a directory people skim.

Two smaller symptoms of the same root cause: the committed `Info.plist:64` carries `RCTNewArchEnabled` and the regenerated one does not, and `Moyo.entitlements` is an empty dict in both. The committed `ios/` and the config have already drifted.

**Fix:** Write a config plugin at `apps/mobile/plugins/with-privacy-manifest.js` using `withInfoPlist`/`withDangerousMod` to emit `PrivacyInfo.xcprivacy` and register it in `app.config.ts` plugins, so a clean prebuild reproduces it. Then decide whether `ios/` stays committed at all — either is defensible, but the current hybrid means the config is not the source of truth and nobody can tell which file wins.

**Source:** <https://developer.apple.com/documentation/bundleresources/privacy-manifest-files/describing-use-of-required-reason-api>

### 9. 2.1 — two engineering harness routes ship in the release bundle

**Evidence:**
- `apps/mobile/app/natalie-3d.tsx` — `moyo://natalie-3d`, an avatar stage with a `mounting…` status readout and no session around it. The header (`:9-12`) states it is deep-link-only *"so the ADR-111 gate can be run on the demo phone."*
- `apps/mobile/app/native-3d-smoke.tsx` — `moyo://native-3d-smoke`, a raw WebGPU harness. Its header (`:5-7`) says *"a child must never be one mis-tap away from a rotating debug cube."*
- Neither is wrapped in `__DEV__`. Both are lazy-loaded, which keeps the boot cost off other routes but does not keep the routes out of the bundle.

**Why:** 2.1 covers internal and demo content in a submitted build. The risk of a reviewer finding these is lower than the persona switcher — there is no link to them — but they are non-production surfaces in a shipped children's app, and the second one renders a debug cube.

**Fix:** Same treatment as finding 3: `if (!__DEV__) return <Redirect href="/" />` at the top of each route body, so the evidence workflow still works on a development build and neither is reachable in release.

**Source:** <https://developer.apple.com/app-store/review/guidelines/#app-completeness>

---

## RISK FLAG

### 10. The XR entry is correctly hidden, and the Viro plugin is not registered

The rule for this branch is that the spatial whiteboard ships only when the device acceptance test is green, and until then the capability check removes the button — a switch that reveals a half-working mode is a 2.3.1 hidden feature. Both halves currently hold, for reasons worth writing down.

The gate works. `packages/app/features/tutor/xr-capability.ts:26-32` returns true only when `NativeModules.VRTSceneNavigatorModule` exists, fails closed on unknown, and `packages/ui/XrBoardButton.tsx:60` returns `null` when `available` is false. `packages/app/features/tutor/tutor-screen.tsx:946` passes `available={canOpenSpatialBoard()}`. No button, no route.

The acceptance test is not green — it does not exist. `qa/walkthroughs/` holds `DEMO-SMOKE`, `NATALIE-HUMAN` and `NATIVE-3D-SMOKE`, all dated 2026-09-03, and nothing for the spatial board.

And the feature cannot build on iOS today. `@reactvision/react-viro` is in `apps/mobile/package.json:22` but is **not** in the `plugins` array of `apps/mobile/app.config.ts:44-168`. Its plugin is what appends `pod 'ViroReact'` and `pod 'ViroKit'` to the Podfile (`node_modules/@reactvision/react-viro/plugins/withViroIos.ts:50-51`) and sets `EXCLUDED_ARCHS` for the simulator. The generated Podfile contains zero `Viro` lines and the generated `project.pbxproj` contains zero `EXCLUDED_ARCHS` entries. So the renderer is not linked, `VRTSceneNavigatorModule` does not exist, and the gate hides the button — the right outcome by accident rather than by design.

**Before the XR entry ships:** register the plugin with authored purpose strings, produce a device acceptance walkthrough under `qa/walkthroughs/`, fix finding 7, and confirm `UIRequiredDeviceCapabilities` still does not list `arkit` (see RISK FLAG 14).

### 11. 1.3 Kids — the Kids Category is the wrong home for this binary, and 1.3 still applies

Nothing in `apps/mobile/app.config.ts` declares an App Store category; that lives in App Store Connect. The recommendation is to **not** enter the Kids Category, because a Kids Category app must be designed for children throughout and this binary is not: it carries a teacher shell, a district shell, an org/ops shell with a CRM pipeline (`packages/app/features/ops/leads-board.tsx`), and billing.

That does not exempt the learner surfaces from 1.3. What the code shows:

- No third-party analytics or advertising SDK exists. Greps for firebase, amplitude, mixpanel, segment, posthog, appsflyer, adjust, admob and branch return nothing outside `node_modules`.
- The one third-party SDK on a learner's device is Sentry, and it is configured conservatively: `apps/mobile/src/telemetry.ts:68` sets `attachScreenshot: false` and `:69-72` runs every event through `scrubTelemetryEvent` (`packages/app/core/telemetry-scrub.ts`). Crash reporting with PII scrubbing is generally accepted; if the Kids Category is chosen after all, it has to be re-argued or removed.
- No PII is taken from the child directly. A learner has a username and no email (`packages/auth/src/server.ts:255-257`), the guardian enters the date of birth during onboarding, and every learner account is created by a guardian behind a verified consent record (`packages/auth/src/create-managed-learner.ts`).
- Verifiable parental consent is real and unusually well built. `packages/auth/src/consent-flow.ts` implements email-plus, text-plus, KBA and card; `startChallenge`/`verifyCode`/`confirm` enforce the two-contact "plus" step (`:195-197`); KBA sets are spent on failure so a child cannot grind the same four questions (`:207-240`); `packages/payload/src/collections/Consents.ts:33-35` makes records immutable. `packages/app/features/onboarding/guardian/steps.ts:26` puts `consent` before `children`, so no learner row exists without a record behind it.

The gap is finding 5 — consent that does not name where the data goes.

### 12. 1.3 — no parental gate, because nothing currently opens an external link

The app makes no external link from any surface: zero `Linking.openURL`, zero `WebBrowser` calls. There is nothing to gate today, which is why this is a flag and not a finding. Fixing finding 6 adds the first one. The grown-up verification already exists — `packages/app/features/switch-profile/profile-switcher.tsx:84-88` runs biometric or family-PIN verification behind the Grown-ups row, and `apps/mobile/app.config.ts:164` supplies the Face ID prompt. Route any new outbound link and any account action a learner can reach through it.

### 13. 2.1 — demo accounts exist but point at a seeded dev database

`qa/walkthroughs/ACCOUNTS.md` documents a full tenant × role × band roster: `walkthrough+family-guardian@moyolearn.test`, `walkthrough+teacher-1@…`, learner usernames `wt_bo_k2`, `wt_zuri_35`, and so on. Passwords live in `apps/web/scripts/seed-walkthrough.mts` only.

Two things to settle before submitting. The roster is created by `pnpm --filter web seed:walkthrough` — App Review needs accounts that work against the backend the *shipped binary* points at, not a local seed. And `packages/auth/src/server.ts:168` sets `requireEmailVerification: process.env.NODE_ENV !== 'development'`, so a reviewer signing up fresh hits a verification wall on an undeliverable `.test` address; the demo accounts must be pre-verified in production.

App Review currently tests on an iPad Air 11-inch (M3) and an iPhone 17 Pro Max. Provide one account per role — guardian, learner, teacher, tutor, school admin — with the learner reachable from the guardian's device via the handoff code path (`apps/mobile/app/handoff.tsx`), because a reviewer will not otherwise be able to log in as a child.

### 14. 2.5 — the device-capability and background-mode declarations are correct today

Verified in the prebuild output and traced to source:

- `UIRequiredDeviceCapabilities` is `[arm64]` only. It must stay that way. Adding `arkit` would make the app un-installable on every non-ARKit device for a feature that is optional by design.
- `UIBackgroundModes` is `[fetch]`, and it is used: `packages/app/features/media/upload-queue.native.ts:42` defines a background task that drains the upload queue, and `transport.native.ts:32` sets `sessionType: 'background'` so a voice note survives the guardian switching apps.
- `ITSAppUsesNonExemptEncryption` is `false`, declared in source at `apps/mobile/app.config.ts:29`. TestFlight will not stall on Missing Compliance.
- `ios.deploymentTarget: '17.0'` (`app.config.ts:104`), forced by `react-native-executorch`'s podspec. The generated `LSMinimumSystemVersion` of `12.0` is an Expo template artifact and is overridden by the deployment target; harmless, but do not read it as the floor.

### 15. 4.8 — Sign in with Apple is not required

Better Auth is configured with `emailAndPassword` (`packages/auth/src/server.ts:162`), `username()` for learners (`:255`), `organization()`, `multiSession()`, `haveIBeenPwned()` and `expo()`. No `socialProviders` block exists. The only Google reference is `packages/auth/src/restricted-account.test.ts:39`, which asserts that a managed learner account *cannot* link a Google provider. 4.8 is triggered by third-party or social login; there is none, so no privacy-preserving alternative is owed. If Google or Apple SSO is added later, 4.8 returns.

### 16. 1.2 — no learner-visible user-to-user content today

Teacher and class features carry assignments, rosters and reports, not messaging. `apps/mobile/app/(org)/(tabs)/inbox.tsx` re-exports `NotificationsScreen` with a different title (`packages/app/features/notifications/inbox-screen.tsx:7-9`) — system notifications, not a message thread. Greps for `sendMessage`, `directMessage` or `chat with` return nothing.

The one adjacent surface is Conference Room (`packages/app/features/conference/`), which admits participants to a live session and requires a qualifying guardian to be present (`conference.policy.ts:38-45`). There is no learner route to it — `apps/mobile/app/(learner)/` has no conference screen — so it is teacher-initiated and incomplete from the child's side. If free-text chat or a learner entry point lands, 1.2 applies in full: filtering, reporting, blocking, and a published contact for reports.

### 17. 4.7 — the whiteboard WebView is self-contained

`packages/ui/whiteboard-board.native.tsx:77` uses `react-native-webview`, and the header (`:3`) states the page is inlined HTML. `NSAllowsArbitraryLoads` is `false` in the generated ATS block. It loads no remote code and executes nothing downloaded, so the 4.7 mini-app rules and the 2.5.2 executable-code rules are both satisfied. The static scan's 4.7 flag was triggered by the presence of a JS runtime, not by dynamic loading. Keep it that way — if the board ever loads its page over the network, re-open this.

---

## SUBMISSION ARTIFACTS

Things that live in App Store Connect, not in the code. Nothing here has been confirmed by a human,
so every row is recorded as unverified.

| Item | Status |
|---|---|
| Demo credentials in App Review Information | **Roster exists (`qa/walkthroughs/ACCOUNTS.md`) but targets a seeded dev DB — unverified against production (2.1)** |
| In-app account deletion | **MISSING — HARD BLOCK 1 (5.1.1(v))** |
| In-app purchase for the family subscription | **MISSING — HARD BLOCK 2 (3.1.1)** |
| Privacy policy URL live and linked in-app | Pages exist at `apps/web-vite/src/routes/privacy.tsx` and `childrens-privacy.tsx`; **not linked in the app** — LIKELY REJECTION 6 |
| Terms of Use (EULA) link in the App Store Description | Unverified — required once a subscription ships (3.1.2) |
| Support URL with a working contact method | Unverified |
| Export compliance (`ITSAppUsesNonExemptEncryption`) | Declared `false` in source (`apps/mobile/app.config.ts:29`) |
| App Privacy labels | Unverified — must declare photos, audio, user content and diagnostics, and match `PrivacyInfo.xcprivacy` |
| Age rating questionnaire (5-tier, social-media questions mandatory from Sept 2026) | Unverified |
| iPad screenshots | Required — `supportsTablet: true` (`apps/mobile/app.config.ts:23`) |
| App icon 1024×1024 | Present (`apps/mobile/assets/images/icon.png`, emitted to `Images.xcassets/AppIcon.appiconset`) |
| Kids Category | Recommend **not** entering it — see RISK FLAG 11 |

---

## Manual review checklist

- [ ] Screenshots and description match the shipped build (2.3)
- [ ] Working demo account in App Review notes, one per role, tested on a cold install against production (2.1)
- [ ] Age-rating questionnaire answered under the 5-tier system; social feeds force 13+ from Sept 2026
- [ ] App Privacy labels match the actual data flows and `PrivacyInfo.xcprivacy` (5.1.1)
- [ ] Support URL is live and contains a real contact method (1.5)
- [ ] Privacy policy URL is live, and also linked inside the app (5.1.1(i))
- [ ] Terms of Use (EULA) link is in the App Store **Description** field (3.1.2)
- [ ] Built with the iOS 26 SDK / Xcode 26+, including on CI (ITMS-90725)
- [ ] Purpose strings name the feature, the benefit, and the data type (5.1.1)
- [ ] The paywall shows title, duration, full renewal price as the most prominent price, what is provided, Terms, Privacy, and Restore (3.1.2)
- [ ] Icon and app name use no other developer's brand (4.1(c))
- [ ] Export compliance answered — TestFlight is not stuck on "Missing Compliance"
- [ ] Every IAP has a review screenshot and description
- [ ] Tested on a physical device, cold install, in Airplane Mode too

---

This audit is not legal advice. Apple's guidelines change and reviewers apply them inconsistently;
the severities above are risk estimates, not guarantees. The detailed reasoning for the
children's-app specific findings — 5.1.2(i), 1.3/5.1.4, 5.1.1(v), 4.8, the privacy manifest,
purpose strings, the dev routes and the XR gate — is in `docs/release/app-store-readiness.md`.

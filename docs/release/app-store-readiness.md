# App Store readiness — Moyo iOS

What it is: the Expo-aware App Review read of `apps/mobile`, `packages/app`, `packages/ui` and
`packages/theme`, framed as what a reviewer does by hand to a children's education app with an AI
tutor, a camera, a microphone and an optional AR feature.
Why it exists: the static scan in `APP_STORE_APPROVAL.md` answers what the binary declares. This
answers what the product does, which is the half that gets a kids app rejected.
Branch: `feat/spatial-whiteboard-xr` @ `6e5707b` · audited 2026-09-13 · re-audited @ `0075ee7` ·
guidelines as of the June 8, 2026 update.
Source of truth: `APP_STORE_APPROVAL.md` for severities and the submission checklist.

**Gate result: still FAIL — 1 HARD BLOCK.** The gate passes at zero.

1. 5.1.1(v) — no in-app account deletion for any role. **Open.**
2. ~~3.1.1 — subscription prices and a trial CTA ship on iOS with no in-app purchase anywhere in the
   repo.~~ **Closed 2026-09-13** — the paywall step is web-only now; see §8 and `APP_STORE_APPROVAL.md`
   RESOLVED 2.

The shape of the remaining block is worth stating plainly, because it changed: the submission is no
longer waiting on a payments decision. It is waiting on one feature, FD-26, and that feature is a
requirement Apple has enforced since June 2022 on any app that lets a user create an account.

Also closed in the same pass, both from §5: the app's privacy manifest now regenerates from
`ios.privacyManifests` in `apps/mobile/app.config.ts` instead of surviving only because `ios/` is
committed, and the vendored Viro fork's required-reason APIs are measured and declared.

Uncommitted account-deletion work from another agent was present in the working tree during the
re-audit (`packages/app/features/account/`, `apps/web/app/api/account/`). None of it is assessed
here — HARD BLOCK 1 stands against committed code.

---

## 1. 5.1.2(i) — third-party AI, and whether consent comes first

### What leaves the device

Three learner-authored things reach a hosted vendor, and the routing is easy to follow because the
codebase funnels all of it through one gateway.

**Homework photographs.** `packages/app/features/capture/photograph-for-model.native.ts:54-62`
re-encodes the staged photo to JPEG at 1568px and returns `{ mediaType, data }` as base64.
`packages/inference/src/anthropic.ts:164-171` puts that straight into an Anthropic `image` source
block. The routing cell is `tutor-turn` → `claude-opus-5`
(`packages/inference/src/routing.ts:60`).

The residual risk is already documented in the type, at `packages/inference/src/types.ts:55-60`:

> `scrubText` redacts `Name: Ada Lovelace` out of an OCR'd worksheet header, and it cannot see into
> a JPEG. A photograph of a page with a child's name written at the top sends that name.

**Board PNG exports.** `packages/app/features/tutor/board-image.native.ts:24-44` writes the
whiteboard's data URL to a cache file so it can travel the same road a photograph travels;
`packages/app/features/tutor/tutor-screen.tsx:814-840` stages it as a tutor attachment. From there
it is indistinguishable from a homework photo, including the leg to Anthropic.

**The child's words.** Typed turns and transcribed voice notes go out as `InferencePayload.message`
(`packages/inference/src/types.ts:75-80`). `packages/inference/src/pseudonymize.ts:39-60` scrubs
worksheet headers, emails, dates and phone numbers first, deterministically, and the file explains
why it is not model-backed: *"a redactor that needs a model call to decide what to redact has
already sent the thing it was redacting."*

### What does not leave the device

Worth stating, because it narrows the disclosure that is actually owed.

- OCR runs locally. `packages/app/features/capture/read-attachment.native.ts:20-46` uses
  ExecuTorch CRAFT + CRNN on device.
- Speech-to-text runs locally. `packages/app/features/capture/transcribe.native.ts:7-22` uses
  ExecuTorch Whisper tiny.en; the web fork (`transcribe.web.ts:13-21`) uses transformers.js.
  `apps/mobile/app.config.ts:98-102` names this as the reason for the iOS 17 floor.
- The child's recorded audio never reaches ElevenLabs. The TTS payload is Natalie's own output plus
  the frozen baked scripts, MAC-verified as server-emitted
  (`packages/app/features/tutor/voice.service.ts:1-28`, `packages/voice/src/eleven.ts:6-11`).

### Is consent obtained before the first share, in a guardian-facing flow, naming the categories?

Partly. Three of the four requirements hold.

**Guardian-facing: yes.** `packages/app/features/onboarding/guardian/steps.ts:26` orders the flow
`welcome → account → consent → family → children → handoff → plan`, and
`packages/app/features/onboarding/guardian/store.ts` gates advancement so no child row exists
without a consent record behind it.

**Before the first share: yes, structurally.** A learner account is only created by
`packages/auth/src/create-managed-learner.ts` after `completeConsent`
(`packages/auth/src/consent-flow.ts:259-286`) returns a record. No learner, no tutor session, no
egress.

**Naming the data categories: yes.** `packages/auth/src/consent-flow.ts:32-45`:

> What your child types, says, and uploads while working with the tutor · What they get right and
> wrong, and which skills that points at · A first name, a username, and their date of birth

**Naming the recipient: no.** Nothing in `CONSENT_DISCLOSURES`, in
`consent-flow-content.tsx`, or in the onboarding promise screen says the photograph and the words
go to a third-party model vendor. The reason given for the first category is *"So the tutor can
help with the actual problem in front of them"* — true, and silent about where the tutor runs.

There is a second-order problem with the same root. `packages/auth/src/consent-flow.ts:65-68` sets:

```ts
export const DEFAULT_CONSENT_ENVIRONMENT: ConsentEnvironment = {
  disclosesToThirdParties: false,
  hasVerifiedCard: false,
};
```

and `availableMethods` (`:70-78`) unlocks text-plus consent on that flag, because the amended COPPA
Rule permits text-plus only where children's data is not disclosed to third parties. The file's own
comment at `:56-59` says the flag exists *"so the day someone adds a disclosure, the method turns
itself off instead of quietly staying legal-looking."* Whether a hosted model vendor acting as a
service provider counts as disclosure under COPPA is a question for counsel. Apple's 5.1.2(i)
requirement does not depend on the answer.

### The containment tooling is evidence of containment, not of consent

`tooling/check-voice-egress.mjs` fails the build if anything outside four named directories imports
`@acme/voice`, and pins `ELEVENLABS_API_KEY` to one file. `tooling/check-no-training-path.mjs`
fails the build if a training or eval package acquires a read path to the educational store, and
prints that it is currently vacuous because no such package exists. Both are good and both bound
what is shared. Neither asks a guardian anything.

**Fix.** Add the recipient to `CONSENT_DISCLOSURES` in `packages/auth/src/consent-flow.ts`, bump
`CONSENT_POLICY_VERSION` at `:314` so `needsReconsent` (`:321`) re-asks every existing guardian,
and reconcile `disclosesToThirdParties` with the facts — either flip it and let `availableMethods`
withdraw text-plus as designed, or document in the same file why a service-provider call sits
outside it.

---

## 2. 1.3 Kids and 5.1.4 — third-party SDKs, parental gates, COPPA

### Is the app in the Kids Category?

Nothing in the code says. Category is an App Store Connect field and `apps/mobile/app.config.ts`
does not set one.

**Recommendation: do not enter the Kids Category.** A Kids Category app must be designed for
children throughout. This binary carries a teacher shell (`apps/mobile/app/(teacher)/`), a district
shell (`apps/mobile/app/(district)/`), an org/ops shell with a CRM lead pipeline
(`packages/app/features/ops/leads-board.tsx`), and subscription billing. A reviewer will read that
as a general-audience app with a child mode, which is what it is. 1.3 still governs the learner
surfaces either way.

### Third-party analytics and ad SDKs on learner surfaces

None, with one exception. Greps for firebase, amplitude, mixpanel, segment, posthog, appsflyer,
adjust, admob, facebook and branch return nothing outside `node_modules`. There is no
`expo-tracking-transparency` and no `NSUserTrackingUsageDescription`, which is consistent —
`PrivacyInfo.xcprivacy` sets `NSPrivacyTracking` false.

The exception is Sentry. `apps/mobile/src/telemetry.ts:58-78` initialises
`@sentry/react-native` on every surface including a learner's, but conservatively:
`attachScreenshot: false` at `:68`, and every event and transaction passes through
`scrubTelemetryEvent` (`packages/app/core/telemetry-scrub.ts`) before send. `packages/app/core/telemetry-mask.server-test.ts`
tests the masking. Crash reporting with PII scrubbing is generally accepted outside the Kids
Category; inside it, it has to be re-argued or removed.

### Parental gate before external links and account actions

There is no external link to gate. Greps for `Linking.openURL`, `WebBrowser.open` and any
`Linking.` call across `packages/` and `apps/mobile` return zero matches. Nothing in the app opens
a browser.

That changes the moment the privacy policy is linked (section 6 below), so the gate is needed
before that lands. The mechanism already exists: `packages/app/features/switch-profile/profile-switcher.tsx:84-88`
runs biometric or family-PIN verification behind the Grown-ups row, and
`apps/mobile/app.config.ts:164` supplies the Face ID prompt wording — *"Confirm it is you before
opening billing, permissions, or your child's AI activity."* Route the first outbound link through
it.

Account actions a child can reach are already constrained server-side.
`packages/auth/src/server.ts:171-176` refuses restricted learner profile updates,
`:180-188` refuses linking a social account to a managed learner, and `:189-203` refuses a learner
password change by anyone but the guardian. `packages/app/features/profile/profile-content.tsx:218`
tells the child *"A grown-up looks after your settings."*

### PII from a child without verifiable parental consent

None found, and the consent machinery is the strongest part of this codebase.

- A learner has a username and no email. `packages/auth/src/server.ts:255-257` registers the
  `username()` plugin for exactly that reason. A child never types an email or a password —
  `packages/app/features/onboarding/guardian/steps.ts:20-22` and the handoff code path
  (`apps/mobile/app/handoff.tsx`) put account creation on the guardian's device.
- Date of birth is entered by the guardian during the `children` step
  (`packages/app/features/onboarding/guardian/steps.ts:33`), not asked of the child.
- Consent is a machine, not a checkbox. `packages/auth/src/consent-flow.ts` implements email-plus,
  text-plus, KBA and card. The "plus" is enforced: `confirm()` at `:195-197` refuses to set
  `confirmed` unless `codeVerified` is already true. Codes expire in 15 minutes and burn after 5
  attempts (`:105-106`). KBA needs 3 of 4 and a failed set is spent, compared order-independently
  (`:205-240`) after a bug where a reshuffled set could be re-answered with the answers already
  known.
- Records are immutable. `packages/payload/src/collections/Consents.ts:33-35` sets
  `update: () => false, delete: () => false`; re-consent writes a new row.
- `versions: false` on the same collection (`:29`) is deliberate and documented: Payload's shadow
  tables would survive the retention sweep, so *"delete my child's data" does not delete it.*

The gap is section 1: the consent that is obtained does not name the recipient.

---

## 3. 5.1.1(v) — in-app account deletion — **HARD BLOCK**

Every role that can sign in can create an account. Adults go through
`emailAndPassword: { enabled: true }` (`packages/auth/src/server.ts:162-169`); learners are created
by a guardian through `packages/auth/src/create-managed-learner.ts:23`.

None of them can delete it from inside the app.
`packages/app/features/settings/settings-content.tsx:132-152` renders a Session card with a
single `Sign out` button. The comment at `:139-147` records the decision:

> DECISION — no "Delete account" button: it was a dead control (onPress={() => {}}), and FD-26 —
> the deletion flow this contract's exit is declared against — is MISSING.

Removing a dead control was right. Shipping without the flow is not. The only `deleteUser` calls in
the repo (`packages/auth/src/payload-learner-writer.ts:33`,
`packages/auth/src/create-managed-learner.ts:69`) are the rollback for a failed learner creation.

Sign-out is not deletion, and neither is a support email. Apple requires the user to be able to
initiate it in the app, and it must reach the server.

**What FD-26 has to do.** Run inside `protectedOperation`
(`packages/app/core/protected-operation.ts:215`) with `requires: 'write'` so identity comes from
the session and not the request, per the Block contract. Cascade to `Consents`,
`SessionTranscripts`, `StudentModelFacts`, `TutorSessions`, `TutorEngagements`, `SessionSummaries`,
`SafetyEvents`, `IncidentReports`, `Guardianships` and `Families`, plus the Better Auth user,
session and account rows. Verify the sweep reaches every table — `Consents.ts:20-24` measured 1,294
shadow rows across the schema before versions were turned off, with
`_student_model_facts_v_texts` holding 1,119 against 49 live. Surface it in
`settings-content.tsx` for the account holder, and on the family screen per child, since the
consent screen already promises withdrawal there
(`packages/app/features/onboarding/consent/consent-flow-content.tsx:82`).

---

## 4. 4.8 — Sign in with Apple

Not required. `packages/auth/src/server.ts:156-281` configures Better Auth with
`emailAndPassword`, `username()`, `organization()`, `multiSession()`, `haveIBeenPwned()`, `expo()`
and a conditional `stripePlugin()`. There is no `socialProviders` block and no OAuth provider of
any kind.

The only Google reference in the auth package is a test asserting the opposite of SSO:
`packages/auth/src/restricted-account.test.ts:39` checks that
`isRestrictedLearnerAccountLink(managedOwner, { providerId: 'google' })` returns `true`, i.e. a
managed learner cannot link Google.

4.8 triggers on third-party or social login. There is none, so no privacy-preserving alternative is
owed. Adding Google or any other SSO later brings 4.8 back, and Sign in with Apple is the simplest
way to satisfy it.

---

## 5. PrivacyInfo.xcprivacy

### What the binary actually uses, and what is declared

`apps/mobile/ios/Moyo/PrivacyInfo.xcprivacy` is committed and its four entries match the code:

| Category | Reasons declared | Used by |
|---|---|---|
| `UserDefaults` | `CA92.1` | `react-native-mmkv` (`apps/mobile/package.json:49`) writes through `NSUserDefaults` |
| `FileTimestamp` | `0A2A.1`, `3B52.1`, `C617.1` | `expo-file-system` on the upload and board paths (`packages/app/features/media/transport.native.ts:16`, `packages/app/features/tutor/board-image.native.ts:20`) |
| `DiskSpace` | `E174.1`, `85F4.1` | same upload path |
| `SystemBootTime` | `35F9.1` | `@sentry/react-native` (`apps/mobile/package.json:23`, init at `apps/mobile/src/telemetry.ts:58`) |

`NSPrivacyCollectedDataTypes` is an empty array and `NSPrivacyTracking` is `false`. The empty
collected-data array needs a second look before submission: the app uploads a child's photographs,
audio and written work to its own backend. Apple's manifest and the App Privacy labels must agree
with each other and with the flows.

### The manifest had no source — **fixed 2026-09-13**

It used to have none. Nothing in `apps/mobile/app.config.ts` or `apps/mobile/plugins/` produced it,
so `npx expo prebuild --platform ios --clean` in a scratch worktree left no
`ios/Moyo/PrivacyInfo.xcprivacy` at all. The committed copy was the only copy, surviving purely
because `apps/mobile/ios` is tracked in git (23 files) and EAS Build uses a committed native
directory as-is. It would have fired the first time anyone ran a clean prebuild and did not notice a
single deleted file in a directory people skim.

**The fix is `ios.privacyManifests` in `apps/mobile/app.config.ts`, and no new plugin.**
`@expo/prebuild-config` already runs `IOSConfig.PrivacyInfo.withPrivacyInfo` as part of its default
plugin set; it writes the plist and registers it in the Xcode target's Resources build phase, which
a hand-rolled `withDangerousMod` would have had to do itself.

`expo-build-properties` was checked first and does not cover this. Its
`privacyManifestAggregationEnabled` flag only merges manifests that CocoaPods dependencies ship for
themselves, and it was already `true` in the generated `Podfile.properties.json` — which is exactly
why the gap was invisible: pod-level aggregation was working, and the app's own manifest was the one
with no producer.

**Proof, two prebuilds in a scratch worktree outside the repo, both exit 0.** Control at `0075ee7`
unmodified: no `PrivacyInfo.xcprivacy` in the generated tree. With the fix: the file is back, and
`plistlib` says its `NSPrivacyAccessedAPITypes`, `NSPrivacyTracking` and `NSPrivacyCollectedDataTypes`
equal the committed copy's — the generated file adds only an empty `NSPrivacyTrackingDomains`, which
is inert beside `NSPrivacyTracking = false`. `project.pbxproj` carries the `PBXBuildFile`, the
`PBXFileReference` and the `PrivacyInfo.xcprivacy in Resources` entry. Nothing under
`apps/mobile/ios/` was edited or committed.

The drift this section also named is unchanged and still worth settling: the committed `Info.plist`
carries `RCTNewArchEnabled` and the regenerated one does not. Decide whether `ios/` stays committed
at all — either answer is defensible; the hybrid means nobody can tell which file wins.

### Third-party SDK manifests, including the vendored Viro fork

React Native 0.86 ships manifests (`node_modules/react-native/React/Resources/PrivacyInfo.xcprivacy`,
`ReactCommon/cxxreact/PrivacyInfo.xcprivacy`) and the generated `Podfile.properties.json` sets
`apple.privacyManifestAggregationEnabled: "true"`, so the pod-level manifests aggregate into the
app. The static scan's `[HARD BLOCK] ITMS-91061 :: hermes` was an artifact of pods not being
installed in the scratch tree; it is not carried as a finding.

The vendored Viro fork ships no manifest of its own, and it never will —
**its required-reason APIs are now measured and declared in the app's manifest instead
(fixed 2026-09-13).**

`apps/mobile/package.json:22` pins `"@reactvision/react-viro": "3.0.0-moyo.1"`, built from
`vendors/reactvision-react-viro-3.0.0-moyo.1.tgz` (52 MB). `find` for `PrivacyInfo.xcprivacy` inside
it returns nothing, and neither `ios/ViroReact.podspec` nor `ios/ViroReactUI.podspec` declares a
manifest resource bundle. The published package is not on Apple's 86-SDK list, so ITMS-91061 does not
fire on the name — but ITMS-91053 does not care about names, and a fork we build is ours.

**What it actually uses, measured rather than assumed.** A text grep over the 634
`.h/.m/.mm/.swift/.cpp` sources finds nothing, which would have been a comfortable and wrong answer:
the iOS renderer ships as prebuilt binaries. `nm -u` on both, plus a selector scan of
`__objc_methname`:

| Binary | Symbol | Category | Reason declared |
|---|---|---|---|
| `ios/dist/ViroRenderer/ViroKit.framework/ViroKit` | `stat`, `fstat` | `FileTimestamp` | `C617.1` — reads its own bundled shaders, textures and `.mlmodelc` inside the app container |
| same | `mach_absolute_time` | `SystemBootTime` | `35F9.1` — frame clock |
| `ios/dist/lib/libViroReact.a` | none | — | — |

No `statfs`/`statvfs`/volume-capacity key, so it needs no `DiskSpace`. No
`NSUserDefaults`/`CFPreferences`, so no `UserDefaults`. No `activeInputModes`.

Both categories it needs were already declared for `@sentry/react-native` and `expo-file-system`, so
**the fork added no new category to the manifest.** What changed is that the manifest now has a
source, and that source names Viro beside each reason — so if Sentry is ever dropped, the next reader
can see that `35F9.1` still has a caller.

Declared in `app.config.ts` rather than added to the tarball's podspec: aggregating a vendored
framework's reasons into the app manifest is what the app manifest is for, and it avoids recutting
52 MB to carry two strings. The measurement and the command to repeat it are in `vendors/README.md`.

**One thing to watch.** `ViroKit.podspec` documents opt-in ARCore pods (`ARCore/CloudAnchors`,
`Geospatial`, `Semantics`), weak-linked and currently absent from the Podfile. Several Firebase and
GoogleUtilities pods they pull in behind them ARE on Apple's 86-SDK list and must ship signed
manifests. Enabling Cloud Anchors is a privacy-manifest decision as well as a product one.

---

## 6. Purpose strings

### What ships

Four strings appear in the prebuild output. One is authored and wins; three are plugin defaults.
Re-measured 2026-09-13 @ `0075ee7` — two of them changed owner since the first audit, because the
Viro plugin is now registered and its defaults run:

| Key | Value | Origin |
|---|---|---|
| `NSFaceIDUsageDescription` | "Confirm it is you before opening billing, permissions, or your child's AI activity." | `apps/mobile/app.config.ts`, authored via the `expo-secure-store` plugin |
| `NSCameraUsageDescription` | "Allow $(PRODUCT_NAME) to **use** your camera" | `@reactvision/react-viro` default (`withViro.ts:5`) |
| `NSMicrophoneUsageDescription` | "Allow $(PRODUCT_NAME) to **use** your microphone" | `@reactvision/react-viro` default (`withViro.ts:6`) |
| `NSPhotoLibraryUsageDescription` | "Allow $(PRODUCT_NAME) to access your photos" | `expo-image-picker` plugin default |

`apps/mobile/app.config.ts` still has no `ios.infoPlist` key, so nothing in this repo chooses any of
the three. `packages/app/package.json:41` pulls in `expo-image-picker`, whose auto-applied plugin
writes defaults with `||`; Viro's plugin does the same and now gets to the camera and microphone
keys first.

**A camera string WAS written, and it is being discarded.** `app.config.ts:75-77` passes the Viro
plugin `cameraUsagePermission: 'Moyo uses the camera so you can photograph your homework, and to
place your whiteboard in the room.'` — at the top level of the plugin's props. The plugin reads
`props.ios.cameraUsagePermission` (`node_modules/@reactvision/react-viro/plugins/withViroIos.ts:231-232`),
so the option never matches and `DEFAULTS.ios.cameraUsagePermission` wins (`withViro.ts:201`). A prop
nobody reads is worse than no prop, because it reads as done.

That also settles the precedence question the fix below depends on: `withViroIos.ts:257` resolves the
string as `config.ios.infoPlist.NSCameraUsageDescription || cameraUsagePermission`, and
`expo-image-picker` uses the same shape. **Authoring in `ios.infoPlist` beats every plugin default**,
and makes the mis-nested Viro prop moot rather than something to fix twice.

### What each one has to cover

**Camera — two features, neither named.** Homework capture runs through
`react-native-vision-camera` at `packages/app/features/capture/guided-frame.native.tsx:11`, which
draws the guided frame and the age-band shutter. On this branch the same permission also covers
ARKit world sensing so the board can be placed on a real surface
(`packages/app/features/tutor/tutor-xr-screen.native.tsx`). The current string mentions neither.

**Microphone.** `packages/ui/audio/VoiceRecorder.native.tsx:5` records through
`react-native-audio-api`'s `AudioRecorder`. The string should say the recording is a voice note to
the tutor and that it is transcribed on the device
(`packages/app/features/capture/transcribe.native.ts:15`), because that is the fact a parent cares
about.

**Photo library.** `expo-image-picker` is used to attach an existing picture.

**Motion.** Not needed. ARKit on iOS does not require `NSMotionUsageDescription` unless the app
calls Core Motion directly, and nothing here does — greps for `CMMotionManager`, `expo-sensors`,
`Accelerometer` and `DeviceMotion` return nothing. Do not add it; an unused permission prompt is
its own 5.1.1 problem.

### Proposed strings

```ts
infoPlist: {
  NSCameraUsageDescription:
    'Moyo uses the camera so your child can photograph a homework page for the tutor to read, and — on supported devices — to place their whiteboard on a real surface in the room.',
  NSMicrophoneUsageDescription:
    'Moyo uses the microphone so your child can record a voice note for the tutor instead of typing. The recording is turned into text on this device.',
  NSPhotoLibraryUsageDescription:
    'Moyo opens your photo library so your child can attach a picture of work they already photographed.',
},
```

### Running them past `tooling/check-copy-law.mjs`

The check cannot see them. Its scan root is `apps/web-vite/src` only
(`tooling/check-copy-law.mjs:33`), the marketing site. Running it today prints:

```
copy-law OK — 60 site files carry no banned promise
```

which says nothing about the plist. Read manually against its four rules, the proposed strings
pass: no promise of answers (the banned patterns are `gives the answer`, `answer keys`, `instant
answers`, `does your homework`, `solves it for you`), no business-tier price, no claim of voice
input as a tutor input mode, no social feature.

If purpose strings should be under copy law, `check-copy-law.mjs` needs a second scan root pointed
at `apps/mobile/app.config.ts`. Worth doing — the plist is copy a parent reads at the highest-stakes
moment in the product, and it is the one piece of copy no reviewer on this team currently sees.

---

## 7. 2.1 / 2.3 — dev-only routes, and the rule for the XR entry

### Routes that ship and should not

| Route | File | Guard | Verdict |
|---|---|---|---|
| `moyo://onboarding/dev` | `apps/mobile/app/onboarding/dev.tsx:22` | **none** | Ships. Renders `DevPersonaSwitch`, headed `Development only` in the danger colour (`packages/app/features/onboarding/dev-persona-switch.tsx:41-43`), with eleven fixture personas from `packages/app/fixtures/personas.ts`. `apply()` at `:26-36` writes a persona into the live session store and navigates into that role's shell. |
| `moyo://natalie-3d` | `apps/mobile/app/natalie-3d.tsx` | none | Ships. Avatar stage with a `mounting…` status readout, no session around it. |
| `moyo://native-3d-smoke` | `apps/mobile/app/native-3d-smoke.tsx` | none | Ships. Raw WebGPU harness. Its own header (`:5-7`) says *"a child must never be one mis-tap away from a rotating debug cube."* |
| `moyo://handoff` | `apps/mobile/app/handoff.tsx` | n/a | **Keep.** This is production — the learner device's front door for the guardian's handoff code (doc 36 §2). Not a dev route despite its position at the app root. |

The persona switcher is the one that matters. `packages/app/features/onboarding/dev-persona-switch.tsx:6`
claims *"It is gated by `__DEV__` everywhere it is mounted, so it cannot ship."* That holds for
`packages/app/features/onboarding/public-entry-content.tsx:79`, which wraps it in
`{__DEV__ ? ... : null}`, and fails for the route, which renders it bare. `scheme: 'moyo'`
(`apps/mobile/app.config.ts:13`) is registered for release, and Expo Router mounts every file under
`app/`.

**Fix for all three:** add `if (!__DEV__) return <Redirect href="/" />;` at the top of each route
body. The evidence workflow keeps working on a development build, and nothing is reachable in
release. Then delete the false docstring at `dev-persona-switch.tsx:6` or make it true.

### The rule for the XR entry, stated plainly

**The XR entry ships only when the device acceptance test is green. Until then the capability check
must remove the button — not disable it, not hide it behind a toggle. A switch that reveals a
half-working mode is a 2.3.1 hidden feature.**

Where the branch stands against that rule:

**The capability check removes the button, correctly.**
`packages/app/features/tutor/xr-capability.ts:26-32` returns true only when
`NativeModules.VRTSceneNavigatorModule` is a non-null object, and fails closed on anything
unknown — the file's own reasoning at `:9-11` is that *"a button that opens a black scene on a
device with no XR runtime is worse than a button that was never there."*
`packages/ui/XrBoardButton.tsx:60` is `if (!available) return null`. Absence, not a disabled state.
`packages/app/features/tutor/tutor-screen.tsx:946` passes `available={canOpenSpatialBoard()}`.

**The acceptance test is not green. It does not exist.** `qa/walkthroughs/` contains
`ACCOUNTS.md`, `DEMO-SMOKE-2026-09-03.md`, `NATALIE-HUMAN-2026-09-03.md` and
`NATIVE-3D-SMOKE-2026-09-03.md`. Nothing covers the spatial board.

**The renderer IS linked on iOS now — corrected 2026-09-13 @ `0075ee7`.**
This section used to say the opposite, and the accident it described is gone.
`@reactvision/react-viro` is registered in the `plugins` array of `apps/mobile/app.config.ts:71-78`
with `xRMode: ['AR']`, and the re-audit prebuild proves what that produces: `pod 'ViroReact'` and
`pod 'ViroKit'` at lines 62-63 of the generated Podfile, and two `EXCLUDED_ARCHS` entries in
`project.pbxproj`. So `VRTSceneNavigatorModule` will register on a real build,
`canOpenSpatialBoard()` will return true, and **the XR button will appear**.

Which means the rule is now the only thing hiding the entry, and the rule is not satisfied: there is
still no device acceptance walkthrough under `qa/walkthroughs/`. What was previously true by accident
is now a live 2.3.1 exposure the moment a build ships.

**Before the XR entry ships:** ~~register the Viro plugin~~ (done) — but note the camera purpose
string it is trying to set is being silently dropped, because `app.config.ts` passes
`cameraUsagePermission` at the top level of the plugin's props while the plugin reads
`props.ios.cameraUsagePermission` (`withViroIos.ts:231-232`), so its own default wins. Section 6's
fix supersedes it. Then: add a device acceptance walkthrough under `qa/walkthroughs/`,
~~add the fork's privacy manifest~~ (done, section 5), and confirm `UIRequiredDeviceCapabilities`
still excludes `arkit` — it does, `[arm64]` only, re-verified in the same prebuild (section 9).

The route itself is well placed. `apps/mobile/app/(learner)/tutor-xr.tsx` sits inside the
`(learner)` group, which is wrapped in `Stack.Protected guard={isLearner}`, and
`packages/app/features/tutor/tutor-xr-entry.native.tsx:20-22` lazy-imports the renderer so nothing
on a phone's tutor screen evaluates Viro.

---

## 8. Demo accounts, review notes, iPad, prices, Reduce Motion

### Demo accounts per role

`qa/walkthroughs/ACCOUNTS.md` documents a full tenant × role × band roster, seeded by
`apps/web/scripts/seed-walkthrough.mts` through the product's own creation paths
(`auth.api.signUpEmail`, `createManagedLearner`), so a walkthrough exercises live auth rather than
the dev fixtures. Adults sign in at `walkthrough+<cell>@moyolearn.test`; learners use `wt_*`
usernames. Passwords live in the seed script only.

Two problems for App Review:

1. The roster targets whatever database the seed ran against. App Review needs accounts that work
   against the backend the **shipped binary** points at.
2. `packages/auth/src/server.ts:168` sets
   `requireEmailVerification: process.env.NODE_ENV !== 'development'`, so a reviewer who signs up
   fresh hits a verification wall on an address at an RFC 2606 `.test` domain, which is
   undeliverable by definition. The demo accounts must be pre-verified in production.

Provide at minimum: guardian (paid), learner, teacher, tutor, school admin. App Review tests on an
iPad Air 11-inch (M3) and an iPhone 17 Pro Max.

A reviewer cannot reach the learner experience without help. A child never types an email
(`packages/app/features/onboarding/guardian/steps.ts:20-22`); the learner device is authorised by a
handoff code minted on the guardian's device and redeemed at `apps/mobile/app/handoff.tsx`. Either
give the reviewer a pre-minted code, or write the two-device sequence into the review notes step by
step.

### App Review notes

Write them to answer what a reviewer will ask about a kids app with an AI in it:

- What the AI tutor does, and what it refuses to do. `packages/app/features/tutor/pedagogy.ts`
  holds the contract; the product position is that it never just gives the answer.
- Which vendor runs it (Anthropic, `packages/inference/src/routing.ts:60`), and that OCR and
  speech-to-text run on the device (`read-attachment.native.ts`, `transcribe.native.ts`).
- Where consent is collected: guardian onboarding step 3 of 7
  (`packages/app/features/onboarding/guardian/steps.ts:26`), verifiable under COPPA by email-plus,
  text-plus, KBA or card, with an immutable record.
- That children have no independent accounts and no email address.
- The safety plane: input and output classification
  (`packages/inference/src/routing.ts:61-63`), the deterministic firewall, and the guardian's
  AI-activity view at `apps/mobile/app/(guardian)/ai-activity.tsx`.
- Session budgets and the break nudge (`packages/inference/src/budget.ts`).

### iPad

`apps/mobile/app.config.ts:23` sets `supportsTablet: true`, so iPad screenshots are mandatory and
the app is reviewed on an iPad. `UIRequiresFullScreen` is `false` and all four orientations are
declared for both idioms, so it must also survive Split View and Slide Over. `orientation: 'default'`
(`app.config.ts:18`) means every learner screen has to hold up in landscape on a tablet.

### No prices on learner surfaces, and now none on iOS at all — **fixed 2026-09-13**

The learner half was never the problem and still holds.
`packages/app/features/paywall/` is imported in exactly one place —
`packages/app/features/onboarding/guardian/guardian-onboarding-content.tsx:27` — and rendered only
at the `plan` step of guardian onboarding. No learner route imports it, and
`packages/app/features/settings/settings-content.tsx:114-130` hides the "Manage plan" row on native
because `managePlanHref` is web-only. `tooling/check-copy-law.mjs` enforces the related rule that
business-tier prices never render where a parent reads, and it passes.

The iOS problem was that a *guardian* could see `$11/month` and `$15.99/month`
(`paywall.data.ts:32,41`) and a "Start 30-day free trial" button, on a screen with no StoreKit
behind it, in a repo where a grep for `StoreKit|react-native-iap|expo-in-app-purchases|react-native-purchases|expo-iap|RevenueCat`
returns nothing outside `node_modules`. Billing is Stripe, server-side. And the button did nothing
but advance a step — `onStartTrial={complete}` — so 3.1.1 and 2.1 landed on one screen.

**The paywall step no longer exists on native.**
`packages/app/features/onboarding/guardian/plan-step.native.ts` exports `GUARDIAN_PLAN_STEP = false`,
`plan-step.web.ts` exports `true`, and `steps.ts` builds `GUARDIAN_STEPS` from that constant. The
native flow runs six steps and ends at `handoff`; the web flow runs the same seven it always did and
completes through the paywall's own two buttons. Metro's resolver, asked directly, answers
`./plan-step` with the native fork for `ios` and `android` and the web fork for `web`.

**Why the step was removed rather than stripped of its prices.** Deleting only the numbers leaves a
heading, one line of prose and a button that still does nothing — which is both the 2.1 half of the
finding intact and the exact faked surface the `grants` step was deleted for
(`steps.ts:24-26`: *"a step that asked for nothing and granted nothing"*). Nothing was added
pointing a guardian at the web to subscribe either: 3.1.3 forbids advertising or linking to another
purchase method, so the honest native flow says nothing about buying at all.

Two details that make the removal safe rather than merely absent:

- The terminal step needs an exit that completes. "Save & exit" deliberately keeps the draft, so
  without a `Finish setup` button on `handoff` a native guardian would finish onboarding without
  arming the feed's what's-next card or clearing the persisted draft, and would rehydrate onto
  handoff forever.
- A persisted draft carrying `step: 'plan'` is clamped on rehydration (`store.ts`,
  `onRehydrateStorage`). Without that, `GUARDIAN_STEPS.indexOf('plan')` returns -1 on native,
  `nextStep` walks back to `welcome`, and the paywall renders on the one platform it must not.

**What this does not do:** it does not make the family subscription purchasable on iOS. That is a
product and finance decision — ship in-app purchase, or accept that iOS guardians subscribe outside
the app and never hear about it from inside it. If IAP is chosen later, flipping
`plan-step.native.ts` brings the step back, and the paywall then owes the seven elements 3.1.2
requires; it carries duration, price and cancellation copy today and is missing Terms, Privacy and
Restore.

### Reduce Motion and Reduce Transparency

Reduce Motion is handled properly. `packages/ui/motion.tsx:89-105` subscribes to
`AccessibilityInfo`'s `reduceMotionChanged` and exposes it through `useSyncExternalStore`, so one
path covers native and web (RNW implements it over `prefers-reduced-motion`). Consumers honour it:
`packages/ui/stage-board/StageBoard.native.tsx:107-108` collapses the settle animation to zero
duration, and the tutor stage routes a Reduce Motion learner to Natalie's voice rather than a small
animated face (`packages/app/features/tutor/tutor-screen.tsx:963-966`).

Reduce Transparency is not read anywhere. Greps for `ReduceTransparency` and
`isReduceTransparencyEnabled` return nothing. That is only a problem where the design uses
translucency over content. Check the bottom sheets (`packages/ui/BottomSheet.tsx`) and any
backdrop; if they are opaque, there is nothing to do.

---

## 9. Export compliance, device capabilities, background modes, minimum iOS

All four are correct in the generated output and traceable to source.

**Export compliance.** `ITSAppUsesNonExemptEncryption` is `false`, set at
`apps/mobile/app.config.ts:29` with the reasoning in the comment: the only use of encryption is
SecureStore and the platform keychain. TestFlight will not stall on Missing Compliance.

**`UIRequiredDeviceCapabilities` must not require `arkit`.** It is `[arm64]` only. Keep it that
way. Listing `arkit` would make the app un-installable on every device without an ARKit-capable
chip, for a feature that is optional by design and currently not even linked. Viro's iOS plugin
does not add it, and neither does anything in `apps/mobile/plugins/`.

**Background modes.** `UIBackgroundModes` is `[fetch]`, and it is used rather than declared
speculatively: `packages/app/features/media/upload-queue.native.ts:42` registers a background task
that drains the upload queue, and `packages/app/features/media/transport.native.ts:32` sets
`sessionType: 'background'` so a 40 MB voice note survives the guardian switching apps. Apple
rejects unused background modes; this one has a purpose a reviewer can see.

**Minimum iOS and build SDK.** `ios.deploymentTarget: '17.0'`
(`apps/mobile/app.config.ts:104`), forced by `react-native-executorch`'s podspec rather than
chosen — and the comment at `:98-102` names the cost and the reason: executorch is what reads a
child's homework and transcribes their voice without either leaving the phone. The generated
`LSMinimumSystemVersion` of `12.0` is an Expo template artifact overridden by the deployment
target; do not read it as the floor.

The build machine runs Xcode 26.4.1 with the iOS 26.4 SDK, which clears the April 28, 2026 minimum
(iOS 26 SDK / Xcode 26+, ITMS-90725). `apps/mobile/eas.json` pins `node: "24.19.0"` but does not
pin an image, so the EAS image's Xcode version has to be confirmed separately.

---

## 10. 1.2 — user-to-user content

No learner-visible messaging exists today.

Teacher and class features carry assignments, rosters, student detail and reports:
`packages/app/features/classes/class-detail-content.tsx`,
`packages/app/features/assignments/`, `packages/app/features/summary/report-blocks.tsx`. None of
them is a message thread. The org "Inbox" is a rename, not a feature —
`packages/app/features/notifications/inbox-screen.tsx:7-9` returns
`<NotificationsScreen title="Inbox" />`, the same system-notification surface the guardian sees.
Greps for `sendMessage`, `composeMessage`, `directMessage` and `chat with` return nothing.

The one adjacent surface is Conference Room. `packages/app/features/conference/conference.policy.ts`
admits participants to a live session and requires a qualifying guardian —
`qualifyingGuardianships` at `:38-45` accepts only `guardian`, `parent` or `carer` relationships
with `status: 'active'`, and the policy is explicitly server-authoritative (`:1-9`: *"the caller is
responsible for never trusting client-supplied role strings"*). There is no learner route to it;
`apps/mobile/app/(learner)/` has no conference screen, and the only entry is
`apps/mobile/app/(teacher)/conference.tsx`. So the feature is teacher-initiated and incomplete from
the child's side, which is its own 2.1 question if it is meant to ship.

**If any of this gains a learner-visible message, report, or free-text field between users, 1.2
applies in full:** a method for filtering objectionable content, a mechanism to report it with
timely response, the ability to block abusive users, and published contact information. On a
children's app, add moderation before the feature, not after.

---

## What a human must still do in App Store Connect

Nothing in this list can be verified from the repository.

1. **Demo accounts.** Create working sign-ins against the production backend for guardian (paid),
   learner, teacher, tutor and school admin. Pre-verify their email addresses so
   `requireEmailVerification` does not block the reviewer. Include the handoff-code sequence, or a
   pre-minted code, so the reviewer can reach the child experience.
2. **App Review notes.** Write the AI-tutor explanation and name where consent is collected —
   guardian onboarding step 3 of 7. Say that OCR and speech-to-text run on the device and that
   children hold no independent accounts.
3. **Age rating questionnaire.** Answer it under the 5-tier system, including the social-media
   capability questions that became mandatory for submissions in September 2026. The honest answer
   is no social feed.
4. **App Privacy labels.** Declare photos, audio, user content and diagnostics, and reconcile them
   with `PrivacyInfo.xcprivacy` — whose `NSPrivacyCollectedDataTypes` is currently an empty array
   while the app uploads a child's work to its own backend.
5. **Category.** Recommend a general education category, not the Kids Category. See section 2.
6. **Screenshots.** iPhone and iPad, matching this build, with no dev routes and no placeholder
   data.
7. **Support URL** with a working contact method, and a **privacy policy URL** that is live.
   `apps/web-vite/src/routes/privacy.tsx` and `childrens-privacy.tsx` exist; confirm they are
   deployed and public.
8. **Terms of Use (EULA) link in the Description field** — required once a subscription ships.
   There is no dedicated field for it.
9. **In-app purchases.** Nothing to create — the iOS build sells nothing and shows no price. If
   that is ever reversed, create the auto-renewable subscriptions, attach a review screenshot and
   description to each, and confirm the paywall carries all seven required elements.
10. **Export compliance.** Already answered in the binary; confirm App Store Connect agrees.
11. **Confirm the EAS build image's Xcode version** is 26 or newer. `apps/mobile/eas.json` pins
    Node but not the image.

---

Not legal advice. Apple's guidelines change and reviewers apply them inconsistently. Severities are
risk estimates.

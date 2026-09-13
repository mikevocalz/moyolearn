# App Store submission audit — Moyo

Audited 2026-09-13 · branch `feat/spatial-whiteboard-xr` @ `6e5707b`
Re-audited 2026-09-13 @ `0075ee7` · **1 HARD BLOCK · 5 LIKELY REJECTION · 8 RISK FLAG · 3 RESOLVED**

Guidelines verified against the June 8, 2026 App Review Guidelines. Re-verify at
<https://developer.apple.com/app-store/review/guidelines/> before submitting.

**The gate still does not pass.** It passes only at zero HARD BLOCKs, and one remains:
5.1.1(v), in-app account deletion. 3.1.1 is closed, so the submission is no longer blocked
on a payment decision — it is blocked on shipping FD-26.

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
  is a different matter — see RESOLVED 7.
- The scan reported `no third-party AI endpoints detected` and `no account-creation flow detected`.
  It scanned only `apps/mobile/`; the AI egress and the auth stack live in `packages/inference`,
  `packages/voice` and `packages/auth`. Both are findings, raised by hand below.

### Re-audit, 2026-09-13 @ `0075ee7`

Findings 2, 7 and 8 were fixed and are recorded under RESOLVED below. The re-audit ran the same
scratch-worktree prebuild twice — once at `0075ee7` unmodified as a control, once with the fix — so
each claim below rests on a diff between two generated trees rather than on reading the config.

Two facts the original audit recorded have since changed on their own, and both are corrected in
place: `@reactvision/react-viro` IS now in the plugins array (RISK FLAG 10), and the camera purpose
string in the prebuild output changed wording (LIKELY REJECTION 4).

**HARD BLOCK 1 is recorded as open, and that is a statement about this audit, not about the
repository.** Account-deletion work from another agent landed in `6eaca59` while this re-audit was
being written — `packages/app/features/account/`, `apps/web/app/api/account/`,
`apps/web/lib/account-deletion.repository.ts`, and edits to `settings-content.tsx`. **None of it has
been audited.** 5.1.1(v) is not satisfied by a deletion screen existing; it is satisfied by a
deletion that reaches the server, cascades to every collection and to Better Auth's user, session
and account rows, and clears the versions tables the `Consents` collection documents. Someone has to
check that against the code before the count drops. Until then the honest number is 1.

---

## RESOLVED

### 2. 3.1.1 / 2.1 — subscription prices and a trial CTA on iOS · **FIXED**

**Was:** `packages/app/features/paywall/paywall.data.ts:32,41` put `$11/month` and `$15.99/month` on
the `plan` step of guardian onboarding, and `Start 30-day free trial` was the screen's one primary
action — with no StoreKit, no `react-native-iap`, no `expo-in-app-purchases` and no RevenueCat
anywhere in the repo (grep confirmed again at `0075ee7`: zero matches outside `node_modules`).
Billing is Stripe, server-side. The CTA was also inert: `guardian-onboarding-content.tsx` passed
`onStartTrial={complete}`, so the tap advanced a step and created no subscription.

**Fix shipped:** the paywall step no longer exists in the native guardian flow.
`packages/app/features/onboarding/guardian/plan-step.native.ts` exports `GUARDIAN_PLAN_STEP = false`
and `plan-step.web.ts` exports `true`; `steps.ts` builds `GUARDIAN_STEPS` from that constant, so the
native sequence ends at `handoff` (six steps) and the web sequence keeps `plan` (seven, unchanged).
`guardian-onboarding-content.tsx` renders a `Finish setup` button on whichever step is terminal,
which is what completes the flow on native — web still completes through the paywall's own two
buttons, so nothing on that path moved.

The step was removed rather than stripped of its prices. A plan step with no price and no purchase
is a heading, one line of prose and no control, which is the same faked surface the `grants` step
was deleted for (`steps.ts`) — and it would have left the 2.1 half of this finding standing. Nothing
was added that steers a guardian to the web to pay, because 3.1.3 forbids advertising or linking to
another purchase method; the native flow says nothing about buying at all.

**Verified:** Metro's own resolver (`metro-resolver`, project config, origin `steps.ts`) answers
`./plan-step` with `plan-step.native.ts` for `ios` and `android`, and `plan-step.web.ts` for `web`.
`tsc --noEmit` is green across all 19 workspace targets. A persisted native draft that still carries
`step: 'plan'` is clamped to this platform's last step on rehydration (`store.ts`,
`onRehydrateStorage`) — without that, `indexOf` would return -1 and the paywall would render on the
one platform it must not.

**Still true, and deliberately unchanged:** no learner surface imports the paywall on any platform.
`packages/app/features/paywall/` is imported from exactly one place, guardian onboarding.

**What this does not do:** it does not make the family subscription purchasable on iOS. That remains
a product and finance decision — ship in-app purchase, or accept that iOS guardians subscribe
outside the app and never hear about it from the app. If IAP is chosen later, flip
`plan-step.native.ts` and give the paywall the seven elements 3.1.2 requires (title, duration, full
renewal price as the most prominent price, what it provides, Terms, Privacy, Restore); it carries
duration, price and cancellation copy today and is missing the last three.

### 7. ITMS-91061 / ITMS-91053 — the vendored Viro fork's required-reason APIs · **DECLARED**

**Was:** `vendors/reactvision-react-viro-3.0.0-moyo.1.tgz` ships no `PrivacyInfo.xcprivacy`, and it
is a fork we build, so its required-reason APIs are ours to account for.

**What it actually uses.** Measured on the tarball's two binaries with `nm -u` plus a selector scan
of `__objc_methname`; the 634 `.h/.m/.mm/.swift/.cpp` sources reference none of these at all, which
is why a text grep alone would have reported a clean fork:

| Binary | Symbol | Category | Reason |
|---|---|---|---|
| `ios/dist/ViroRenderer/ViroKit.framework/ViroKit` | `stat`, `fstat` | `FileTimestamp` | `C617.1` — app-container assets (shaders, textures, `.mlmodelc`) |
| same | `mach_absolute_time` | `SystemBootTime` | `35F9.1` — frame clock |
| `ios/dist/lib/libViroReact.a` | none | — | — |

No `statfs`/`statvfs`/volume-capacity key, so no `DiskSpace`. No `NSUserDefaults`/`CFPreferences`, so
no `UserDefaults`. No `activeInputModes`. Both categories Viro does need were already declared for
`@sentry/react-native` and `expo-file-system`, so **the fork adds no new category** — the honest
change is that the app manifest now has a source, and that source names Viro as a reason each entry
exists.

**Fix shipped:** declared in `apps/mobile/app.config.ts` under `ios.privacyManifests`, with the
attribution written into the comments, and recorded in `vendors/README.md` with the command to
re-measure if the tarball is recut. Not added to the tarball's podspec: aggregating a vendored
framework's reasons into the app manifest is what the app manifest is for, and it avoids cutting a
52 MB `3.0.0-moyo.2` to carry two strings.

**One thing to watch.** `ViroKit.podspec` documents opt-in ARCore pods (`ARCore/CloudAnchors`,
`Geospatial`, `Semantics`) that are weak-linked and currently absent from the Podfile. Several
Firebase and GoogleUtilities pods they pull in ARE on Apple's list of SDKs that must ship a signed
privacy manifest. Enabling Cloud Anchors is a privacy-manifest decision, not only a product one.

### 8. ITMS-91053 — the app's privacy manifest now has a generated source · **FIXED**

**Was:** `apps/mobile/ios/Moyo/PrivacyInfo.xcprivacy` was committed and correct, but nothing in
source produced it, so `expo prebuild --clean` deleted it and the next upload would have failed
ITMS-91053 — an upload-time rejection, which nothing reaches review from.

**Fix shipped:** `ios.privacyManifests` in `apps/mobile/app.config.ts`. No new plugin file was
needed and none was added: `@expo/prebuild-config` already runs
`IOSConfig.PrivacyInfo.withPrivacyInfo` in its default plugin set, which writes the plist *and*
registers it in the Xcode target's Resources build phase — a hand-rolled `withDangerousMod` would
have had to redo the second half. `expo-build-properties` does not cover this; its
`privacyManifestAggregationEnabled` flag only merges manifests that CocoaPods dependencies ship for
themselves, and it was already `true` in the generated `Podfile.properties.json`.

**Verified by running it, twice, in a scratch worktree outside the repo:**

- Control — `0075ee7` unmodified, `npx expo prebuild --platform ios --clean --no-install`, exit 0:
  `ios/Moyo/PrivacyInfo.xcprivacy` does not exist. The deletion is real.
- With the fix — same command, exit 0: the file is regenerated. Parsed with `plistlib` against the
  committed copy, `NSPrivacyAccessedAPITypes`, `NSPrivacyTracking` and `NSPrivacyCollectedDataTypes`
  are equal; the generated file adds an empty `NSPrivacyTrackingDomains`, which is inert and correct
  beside `NSPrivacyTracking = false`. `project.pbxproj` carries the `PBXBuildFile`, the
  `PBXFileReference` and the `PrivacyInfo.xcprivacy in Resources` phase entry.

Nothing under `apps/mobile/ios/` was edited or committed — `git status apps/mobile/ios` is empty.

The drift this finding also named is unchanged and still worth settling: the committed `Info.plist`
carries `RCTNewArchEnabled` and the regenerated one does not. Decide whether `ios/` stays committed
at all. Either answer is defensible; the hybrid means nobody can tell which file wins.

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
- **One authored string exists and is silently discarded. Found in the re-audit at `0075ee7`, cause
  traced.** The Viro plugin is now registered and `app.config.ts:75-77` passes it
  `cameraUsagePermission: 'Moyo uses the camera so you can photograph your homework, and to place
  your whiteboard in the room.'` — at the **top level of the plugin's props**. The plugin reads it
  from `props.ios.cameraUsagePermission` (`node_modules/@reactvision/react-viro/plugins/withViroIos.ts:231-232`),
  so the option never matches and `DEFAULTS.ios.cameraUsagePermission` wins (`withViro.ts:5,201`).
  The re-audit prebuild confirms it: `NSCameraUsageDescription = "Allow $(PRODUCT_NAME) to use your
  camera"` and `NSMicrophoneUsageDescription = "Allow $(PRODUCT_NAME) to use your microphone"` —
  Viro's defaults, not `expo-image-picker`'s `"…to access your camera"` that the first audit saw.
  A prop nobody reads is worse than no prop: it reads as done.
- That also settles the precedence question this finding's fix depends on. `withViroIos.ts:257`
  resolves the string as `config.ios.infoPlist.NSCameraUsageDescription || cameraUsagePermission`,
  and `expo-image-picker` uses the same `||` shape, so **authoring in `ios.infoPlist` beats every
  plugin default** and makes the mis-nested Viro prop moot rather than needing a second fix.
  Deliberately not patched here: nesting the prop correctly would be a second way to set the same
  string, and this finding's fix removes the need for either.

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

### 10. The XR entry is hidden by a gate that no longer has a broken build behind it

**Corrected 2026-09-13 @ `0075ee7`.** This finding originally rested on the Viro plugin being absent
from `apps/mobile/app.config.ts`. It is there now — `['@reactvision/react-viro', { xRMode: ['AR'], cameraUsagePermission: … }]`
at `app.config.ts:71-78` — and the re-audit prebuild proves the linkage it produces: the generated
Podfile carries `pod 'ViroReact'` and `pod 'ViroKit'` (lines 62-63) and `project.pbxproj` carries two
`EXCLUDED_ARCHS` entries. So `VRTSceneNavigatorModule` will register on a real build,
`canOpenSpatialBoard()` will return true, and **the XR button will appear**. The paragraph below
about the renderer not linking is kept for the record and is no longer true.

That removes the accident that was doing the hiding, and leaves the rule doing it alone. The rule
still binds: the entry ships only when the device acceptance test is green, and `qa/walkthroughs/`
still has nothing for the spatial board. Finding 7 is now fixed, so of the four preconditions below
two remain — the walkthrough, and confirming `UIRequiredDeviceCapabilities` still excludes `arkit`
(it does, `[arm64]` only, re-verified in the re-audit prebuild).

The rule for this branch is that the spatial whiteboard ships only when the device acceptance test is green, and until then the capability check removes the button — a switch that reveals a half-working mode is a 2.3.1 hidden feature. Both halves currently hold, for reasons worth writing down.

The gate works. `packages/app/features/tutor/xr-capability.ts:26-32` returns true only when `NativeModules.VRTSceneNavigatorModule` exists, fails closed on unknown, and `packages/ui/XrBoardButton.tsx:60` returns `null` when `available` is false. `packages/app/features/tutor/tutor-screen.tsx:946` passes `available={canOpenSpatialBoard()}`. No button, no route.

The acceptance test is not green — it does not exist. `qa/walkthroughs/` holds `DEMO-SMOKE`, `NATALIE-HUMAN` and `NATIVE-3D-SMOKE`, all dated 2026-09-03, and nothing for the spatial board.

And the feature cannot build on iOS today. `@reactvision/react-viro` is in `apps/mobile/package.json:22` but is **not** in the `plugins` array of `apps/mobile/app.config.ts:44-168`. Its plugin is what appends `pod 'ViroReact'` and `pod 'ViroKit'` to the Podfile (`node_modules/@reactvision/react-viro/plugins/withViroIos.ts:50-51`) and sets `EXCLUDED_ARCHS` for the simulator. The generated Podfile contains zero `Viro` lines and the generated `project.pbxproj` contains zero `EXCLUDED_ARCHS` entries. So the renderer is not linked, `VRTSceneNavigatorModule` does not exist, and the gate hides the button — the right outcome by accident rather than by design.

**Before the XR entry ships:** ~~register the plugin~~ (done), author the purpose strings that plugin
is trying and failing to set (finding 4), produce a device acceptance walkthrough under
`qa/walkthroughs/`, ~~fix finding 7~~ (done), and confirm `UIRequiredDeviceCapabilities` still does
not list `arkit` (see RISK FLAG 14).

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
| In-app purchase for the family subscription | **Not shipping, and no longer advertised.** The iOS build has no paywall step and no price (RESOLVED 2). Nothing to create in App Store Connect unless IAP is chosen later |
| `PrivacyInfo.xcprivacy` reproduces from source | Yes — `ios.privacyManifests` in `app.config.ts`, verified against a clean prebuild (RESOLVED 8) |
| Privacy policy URL live and linked in-app | Pages exist at `apps/web-vite/src/routes/privacy.tsx` and `childrens-privacy.tsx`; **not linked in the app** — LIKELY REJECTION 6 |
| Terms of Use (EULA) link in the App Store Description | Not required by 3.1.2 while the iOS build sells nothing; still owed by 5.1.1(i) as an in-app link — LIKELY REJECTION 6 |
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
- [x] No subscription price and no purchase CTA render in the iOS build (3.1.1) — the paywall step is web-only. The seven required 3.1.2 paywall elements (title, duration, full renewal price as the most prominent price, what is provided, Terms, Privacy, Restore) become owed only if in-app purchase is ever shipped
- [ ] Icon and app name use no other developer's brand (4.1(c))
- [ ] Export compliance answered — TestFlight is not stuck on "Missing Compliance"
- [ ] Every IAP has a review screenshot and description — n/a today; there are no in-app purchases
- [ ] Tested on a physical device, cold install, in Airplane Mode too

---

This audit is not legal advice. Apple's guidelines change and reviewers apply them inconsistently;
the severities above are risk estimates, not guarantees. The detailed reasoning for the
children's-app specific findings — 5.1.2(i), 1.3/5.1.4, 5.1.1(v), 4.8, the privacy manifest,
purpose strings, the dev routes and the XR gate — is in `docs/release/app-store-readiness.md`.

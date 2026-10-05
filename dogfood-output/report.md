# Dogfood report — Moyo homework scanner (iOS simulator)

- Date: 2026-09-21
- Platform: iOS simulator
- Device: DVNT iPhone 17 Pro (UDID CE28894D-A2F5-470F-9339-5F0F69201F5C)
- App: com.moyolearn.app
- Session: /Users/mikevocalz/.agent-device/sessions/cwd_94f2bb7d2f4f039d_default
- Scope: Exercise the native homework scanner flow from the home screen through page review, OCR review, and manual text fallback.
- Branch: `codex/homework-scanner-audit-2026-09-21`. The remediations recorded below are committed there as `501d5c6` ("Park last week's homework-scanner work…"). They are **not** on `fix/tutor-room-plate-a11y` — on that branch `native-input.native.tsx` still renders the SwiftUI field, `(learner)/_layout.tsx` carries no `unstable_settings`, the Podfile has no `OTHER_LDFLAGS` restore, and `use-exit-tutor.*` does not exist. The companion audit is `docs/verification/homework-scanner-2026-09-21/` on the same branch.

## Severity summary

| Severity | Count |
| --- | --- |
| Critical | 0 |
| High | 3 |
| Medium | 1 |
| Low | 0 |

## Findings

### Issue 001 — Manual text entry screens are unreachable to accessibility/automation

- Severity: High
- Category: functional / accessibility
- Affected flow: Scanner → "We could not read this source" → "Type the words"; Scanner entry → "Type or paste the problem"

Repro commands:

```bash
agent-device open com.moyolearn.app --platform ios
agent-device click @e15  # "Snap your homework"
agent-device click @e13  # "Type or paste the problem"
agent-device click 196 280
agent-device type "1. What is 2+2?"
```

Expected: tapping the large text box focuses it, the keyboard appears, and typed text populates the field so the "Done" button enables.

Actual: repeated taps inside the text box (both `click` and `focus`) do not show a keyboard and do not focus an accessible text field. `agent-device type` fails with `XCTEST_RECORDED_FAILURE`. The accessibility snapshot lists no `text` or `text field` node inside either manual entry screen — only the scroll area and buttons are exposed. The "Done" button remains disabled, blocking the manual fallback path and preventing question grouping from being reached without a real OCR success.

Evidence:

- `./dogfood-output/screenshots/type-words.png`
- `./dogfood-output/screenshots/after-click-input.png`
- `./dogfood-output/screenshots/after-click-650.png`
- `./dogfood-output/screenshots/focus-attempt.png`
- `./dogfood-output/screenshots/type-problem-entry.png`
- `./dogfood-output/traces/type-words.txt`
- `./dogfood-output/traces/type-problem-entry.txt`

Notes: real finger touch may still work, but the lack of an accessibility text element means the screen is not usable with VoiceOver, switch control, or automated QA. This should be treated as a regression risk for the manual fallback path.

### Issue 002 — "Start over" on the OCR fallback returns to page review instead of the scanner entry point

- Severity: Medium
- Category: UX
- Affected flow: OCR review → "We could not read this source" → "Start over"

Repro commands:

```bash
agent-device open com.moyolearn.app --platform ios
agent-device click @e15  # "Snap your homework"
agent-device click @e11  # "Choose photos from your device"
agent-device click 65 230 # select first photo
agent-device click @e17  # "Looks good — next step"
agent-device click @e12  # "Start over"
```

Expected: "Start over" clears the current attempt and returns to the scanner entry screen ("Show Natalie your work") so the learner can pick a different input method.

Actual: the app returns to "Review your pages" with the previously captured page still present. The learner must separately tap "Remove page 1" and then "Add another page" to restart cleanly.

Evidence:

- `./dogfood-output/screenshots/after-start-over.png`
- `./dogfood-output/traces/after-start-over.txt`

### Issue 003 — Tutor screen back button dead-ends; learner is trapped in a session

- Severity: High
- Category: functional / navigation
- Affected flow: Any entry into `/tutor` (Today → "Talk to Natalie"; scanner → tutoring handoff) → session toolbar back chevron

Repro commands:

```bash
agent-device open com.moyolearn.app --platform ios
agent-device click @e-card  # "Talk to Natalie"
agent-device click 18 64    # session toolbar back chevron
```

Expected: the back chevron returns to the learner home (Today tab).

Actual: nothing happens. The console logs `The action 'GO_BACK' was not handled by any navigator` once per tap (five times observed). The iOS edge-swipe back gesture also fails, while other top-area controls ("Show Natalie") respond — so the touch lands, the action fires, and no navigator at any level has an entry to pop. The pushed `tutor` route landed in the `(learner)` group stack with no `(tabs)` entry beneath it — consistent with expo-router rebuilding the group's state through the linking path when a route is pushed from a nested tab navigator.

Evidence:

- Simulator console: `GO_BACK` unhandled ×5
- Direct-path repro: Today → "Talk to Natalie" → back (fails identically, so it is not specific to the capture handoff)

### Issue 004 — ExecuTorch inference backends never registered; every OCR attempt fails with `Error::NotFound`

- Severity: High
- Category: functional / native build
- Affected flow: Scanner → "Choose photos" → any page → "Looks good — next step" → OCR

Expected: the PP-OCRv6 model loads and returns recognized text.

Actual: `readPaddlePage` resolved to the OCR fallback on every attempt. Instrumenting the coordinator surfaced `RnExecuTorchError: Load method 'recognize' failed — Error::NotFound`, and `getExecuTorchRegisteredBackends()` reported only `["MPSBackend"]`. Both the Core ML and XNNPACK `.pte` artifacts downloaded and sha256-verified correctly; the failure was in the native binary, not the JS pipeline.

Root cause: `RNSentry.podspec` and `react-native-executorch.podspec` both declare `user_target_xcconfig` values for `OTHER_LDFLAGS[sdk=iphoneos*]` and `OTHER_LDFLAGS[sdk=iphonesimulator*]`. CocoaPods cannot merge two declarations of one conditional key, silently drops the loser, and neither line reached `Pods-Moyo.{debug,release}.xcconfig`. The `-force_load` archives for `XnnpackBackend.xcframework` / `CoreMLBackend.xcframework` (whose backends register through `__attribute__((constructor))`) were therefore never linked; only `MPSBackend`, which lives inside `ExecutorchLib` itself, survived the linker's dead-strip.

Evidence:

- Simulator console: `RnExecuTorchError: Load method 'recognize' failed … Error::NotFound`
- Debugger eval: `getExecuTorchRegisteredBackends()` → `["MPSBackend"]`
- `Pods/Target Support Files/Pods-Moyo/Pods-Moyo.*.xcconfig` lacked any `OTHER_LDFLAGS[sdk=iphone…]` line before the fix.

## Positive observations

- The JSI runtime initialization failure (`__rnexecutorch_jsi__ is not registered`) is resolved after the `react-native-executorch` iOS patch.
- The app builds, installs, and launches on the iPhone 17 Pro simulator.
- Home → "Snap your homework" → photo picker → "Review your pages" → OCR review screen all navigate correctly.
- The OCR review screen shows live model download progress ("Downloading the text reader") and surfaces an appropriate fallback message for a non-text photo.
- The photo-library path completes end to end: picker → "Review your pages" → "Reading your page…" → "Fix the words" populated with recognized text.
- PP-OCRv6 XNNPACK inference verified on the math fixture (`docs/verification/homework-baseline-2026-09-16/critical-math.png`): six lines recognized at 0.92–1.00 confidence with bounding quads — `12÷4` (1.00), `12+ 4` (0.92), `-32` (0.93; the superscript in `-3²` was lost), `(-3)²` (0.96), `1/(x + 1)` (0.96), `1/x + 1` (0.92).
- Page removal works and correctly disables the "Looks good" button when zero pages remain.

## Remediation status

- Issue 001 (manual text entry unreachable): **fixed and re-verified on simulator.** `packages/ui/html/native-input.native.tsx` now renders React Native's `TextInput` on iOS (the hosted SwiftUI field never entered the accessibility tree or resolved touches); Android keeps the Compose field. Verified: tap focuses the field, keyboard opens, typing populates, "Done" enables, and the full manual path reaches question grouping and the tutoring handoff ("Start with Natalie" → tutor room with the typed problem as the working-on card).
- Issue 002 ("Start over" kept the unreadable page): **fixed and re-verified on simulator.** `capture-screen.tsx` + `ocr-review-base.tsx`: leaving the review drops the failed page; when it was the only page the flow lands on the scanner entry. Verified: photo → OCR fallback → "Start over" → scanner entry ("Show Natalie your work").
- Issue 003 (tutor back dead-end): **fixed and re-verified on simulator.** `apps/mobile/app/(learner)/_layout.tsx` now exports `unstable_settings = { initialRouteName: '(tabs)' }` so the tab root always sits beneath a pushed learner route, and `packages/app/features/tutor/use-exit-tutor.{native,web}.ts` gives the toolbar a `canGoBack()`-checked exit that falls back to `router.replace('/')` for a deep-linked session. Verified: Today → "Talk to Natalie" → back chevron → Today.
- Issue 004 (ExecuTorch backends unregistered): **fixed and re-verified on simulator.** `apps/mobile/ios/Podfile` `post_install` now restores the `OTHER_LDFLAGS[sdk=iphoneos*]` / `[sdk=iphonesimulator*]` lines the podspec declared (threadpool archive + `-force_load` on the XNNPACK/Core ML backend archives), merging into an existing conditional line if one ever appears so a later `pod install` cannot clobber another pod's flags. Verified: `getExecuTorchRegisteredBackends()` → `["MPSBackend","XnnpackBackend","CoreMLBackend"]`, and the picker → OCR → "Fix the words" path returns the recognized text above.

## Residual risk / not covered

- OCR now runs on the simulator through the XNNPACK backend; the Core ML path is exercised only on physical hardware (the simulator cannot run it), so device-quality results are still outstanding.
- Physical-device quality, latency, memory, energy, and thermal measurements remain uncollected.
- Camera capture path ("Take a photo of your work") was not exercised because the simulator camera feed is blank and the focus of this pass was the pipeline after source selection.
- No measurements were taken of model load time, inference duration, or RSS.
- One unrelated console error observed during the pass: `Uncaught (in promise) Error: fetch failed: Could not connect to the server` — a background fetch to a backend that is not running in this environment.

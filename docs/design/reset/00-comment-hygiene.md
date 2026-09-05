# Comment-hygiene sweep list

Deliverable 0 of the reset (`docs/design/moyo-design-reset-v2-brief.md` §11). The rule is in `prompts/ROSTER.md`: a comment states the intent the code cannot show. A comment that narrates what the code used to be is a changelog entry in the wrong place, and it is the single loudest tell that a reader picks up when deciding whether a repo was written by a person.

Not every hit is a violation. A comment explaining *why a constraint exists* often needs a sentence of history to be legible — "grep exits 1 for no match, and swallowing that once reported 91 exports as unused" earns its past tense, because the past tense is the argument. What fails review is history with no rule attached: the incident retold, the fix congratulated, the old value mourned.

## How this list was made

```
grep -rnE "^[[:space:]]*(//|\*|/\*)[[:space:]]*.*\b(used to|it was|previously|this fixes|fixed the|the bug where|earlier version|first version|the original|once reported|before this|had been|we tried|turned out|was already)\b" \
  packages/ui packages/app apps/mobile/app apps/web/app --include='*.ts' --include='*.tsx'
```

115 hits across the four source roots on `design/reset-v2` at the commit that added this file. The list is a starting point for review, not a delete list — each line gets one of three verdicts:

- **rewrite** — the constraint is real, the history is not. State the rule in the present tense and drop the story.
- **keep** — the history *is* the argument for the constraint, and removing it would leave a rule nobody can check.
- **delete** — neither a rule nor a constraint, just a note about a past commit.

## Files by hit count

| File | Hits |
|---|---|
| `packages/ui/TutorPresence.tsx` | 3 |
| `packages/ui/audio/AudioPlayer.native.tsx` | 3 |
| `packages/app/features/tutor/tutor-audio.ts` | 3 |
| `packages/app/features/tutor/coach.service.ts` | 3 |
| `packages/app/features/safety/incidents.service.ts` | 3 |
| `packages/app/features/memory/memory.store.ts` | 3 |
| `packages/app/features/capture/ocr-web.ts` | 3 |
| `packages/ui/use-hydrated.ts` | 2 |
| `packages/ui/TutorThread.tsx` | 2 |
| `packages/ui/html/dom.native.tsx` | 2 |
| `packages/app/providers/entitlements/gate-decision.ts` | 2 |
| `packages/app/features/tutor/tutor.store.ts` | 2 |
| `packages/app/features/tutor/tutor-audio.test.ts` | 2 |
| `packages/app/features/summary/use-reports.ts` | 2 |
| `packages/app/features/shell/app-header.web.tsx` | 2 |
| `packages/app/features/onboarding/guardian/steps.ts` | 2 |
| `apps/web/app/api/memory/erase-transcript/route.ts` | 2 |
| `apps/mobile/app/_layout.tsx` | 2 |
| `packages/ui/use-autogrow.native.ts` | 1 |
| `packages/ui/typography.ts` | 1 |
| `packages/ui/TutorStage.tsx` | 1 |
| `packages/ui/tutor-message.ts` | 1 |
| `packages/ui/Switch.tsx` | 1 |
| `packages/ui/stage-board/geometry.ts` | 1 |
| `packages/ui/NavDrawerButton.tsx` | 1 |
| `packages/ui/MessageBubble.tsx` | 1 |
| `packages/ui/keyboard-aware.web.tsx` | 1 |
| `packages/ui/file-trigger.web.tsx` | 1 |
| `packages/ui/adaptive-panes/sticky-header.ts` | 1 |
| `packages/ui/adaptive-panes/resize.ts` | 1 |
| `packages/ui/adaptive-panes/CollapsiblePane.tsx` | 1 |
| `packages/app/providers/entitlements/gate-decision.test.ts` | 1 |
| `packages/app/features/tutor/tutor-safety.ts` | 1 |
| `packages/app/features/tutor/tutor-opening.tsx` | 1 |
| `packages/app/features/tutor/tutor-model.ts` | 1 |
| `packages/app/features/tutor/tutor-avatar.tsx` | 1 |
| `packages/app/features/tutor/tutor-avatar-3d.web.tsx` | 1 |
| `packages/app/features/tutor/tutor-avatar-3d.tsx` | 1 |
| `packages/app/features/tutor/session.types.ts` | 1 |
| `packages/app/features/tutor/fail-closed.server-test.ts` | 1 |
| `packages/app/features/summary/summary.service.ts` | 1 |
| `packages/app/features/schedule/NotesEditor.stories.tsx` | 1 |
| `packages/app/features/schedule/fixtures.ts` | 1 |
| `packages/app/features/schedule/event-drag.native.tsx` | 1 |
| `packages/app/features/safety/screen.native.tsx` | 1 |
| `packages/app/features/safety/org-safety-content.tsx` | 1 |
| `packages/app/features/safety/incidents.server-test.ts` | 1 |
| `packages/app/features/safety/incident-queue-content.tsx` | 1 |
| `packages/app/features/safety/guardian-alerts-content.tsx` | 1 |
| `packages/app/features/practice/practice-hub.tsx` | 1 |
| `packages/app/features/plan/plan.data.ts` | 1 |
| `packages/app/features/ops/family-groups.ts` | 1 |
| `packages/app/features/ops/family-groups.test.ts` | 1 |
| `packages/app/features/ops/families-content.tsx` | 1 |
| `packages/app/features/notifications/notifications-content.tsx` | 1 |
| `packages/app/features/memory/memory.store.test.ts` | 1 |
| `packages/app/features/media/upload-queue.store.ts` | 1 |
| `packages/app/features/media/upload-queue.shared.ts` | 1 |
| `packages/app/features/media/retention.ts` | 1 |
| `packages/app/features/institution/placeholder-screen.tsx` | 1 |
| `packages/app/features/home/student-home-content.tsx` | 1 |
| `packages/app/features/home/parent-home-content.tsx` | 1 |
| `packages/app/features/family/family.store.ts` | 1 |
| `packages/app/features/editor/icon-map.ts` | 1 |
| `packages/app/features/editor/download.types.ts` | 1 |
| `packages/app/features/editor/capabilities.ts` | 1 |
| `packages/app/features/editor/AudioRecorderSheet.web.tsx` | 1 |
| `packages/app/features/editor/AudioRecorderSheet.native.tsx` | 1 |
| `packages/app/features/editor/audio.store.ts` | 1 |
| `packages/app/features/conference/hub-screen.tsx` | 1 |
| `packages/app/features/capture/upload-phase.ts` | 1 |
| `packages/app/features/capture/upload-phase.test.ts` | 1 |
| `packages/app/features/capture/transcribe.native.ts` | 1 |
| `packages/app/features/capture/read-document.ts` | 1 |
| `packages/app/features/capture/ocr-review.tsx` | 1 |
| `packages/app/features/capture/CameraSheet.native.tsx` | 1 |
| `packages/app/features/capture/age-band.ts` | 1 |
| `packages/app/features/assignments/use-learner-assignments.ts` | 1 |
| `packages/app/features/ai-activity/safety-status.service.ts` | 1 |
| `packages/app/core/telemetry-scrub.ts` | 1 |
| `packages/app/core/protected-operation.ts` | 1 |
| `packages/app/core/capability-gate.ts` | 1 |
| `apps/web/app/api/tutor/session/message/route.ts` | 1 |
| `apps/web/app/api/tutor/next/route.ts` | 1 |
| `apps/web/app/api/ops/families/route.ts` | 1 |
| `apps/web/app/api/guardian/reports/[sessionId]/share/route.ts` | 1 |
| `apps/web/app/(guardian)/alerts/page.tsx` | 1 |
| `apps/mobile/app/onboarding/dev.tsx` | 1 |
| `apps/mobile/app/(org)/(tabs)/overview.tsx` | 1 |
| `apps/mobile/app/(org)/(tabs)/_layout.tsx` | 1 |

## Every hit

| Location | Comment |
|---|---|
| `packages/ui/TutorThread.tsx:66` | * It used to render outside the scroll view, between the thread and the |
| `packages/ui/TutorThread.tsx:73` | * shape and it was measured wrong on device: LegendList clamped the list's |
| `packages/ui/TutorPresence.tsx:4` | // WHY THIS EXISTS: the stage used to draw the avatar inside a single branch of |
| `packages/ui/TutorPresence.tsx:43` | //    its own loop. That is a performance bug, and it was fixed there — but it |
| `packages/ui/TutorPresence.tsx:122` | * is not revealed — so a reveal resumes the tutor that was already there |
| `packages/ui/Switch.tsx:23` | * This used to host the platform control (`@expo/ui` SwiftUI Toggle / Material |
| `packages/ui/file-trigger.web.tsx:41` | // re-replaced with the original after a mis-pick. |
| `packages/ui/MessageBubble.tsx:18` | * on where it was raised, not in a second place they have to look across to. |
| `packages/ui/TutorStage.tsx:112` | * the header had been carrying her name instead, which left the session |
| `packages/ui/use-autogrow.native.ts:3` | // This used to run RN's `onContentSizeChange` loop: measure the content, store |
| `packages/ui/typography.ts:12` | // Measured on apps/web-vite: 199.11 kB gz of initial JS before this entry |
| `packages/ui/keyboard-aware.web.tsx:34` | * host's flex layout exactly as it was written. |
| `packages/ui/tutor-message.ts:3` | // The stage used to render ONE state — the current thing Natalie was saying — |
| `packages/ui/NavDrawerButton.tsx:26` | // drawer in the product, which the scrim previously occupied with no glyph. |
| `packages/ui/use-hydrated.ts:3` | // It lived in `motion.tsx` because that is where it was first needed, and that |
| `packages/ui/use-hydrated.ts:22` | // a client-only API, and while it sat inside motion.tsx it was shielded by that |
| `packages/ui/html/dom.native.tsx:28` | * This previously rendered a `View` with a `Text` inside and DISCARDED |
| `packages/ui/html/dom.native.tsx:29` | * `onValueChange`, so on native it was a label shaped like a control: it could |
| `packages/ui/audio/AudioPlayer.native.tsx:41` | * levels along, and the player only decodes the file when it was not given any |
| `packages/ui/audio/AudioPlayer.native.tsx:43` | * the same recording look different depending on where it was opened. |
| `packages/ui/audio/AudioPlayer.native.tsx:143` | * a new one from the offset. Playback resumes only if it was already running, |
| `packages/ui/adaptive-panes/resize.ts:37` | * had been paid off. |
| `packages/ui/adaptive-panes/CollapsiblePane.tsx:41` | * its old size and a blank strip would sit where the pane used to be. The |
| `packages/ui/adaptive-panes/sticky-header.ts:27` | * does nothing until you scroll back past the original anchor. A delta lets the |
| `packages/app/core/telemetry-scrub.ts:99` | * Deleting `contexts` wholesale was the first version and it was wrong: |
| `packages/app/core/protected-operation.ts:206` | * told "Natalie is taking a break" forever, and the mechanism reporting it was |
| `packages/app/providers/entitlements/gate-decision.ts:2` | // separate from the component so the one branch that used to hand paid features |
| `packages/app/providers/entitlements/gate-decision.ts:5` | // THE UNLOADED DEFAULT, and why it changed. This gate used to render its |
| `packages/ui/stage-board/geometry.ts:78` | * arrowing left and back right returns the card to where it was. |
| `packages/app/core/capability-gate.ts:36` | * Refusal carries the capability and the reference it was judged against so a |
| `packages/app/providers/entitlements/gate-decision.test.ts:1` | // The client gate's unloaded branch, which used to render the CHILDREN — so with |
| `packages/app/features/home/parent-home-content.tsx:205` | * that used to be missing everywhere is the split at the bottom: "waiting for |
| `packages/app/features/home/student-home-content.tsx:15` | // The due-work read now has a visible failure. It used to be destructured for |
| `packages/app/features/capture/CameraSheet.native.tsx:10` | // first (CLAUDE.md, "never invent a second way") — it was the worse one, on the |
| `packages/app/features/capture/age-band.ts:223` | * This used to collapse to the plane's two-value register instead, which threw |
| `packages/app/features/capture/upload-phase.test.ts:27` | // The P0 this file exists for: failed > 0 && online used to fall through |
| `packages/app/features/capture/ocr-web.ts:7` | //    problems it is good. On handwriting it is poor — it was trained on print, |
| `packages/app/features/capture/ocr-web.ts:36` | * First it was a confidence of 70, on the theory that Tesseract is reliably |
| `packages/app/features/capture/ocr-web.ts:42` | * Then it was 8 characters. That read is 7. A number picked to feel safe cut |
| `packages/app/features/capture/upload-phase.ts:3` | // Exists because the phase used to be derived inline and had a hole: a batch |
| `packages/app/features/capture/transcribe.native.ts:33` | * `react-native-audio-api` was already a dependency of this package. It is |
| `packages/app/features/capture/read-document.ts:6` | // generic reply, which is the same dead end a photograph used to be. |
| `packages/app/features/schedule/fixtures.ts:23` | * It used to be pinned to a fixed 2026-06-15, which made the calendar open on |
| `packages/app/features/capture/ocr-review.tsx:4` | // This used to say "Text scanning is only available in the app." That was a |
| `packages/app/features/schedule/event-drag.native.tsx:17` | * SMOOTHNESS, and why the first version was not: |
| `packages/app/features/schedule/NotesEditor.stories.tsx:8` | // — it was docgen, not this component, that broke the module import. |
| `packages/app/features/assignments/use-learner-assignments.ts:24` | * `retry` leaves the hook because the plan owes one. A failed read here used to |
| `packages/app/features/memory/memory.store.ts:35` | * Puts a fact back where it was after a failed erasure. |
| `packages/app/features/memory/memory.store.ts:126` | * event: it means the line was already gone, which is the outcome asked for. |
| `packages/app/features/memory/memory.store.ts:219` | * lie `confirmForgetAll` used to tell unconditionally. |
| `packages/app/features/memory/memory.store.test.ts:9` | // `confirmEraseTranscript` and `confirmForgetAll` did the same after it was |
| `packages/app/features/conference/hub-screen.tsx:10` | // this screen used to carry. |
| `packages/app/features/plan/plan.data.ts:116` | * simply still names the day it was due. |
| `packages/app/features/shell/app-header.web.tsx:11` | // "never invent a second way" is the rule it was standing on. `AppHeaderTheme` |
| `packages/app/features/shell/app-header.web.tsx:22` | * It used to be a hand-written union of seven short names ('lavender', plus |
| `packages/app/features/ai-activity/safety-status.service.ts:57` | /** Whose turn it was, so a two-child household knows who to go and find. */ |
| `packages/app/features/family/family.store.ts:49` | * `selectedLearnerId ?? first child` — the default consumers previously derived |
| `packages/app/features/safety/screen.native.tsx:6` | // twice. (It used to claim the bottom edge and push the list off the tab bar.) |
| `packages/app/features/safety/org-safety-content.tsx:174` | * (here and in the row's caption), and each chip posts the roster id it was |
| `packages/app/features/safety/incidents.service.ts:9` | // function a test can drive with rows it was never supposed to see. |
| `packages/app/features/safety/incidents.service.ts:112` | /** Whose it was, so a two-child household knows who to go and find. */ |
| `packages/app/features/safety/incidents.service.ts:147` | *     somebody else's child is not shown even if the query that fetched it was |
| `packages/app/features/safety/incident-queue-content.tsx:20` | // assignee against it, so the deferral this comment used to record is closed |
| `packages/app/features/safety/incidents.server-test.ts:6` | // projection with rows it was never supposed to be handed: another household's |
| `packages/app/features/safety/guardian-alerts-content.tsx:15` | //     visible below (append-only), each dated with when it was acknowledged. |
| `packages/app/features/tutor/tutor.store.ts:38` | * Kept because the stage used to render only the CURRENT turn, so a photo a |
| `packages/app/features/tutor/tutor.store.ts:308` | // there. The canned two-rung hint ladder this used to open with is gone: |
| `packages/app/features/institution/placeholder-screen.tsx:13` | // Second, it takes the org as a CLASSIFIED read. The org name used to arrive |
| `packages/app/features/tutor/tutor-safety.ts:147` | * `aiEnabled` used to be the literal `true`, which made the plane's `refused` |
| `packages/app/features/tutor/tutor-model.ts:3` | // This file used to be the vendor surface: it held the SDK import, the model |
| `packages/app/features/tutor/session.types.ts:1` | // The conversation, as something that outlives the tab it was typed into. |
| `packages/app/features/tutor/coach.service.ts:56` | * The photograph itself, on the turn it was attached to. |
| `packages/app/features/tutor/coach.service.ts:146` | * Four positional ports was already one too many, and the safety-event writer |
| `packages/app/features/tutor/coach.service.ts:202` | * this generator's `try`, including the band lookup — which used to run in |
| `packages/app/features/tutor/tutor-avatar-3d.tsx:6` | // This file used to BE the web half, and the whole of it was `return null`: |
| `packages/app/features/tutor/tutor-audio.test.ts:389` | // The race that matters: the body was already on the wire when the child |
| `packages/app/features/tutor/tutor-audio.test.ts:459` | // The failure this prevents: one POST that never answers used to leave the |
| `packages/app/features/tutor/tutor-opening.tsx:5` | // attached to it, and until now it was the single sentence "No problem |
| `packages/app/features/tutor/tutor-avatar.tsx:90` | * It used to check `Platform.OS` as well, because the renderer existed only on |
| `packages/app/features/tutor/tutor-audio.ts:10` | // WHY THE PIPELINE. This queue used to fetch sentence N, await its whole body, |
| `packages/app/features/tutor/tutor-audio.ts:36` | //     drift from the sound it was made from; |
| `packages/app/features/tutor/tutor-audio.ts:534` | // even though the buffer behind it was decoded ahead of time. |
| `packages/app/features/tutor/fail-closed.server-test.ts:56` | * A recorder that keeps what it was given, so a test can assert on the row a |
| `packages/app/features/tutor/tutor-avatar-3d.web.tsx:24` | *     textures the way it was written to. |
| `packages/app/features/ops/family-groups.test.ts:4` | // tests used to cover). |
| `packages/app/features/ops/family-groups.ts:4` | // ADR-109 retired the interim name-text derivation this file used to hold: |
| `packages/app/features/practice/practice-hub.tsx:4` | // This route used to open straight into the player, so the screen answered |
| `packages/app/features/ops/families-content.tsx:6` | // Rows OPEN now: the deferral this file used to record — "there is no |
| `packages/app/features/notifications/notifications-content.tsx:117` | // The heading used to sit over pure whitespace when the list was |
| `packages/app/features/editor/audio.store.ts:27` | * The recorder used to report nothing between "start" and "here is a file", so |
| `packages/app/features/editor/icon-map.ts:12` | * of throwing when the toolbar renders. This used to be `Record<string, …>` |
| `packages/app/features/editor/capabilities.ts:75` | * Returns the whole `VoiceRecording`, `levels` included. It used to be typed |
| `packages/app/features/editor/download.types.ts:7` | /** Resolves the local URI the file now lives at, or null when it was cancelled. */ |
| `packages/app/features/editor/AudioRecorderSheet.native.tsx:41` | // them, and this line is where they used to be discarded. |
| `packages/app/features/editor/AudioRecorderSheet.web.tsx:4` | // This used to resolve every request as cancelled, on the grounds that |
| `packages/app/features/summary/summary.service.ts:406` | * fetched it was wrong. |
| `packages/app/features/media/upload-queue.store.ts:10` | // in memory is a queue that loses exactly what it was built to protect. |
| `packages/app/features/onboarding/guardian/steps.ts:23` | // `grants` is GONE (pane-audit-37 §A.2): it was a heading and one prose line |
| `packages/app/features/onboarding/guardian/steps.ts:25` | // keeping it was a faked surface. Tutor visibility lives on the family screen. |
| `packages/app/features/media/retention.ts:15` | // own 30-day window. What expires is the original picture and the original |
| `packages/app/features/summary/use-reports.ts:25` | * this list's consumer used to destructure `{reports, loading}` and drop the |
| `packages/app/features/summary/use-reports.ts:56` | * while a 401/500 owes an honest failure and a retry. Both used to arrive as |
| `packages/app/features/media/upload-queue.shared.ts:58` | * The drain used to delete the item and return nothing, so the location Bunny |
| `apps/mobile/app/(org)/(tabs)/_layout.tsx:14` | * could not say which kind of number it was. |
| `apps/mobile/app/onboarding/dev.tsx:5` | // route used to re-export it bare, so on any device the eleven persona rows |
| `apps/mobile/app/_layout.tsx:10` | // src/executorch.native.ts for the failure this fixes (error code 186). |
| `apps/mobile/app/_layout.tsx:46` | // before any shell exists. All three used to render with no bar at all. |
| `apps/web/app/(guardian)/alerts/page.tsx:2` | // notifications (the nav's Alerts item used to point at /notifications, |
| `apps/mobile/app/(org)/(tabs)/overview.tsx:5` | // Overview·Schedule·Inbox·Safety only). This tab used to render the entire |
| `apps/web/app/api/memory/erase-transcript/route.ts:5` | // file, left behind by the commit that fixed the first one. A guardian deleted an |
| `apps/web/app/api/memory/erase-transcript/route.ts:11` | // takes every belief it was the sole source of and trims itself out of the |
| `apps/web/app/api/ops/families/route.ts:2` | // stage rollup over its leads. The derivation this route used to serve |
| `apps/web/app/api/guardian/reports/[sessionId]/share/route.ts:8` | // re-sharing rotates the secret, which retires any previously shared link. |
| `apps/web/app/api/tutor/next/route.ts:4` | // every other reader of the model. It used to `find` `studentModelFacts` inline |
| `apps/web/app/api/tutor/session/message/route.ts:11` | // answer a genuinely missing session gets, so the endpoint cannot be used to |

## Where to start

`packages/ui/TutorPresence.tsx`, `packages/ui/ReadFailure.tsx` and `packages/ui/Banner.tsx` open with a paragraph of incident narration before they say what the component is. They are also three of the components the reset touches directly, so the rewrite lands in the same PR as the work rather than as a separate cleanup nobody schedules.

The rewrite that works: lead with what the thing is and the rule it keeps, then, only if the rule needs defending, one sentence of why. `TutorPresence` becomes "Natalie is the conversation's other participant, so she is rendered once outside the state switch — a presence that lives inside a state would disappear whenever the state changed." One sentence, same constraint, no incident report.

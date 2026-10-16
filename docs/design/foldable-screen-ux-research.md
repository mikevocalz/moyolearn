# Moyo Learn — foldable UI/UX research and screen implementation plan

<!-- What: adaptive screen requirements and the evidence needed to implement them. -->
<!-- Why: navigation hardware identity and pane geometry must remain independent. -->
<!-- SOT: AGENTS.md; pinned mikevocalz-foldable-layouts; packages/ui/adaptive-navigation.ts. -->
<!-- SOT-KEYWORDS: foldable adaptive research navigation acceptance matrix -->

Status: research-backed engineering specification; no runtime changes or device validation claimed.

## Evidence and required skills

Read `AGENTS.md` and the pinned `mikevocalz-foldable-layouts` skill first. Also load FloWritesCode/fwc-swiftui-skills (`swiftui-iphone-duo`, reference.md), Expo skills, mattpocock/skills, Argent/agent-device, pbakaus/impeccable, petergyang/no-ai-slop, and the existing repository's UI/accessibility/testing instructions. Apply SwiftUI guidance to Apple-native adapters, not directly to React Native views. Research sources:

- <https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo>
- <https://developer.apple.com/videos/play/tech-talks/111463/>
- <https://developer.android.com/develop/adaptive-apps/guides/foldables/learn-about-foldables>
- <https://developer.android.com/develop/adaptive-apps/guides/get-started-with-adaptive-apps>
- <https://android-developers.googleblog.com/2023/06/detecting-if-device-is-foldable-tablet.html>
- <https://thiagobrez.github.io/react-native-arrangement-view/index.html>
- <https://thiagobrez.github.io/react-native-arrangement-view/guide/installation>

## Non-negotiable navigation contract

Native ordinary phone: existing bottom tabs. Native foldable even folded-cover, tablet and headset: physical RIGHT rail even in RTL and compact windows. Web: persistent header and compact bottom tabs, no side rail. Hardware identity and transient window width must not be conflated. Preserve Expo Router ownership, AdaptivePanes, SplitView.Inspector, Zustand and semantic UI. Product motion uses `@legendapp/motion` through `packages/ui/motion.tsx`; marketing uses the existing GSAP/Lenis adapters. Kinetrell is not installed and is not an adoption decision in this specification. Do not add a second navigation framework or a generic leading rail.

## Design roster and review ownership

- Principal adaptive-layout engineer: pane planning, fold geometry, WindowManager/Expo Modules bridge, activity recreation
- Principal React Native/Expo engineer: component identity, Expo Router integration, native build compatibility
- Principal iOS engineer: iPhone Duo reserved regions, arrangement APIs, availability gates, simulator tests
- Staff product designer: Moyo design tokens, visual hierarchy, responsive information architecture
- Senior interaction designer: reachability, tabletop controls, drag/stylus/keyboard, transition continuity
- Accessibility specialist: large text, screen readers, switch/keyboard navigation, RTL
- Test/performance engineer: boundary matrices, physical-device evidence, no remounts/duplicate sessions

These are review roles, not assertions that people have been assigned.

## Screen-by-screen UX direction

1. **Student home**: compact single learning feed; unfolded: assignments and next lesson alongside mastery/progress; maintain readable card widths.
2. **AI Tutor Room**: canonical session owner above adaptive wrapper; compact scene/desk switching, unfolded scene + whiteboard with optional Inspector; tabletop scene/video above, drawing/response controls below; preserve mic, interruption, OCR, timers and avatar identity.
3. **Human tutoring room / conference**: video/whiteboard/chat participants are separate complementary panes; never put controls over hinge; avoid reconnecting Fishjam/camera on resize.
4. **Tutor marketplace and profile**: search/filter list + selected tutor detail; Inspector for availability and booking, not a duplicate profile.
5. **Parent dashboard**: child selector + selected child's progress, schedule and activity; avoid cross-child data leakage and preserve selection through fold.
6. **Human tutor workspace**: roster + learner detail + notes/assignments Inspector; keyboard and stylus-first tablet ergonomics.
7. **Teacher/school/district**: roster/table or cohorts + detail + Inspector; scoped permissions and density, accessible sorting and filters.
8. **Business OS**: schedule calendar + appointment detail; CRM + student profile; campaign editor + preview + Inspector; invoice lists + detail. Do not copy PaCasa's 40/60/30 ratios.
9. **Admin**: persistent navigation and table density only when usable width permits; overlays constrained to the usable segment.

## ArrangementView adoption decision

`react-native-arrangement-view` is a candidate **implementation adapter** for related primary/secondary content, never the router or a replacement for AdaptivePanes. Inspect the exact installed/available version, its installation guide, native Expo development-build requirements, iOS/Android support, props and callbacks, lifecycle and Fabric compatibility before adding it. No guessed API names. Compare against Expo SDK 58 `@expo/ui` Apple-native arrangement support; avoid double ownership of one pane. Feature-gate native support and retain current AdaptivePanes as the fallback. For web use semantic responsive layouts. For XR preserve Viro's compositor ownership.

The 2026-10-16 baseline inspection found no `react-native-arrangement-view`
dependency in the workspace catalog or mobile manifest. The frozen install
resolved `@expo/ui` 58.0.8, which exports `NavigationSplitView`; the presence of
that component does not prove fold-geometry or ArrangementView compatibility.
Expo is pinned to `58.0.0-preview.8` and React Native to `0.88.0-rc.2`.
Retain the existing pane implementation. Adding the candidate library remains
blocked on version-specific API, lifecycle and native-build evidence.

## Baseline acceptance matrix (2026-10-16)

`node --test packages/ui/adaptive-navigation.test.ts
packages/ui/adaptive-panes/fold-layout.test.ts
packages/ui/adaptive-panes/split-view.test.ts` passed 50 tests. Several navigation
tests assert behavior that conflicts with the current product contract. A green
test run therefore does not establish contract compliance.

“Partial” below means a pure unit test covers part of the scenario; the complete
scenario remains unverified. No browser, simulator or physical-device acceptance
was performed for this audit.

| Required scenario | Baseline evidence | Status |
| --- | --- | --- |
| Ordinary phone resized wide | Resolver classifies Android by width; input has no stable hardware-family discriminator. | Fails contract |
| Narrow foldable cover without an active hinge | Existing cover test expects bottom tabs at 390dp. | Fails contract |
| Same cover in RTL | Same width-based bottom-tab branch; RTL cannot restore a right rail. | Fails contract |
| Tablet/headset window resized narrow | Apple compact branch and narrow Android branch select bottom tabs; family is unavailable. | Fails contract |
| Unknown capability later resolves to foldable | No capability input/state exists in the navigation resolver. | Unverified |
| Phone-width web on foldable | Native resolver is not evidence for the web header/tab host. | Unverified |
| Wide/intermediate web | Browser header/menu rendering not exercised. | Unverified |
| Vertical occluding hinge | Unit tests cover Android normalization and pane boundary placement. | Partial |
| Zero-width separating fold | Unit test preserves an in-row separating crease. | Partial |
| Flat non-separating crease | Unit test does not rearrange content for this crease. | Partial |
| Horizontal tabletop hinge | Existing navigation test expects bottom navigation at expanded width. | Fails contract |
| Multiple features and offset host | Unit tests cover multiple vertical hinges, off-row filtering and local x conversion. | Partial |
| Inspector in book posture and RTL | Unit tests constrain logical trailing Inspector geometry; rendered frames/session identity untested. | Partial |
| Large text/keyboard in narrow segment | No rendered reachability evidence. | Unverified |
| Fold during form/media/call/camera/game | Store test preserves selection across column changes and resize; resources/focus/scroll untested. | Partial |
| Background/resume/activity replacement | No lifecycle execution evidence. | Unverified |
| Reduced motion/pointer/screen reader | No interaction or assistive-technology evidence. | Unverified |
| Regenerated native configuration | No prebuild/native-config validation in this audit. | Unverified |

Apple tablet navigation also currently returns a logical leading sidebar.
Implementation must fix these policy conflicts and replace the contradictory
test expectations together, using a verified capability source. An absent hinge
event or viewport width must not be used to invent a hardware family.

## Required UX review and acceptance

For each screen capture compact ordinary phone, narrow foldable cover (right rail), unfolded flat, book, tabletop, tablet narrow-window, wide tablet, RTL, large type, keyboard raised and web compact/wide. Measure host-relative hinge coordinates including nonzero origins; handle separating zero-width folds, occluding hinges, multi-hinge, stale features, safe areas and rail collision. Verify selection, drafts, scroll, active media/voice/camera/room sessions, navigation, focus and Inspector overlay do not remount or reset. Include reduced-motion, pointer, stylus, screen reader and tap-target checks.

Use `pnpm ui:sweep`, lint, typecheck, targeted adaptive tests, iOS/Android native builds, simulator screenshots, and physical foldable testing. Report each evidence tier separately; browser viewport simulation is not physical foldable validation.

## Suggested implementation PR sequence

A. **Research/design audit** (this PR): screen inventory, design roles, acceptance matrix, references.
B. **Adapter and contract tests**: inspect arrangement library and Expo compatibility, implement optional wrapper only if justified; unit test geometry and navigation policy.
C. **Student learning surfaces**: home, Tutor Room, whiteboard, OCR and live sessions.
D. **Parent and tutor surfaces**: dashboards, marketplace, scheduling, roster and detail.
E. **Business/teacher/admin surfaces**: calendar, CRM, campaigns, tables and Inspector.
F. **Native verification**: iPhone Duo and Android book/tabletop/cover, multi-window, physical device evidence and regression closure.

Do not merge or mark implementation complete until tests and screenshots exist. Preserve the existing product design and role-specific security boundaries.

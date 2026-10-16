# Moyo Learn — foldable UI/UX research and screen implementation plan

Status: research-backed engineering specification; no runtime changes or device validation claimed.

## Evidence and required skills

Read `AGENTS.md` and the pinned `mikevocalz-foldable-layouts` skill first. Also load FloWritesCode/fwc-swiftui-skills (`swiftui-iphone-duo`, reference.md), Expo skills, mattpocock/skills, Argent/agent-device, pbakaus/impeccable, petergyang/no-ai-slop, and the existing repository's UI/accessibility/testing instructions. Apply SwiftUI guidance to Apple-native adapters, not directly to React Native views. Research sources:
- https://developer.apple.com/design/human-interface-guidelines/designing-for-iphone-duo
- https://developer.apple.com/videos/play/tech-talks/111463/
- https://developer.android.com/develop/adaptive-apps/guides/foldables/learn-about-foldables
- https://developer.android.com/develop/adaptive-apps/guides/get-started-with-adaptive-apps
- https://android-developers.googleblog.com/2023/06/detecting-if-device-is-foldable-tablet.html
- https://thiagobrez.github.io/react-native-arrangement-view/index.html
- https://thiagobrez.github.io/react-native-arrangement-view/guide/installation

## Non-negotiable navigation contract

Native ordinary phone: existing bottom tabs. Native foldable even folded-cover, tablet and headset: physical RIGHT rail even in RTL and compact windows. Web: persistent header and compact bottom tabs, no side rail. Hardware identity and transient window width must not be conflated. Preserve Expo Router ownership, AdaptivePanes, SplitView.Inspector, Zustand, semantic UI and Kinetrell. Do not add a second navigation framework or a generic leading rail.

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

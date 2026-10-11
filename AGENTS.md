# Repository agent instructions

## Skills first

Load relevant skills before implementation, debugging, review, testing, documentation, or pull-request work. Preserve the shared skills baseline: `expo/skills`, `mattpocock/skills`, `Argent/agent-device`, `coreyhaines31/marketingskills`, `pbakaus/impeccable`, and `petergyang/no-ai-slop`. Apply specialist skills when relevant; do not replace the existing stack with the addition below.

## Required foldable and adaptive-layout skill

For work involving foldable screens, tablets, dual-screen devices, split views, adaptive navigation, inspectors, or window resizing, consult **FloWritesCode/fwc-swiftui-skills**, specifically **swiftui-iphone-duo**.

- Source: https://github.com/FloWritesCode/fwc-swiftui-skills
- Reviewed upstream revision: `3a6c74be7bf9cbc6b19c2025922f6b364542c000`.
- Read both the [skill](https://github.com/FloWritesCode/fwc-swiftui-skills/blob/3a6c74be7bf9cbc6b19c2025922f6b364542c000/skills/swiftui-iphone-duo/SKILL.md) and its [complete reference](https://github.com/FloWritesCode/fwc-swiftui-skills/blob/3a6c74be7bf9cbc6b19c2025922f6b364542c000/skills/swiftui-iphone-duo/reference.md) before changing relevant layouts.
- Use an existing local installation when present. Otherwise read the source through the available repository tools, or install it at project scope using `npx skills add FloWritesCode/fwc-swiftui-skills --skill swiftui-iphone-duo`. Inspect installer changes and record the actual installed revision; the command tracks upstream and is not pinned by this document.
- Load `swiftui-liquid-glass` only for relevant Apple-native system chrome. It is not a requirement to redesign every app with glass effects.

This is a required engineering reference, not proof that the upstream skill is locally installed or that hardware support is implemented.

## Cross-platform application

1. **Shared React Native/Expo:** retain the existing UI components, routing owner, SplitView/AdaptivePanes abstractions, and state store. Improve the shared layout and its adapters; do not create a parallel SwiftUI app, duplicate navigation tree, or replacement component system.
2. **Apple-native:** apply SwiftUI APIs only in the appropriate native layer. Verify each API against the installed SDK and deployment target; use compiler/runtime availability protection as required. Do not raise the deployment target merely to install a skill.
3. **Android:** preserve the Expo Modules 2 fold/posture bridge and Jetpack WindowManager/FoldingFeature approach where present. Respect actual hinge bounds, occlusion, separating folds, book/tabletop posture, and every reported display feature. Do not translate Apple-only APIs literally into Android or discard Android posture-aware layout behavior.
4. **Web:** retain responsive, container-based pane behavior and semantic components from the app's UI layer. Use platform capabilities only when actually available; do not invent hinge coordinates or infer foldable hardware from viewport width.
5. **XR:** preserve the existing spatial panel, Rive, and renderer contracts. Shared adaptive-layout principles do not establish native system-window or compositor support.

## Required layout and verification rules

- Design from current usable container space, not device names or dimensions captured once at launch. Cover intermediate widths as well as compact and expanded endpoints.
- Keep important controls, text, faces, scan targets, and media focal points clear of reported folds/occlusions and respect asymmetric safe areas and RTL.
- Use added space for meaningful companion panes, inspectors, and navigation rather than excessively wide text or stretched forms.
- Preserve navigation, selection, scroll position, draft input, media playback, camera sessions, and game/session state across layout changes. Avoid unnecessary remounts.
- Keep animation work within the project's Kinetrell policy. Do not introduce Tamagui, Bento, or an unrelated animation stack.
- Verify fold/unfold, book/tabletop, spanning where supported, rotation, window resizing, keyboard-visible layouts, RTL, large text, focus, and screen-reader behavior. Distinguish simulated geometry from physical-device validation.
- Document the skills read, affected platforms/files, checks actually run, and remaining hardware/SDK blockers in the PR. Never report unrun device tests as passed.

Do not rewrite existing application code, upgrade dependencies, merge, or deploy solely to add this skills requirement.

# Repository agent instructions

## Skills first

Load relevant skills before implementation, debugging, review, testing, documentation or PR work. Preserve the existing baseline: expo/skills, mattpocock/skills, Argent/agent-device, coreyhaines31/marketingskills, pbakaus/impeccable and petergyang/no-ai-slop.

## Required tailored foldable skill

Before work on foldables, dual screens, tablets, adaptive panes, resizing, Inspector or shared XR layouts, read **mikevocalz-foldable-layouts** in full:

https://github.com/mikevocalz/universal-spatial-starter/blob/256a97b132803fd2fb8049f7a120cef9cb641f41/.agents/skills/mikevocalz-foldable-layouts/SKILL.md

This is the tailored cross-platform skill, not the generic SwiftUI source. Canonical commit: `256a97b132803fd2fb8049f7a120cef9cb641f41`; Git blob SHA: `69a051ad0a924f778ed54f9222fe8af0c5eef701`. Fetch the pinned file through repository tools; an identical local copy may be read instead. This entry references the skill and does not claim it is locally installed. Record any intentional pin change. If the source cannot be read, report that gap rather than pretending to have loaded it.

Hardware family chooses native navigation: ordinary phones use bottom tabs; foldables (including folded covers and tabletop), tablets and headsets keep a physical RIGHT rail, also in RTL. Current usable space chooses content panes independently. Web uses its persistent header and phone-width bottom tabs, never a side rail. An absent hinge event does not identify an ordinary phone.

Preserve Expo Router ownership, existing SplitView/AdaptivePanes, Zustand/refs, semantic UI components and platform adapters. Preserve screen-specific pane/Inspector contracts; do not copy PaCasa's numeric presets into unrelated screens. The skill supplies hinge/occlusion geometry rules, session continuity, accessibility, SDK checks and 18 acceptance scenarios. SwiftUI examples apply only to Apple-native code; do not replace the cross-platform architecture or impose Liquid Glass.

Retain all existing product contracts and specialist skills. No runtime rewrite, dependency upgrade, merge or deployment solely for a skills-only task. Report checks actually run and separate browser/simulator evidence from physical-device validation.

## Repository-specific motion and composition

The installed product motion layer is `@legendapp/motion` behind `packages/ui/motion.tsx` and the existing adaptive-pane transitions. Marketing motion follows `docs/site/motion-matrix.md` and `apps/web-vite/src/motion/` (GSAP with Lenis). The tailored skill's Kinetrell guidance is not a claim that Kinetrell is installed here and does not authorize replacing these layers or adding a dependency. Preserve reduced-motion behavior and report any requested migration separately.

The skill's restriction on adding a Bento UI dependency does not prohibit the established ink-bento composition in `docs/pack/02-adaptive-screens-design-spec.md` or existing `SchoolBentoCard` components. Reuse the semantic components and product layouts already in this repository.

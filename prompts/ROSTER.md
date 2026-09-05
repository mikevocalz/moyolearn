# Review roster

Every deliverable in the design reset is reviewed by the seats listed here before it is written to disk. A seat is a standard to meet, not a person to hire: the work is judged as if the named tier authored the guidance it is being measured against.

Tier language is fixed. Seats are described at creator or spec-author tier. Do not label a seat "senior" or bare "principal" — those grades carry no standard.

Embed this file by reference in every prompt derived from the reset brief (`docs/design/moyo-design-reset-v2-brief.md`).

## Seats

| Seat | Tier standard | Owns | Blocks merge on |
|---|---|---|---|
| Design system & brand | Pentagram-partner-tier art director who has shipped a paper/collage illustration system for a children's brand; author tier of the NN/g neobrutalism guidance | `docs/design/art-direction.md`, `packages/art/registry.ts`, token conformance | A second control radius, a blurred shadow, a fourth typeface, art that does no pedagogical work |
| Children's UX research | NN/g "UX Design for Children" study author tier; Apple Design Awards 2026 Sago Mini interaction bar | Band-specific composition, K–2 reading load, task protocols | Reading required where it should not be, more than one primary action, engagement-pressure mechanics |
| Learning science | Khan Academy / Khanmigo research lead tier — help-seeking, before/after-attempt scaffolding, mastery vs position | Tutor Room scaffolding, evidence copy, movement-vs-position separation | Help that ignores attempt state; movement and position conflated |
| Platform HIG | Apple Human Interface Guidelines author tier; Material 3 Expressive research lead tier | Navigation behaviour, split view, platform affordances, gesture and focus order | Nav that breaks doc 36, restore behaviour that loses role/org/child/class |
| Accessibility | WCAG 2.2 Working Group author tier | `docs/design/reset/07-a11y.md`, contrast pairs, target sizes, reduced motion, screen-reader order | Any AA failure, including text over artwork; missing reduced-motion path |
| React Native / Expo | Expo Router author tier for routing and SplitView; React Native core (Meta) tier for Fabric and performance | Route structure, shell composition, measured FPS/TTI | Route changes without an ADR; a measured regression on Today or Tutor Room |
| Native rendering | William Candillon tier for react-native-webgpu and Skia; Marc Rousavy tier for Nitro/JSI at any native seam | `Manipulative`, `NatalieDock`, renderer fallbacks | A 3D path with no working 3D-off variant; a native seam without a cited installed symbol |
| TypeScript | TypeScript language architect tier | Registry types, public component props | `tsc --noEmit` failure, any `any`, a runtime fallback where a compile-time error belongs |
| Code review | Callstack react-native-best-practices author tier | PR review against the non-negotiables, bundle size, render cost | Unmeasured performance claims, `useState`/`useReducer` where Zustand is required |

## Standing review rules

1. A seat reviews before the file lands, not after. Work that skipped its seat is reverted, not patched.
2. A seat's objection is recorded in the PR with the rule it cites. "Looks off" is not a review.
3. Two seats disagreeing escalates to the precedence order in the reset prompt: `docs/pack/*` → `docs/38-front-door-and-flow.md` → `docs/design/overhaul-v2/00-binding-decisions.md` → `docs/design/moyo-design-reset-v2-brief.md` → `design/screens/**/contract.md`. If the disagreement is not resolved by that order, it becomes an ADR.
4. Design-system and accessibility seats review every visual deliverable. The other seats review what they own.
5. Evidence rules apply to reviewers too: cite the installed file and symbol, the measured number, or the WCAG criterion. No seat approves on assertion.

## Non-negotiables every seat enforces

- No placeholders, no stubs, no hallucinated APIs or packages. Every seam cites an installed file and symbol.
- Zustand for state. `useState` and `useReducer` are banned; React 19 `useOptimistic` and `useActionState` are allowed.
- Comments state intent. A comment that narrates history ("this used to be…", "fixes the bug where…") is a review failure.
- No engagement-pressure mechanics, no answer mode, learner surfaces never show prices.
- Imagery: real photography from Pexels for adult and onboarding surfaces with the licence recorded in the registry; generated art only where a real photograph cannot exist and only after the art-direction plates are approved; never emoji as art; never photoreal child faces on learner surfaces.
- US compliance framing only — COPPA, FERPA, state student privacy.

# Design reset — repo baseline

Verified 2026-09-05 against `design/reset-v2` at `cdcf4cf`. Every verdict below comes from a command run in this working tree. No build was run, no authenticated session exercised.

This document corrects `docs/design/moyo-design-reset-v2-brief.md` where the brief's counts are wrong. The brief's direction stands; four of its factual premises do not.

## Verdict table

| # | Claim from the brief | Verdict | Evidence |
|---|---|---|---|
| 1 | 5 image files in `apps/mobile/assets/images` | CONFIRMED | `adaptive-icon.png`, `favicon.png`, `icon.png`, `splash-blank.png`, `splash-icon.png` |
| 1b | "Zero product artwork in the repo" | **REFUTED** | `packages/avatar/assets/natalie-phone/` holds a rigged, textured Natalie: `natalie.gltf` + 8 PBR maps; `packages/avatar/assets/` holds `humano-marketing.glb` and `humano-marketing-source.glb` |
| 2 | 24 photos in `apps/web-vite/public/images` | **REFUTED** | 36 files in `apps/web-vite/public/images`, plus 7 in `apps/web-vite/data/photography` |
| 3 | No `Scene`, `SubjectArt`, `Manipulative`, `Figure`, `Paper`, `EvidenceStrip`, `MissionPath`, `StatusHero`, `OutcomeDots`, `NatalieDock`, `Reveal` in `packages/ui` | CONFIRMED for all 11 names | `find packages/ui -name '<Name>.tsx'` returns 0 for each |
| 3b | "A Card restyle will not fix it — the kit has no surface for art" | **PARTIAL** | Four of the eleven proposed primitives have a working neighbour already in the kit — see §2 |
| 4 | `packages/theme/tokens.ts` is 939 lines | **REFUTED** | 1346 lines |
| 5 | `packages/ui` is "180+ files" | PARTIAL (undercount) | 317 `.ts`/`.tsx` files |
| 6 | `packages/ui/Image.tsx` is a 27-line SolitoImage wrapper | CONFIRMED | 27 lines |
| 7 | Comments narrate history rather than intent | CONFIRMED | `TutorPresence.tsx` opens "WHY THIS EXISTS: … Natalie left the screen and never came back"; `ReadFailure.tsx` opens with the six-surface drift story; `Banner.tsx` explains the gap it fills before saying what it is |
| 8 | Binding docs exist | CONFIRMED | `docs/pack/` 00–37 complete; `docs/38-front-door-and-flow.md`; `docs/design/overhaul-v2/00-binding-decisions.md`; 64 `design/screens/**/contract.md`; ADRs `adr-101` … `adr-114` in `docs/decisions/` |
| 9 | `prompts/ROSTER.md` does not exist | WAS TRUE | Authored in this change |
| 10 | `docs/design/art-direction.md` does not exist | CONFIRMED | Absent; it is deliverable 2 |

Docs the brief cites as "doc 31/32/33/34/36/37" are pack docs, not root docs: `docs/pack/31-grade-voice-safety-incidents.md`, `32-tutor-voice-tone.md`, `33-moyo-learn-prd.md`, `34-session-summary-reports.md`, `36-role-navigation-flows.md`, `37-onboarding-dual-pane.md`. Derived documents should cite the full path so the reference resolves.

## §2 The kit already covers four of the eleven proposed primitives

The brief's §6 reads as eleven greenfield components. Four of them have an existing implementation that a new component would duplicate. Building alongside these would put two systems on one concern, which the reset is supposed to remove.

| Proposed primitive | Existing neighbour | Lines | Call |
|---|---|---|---|
| `NatalieDock` | `packages/ui/TutorPresence.tsx` | 364 | **Extend.** It already owns the "Natalie is the other participant, rendered once, outside the state switch" rule and carries its own Mobbin references. Add placement rules for Today and completion; do not author a second presence component. |
| `Manipulative` | `packages/ui/LearningCanvas.tsx` | 21 | **Build inside.** `LearningCanvas` is a bordered box with no drawing surface. It is the correct mount point for Skia/WebGPU manipulatives; the new work is the renderer, not another container. |
| `OutcomeDots` | `packages/ui/MasteryBar.tsx` | 109 | **Extend.** `MasteryBar` already encodes the movement rule and the highlighter-not-redpen outcome tone. Per-objective dots are a variant of that vocabulary, not a rival one. |
| `StatusHero` | `packages/ui/Banner.tsx` + `StatCard.tsx` | 113 + 68 | **Decide before building.** `Banner` owns in-flow non-blocking status with the tone set `info \| warning \| incident \| offline`. A status hero that duplicates those tones creates a second tone system. Either `StatusHero` composes `Banner`, or it needs an ADR saying why it does not. |

Genuinely new, no neighbour in the kit: `Paper`, `Scene`, `SubjectArt`, `EvidenceStrip`, `MissionPath`, `Reveal`.

Also already present and load-bearing for the reset, so not to be re-authored: `TutorStage.tsx` (916 lines, the S9 session surface, already thread-first per `docs/pack/23-tutorstage-handoff.md`), `EmptyState.tsx` / `ReadFailure.tsx` (the honest-empty vs read-failed split the reset's six-state matrix requires), `Dial.tsx` (Hot/Cool), `adaptive-panes/`, `TrendLine`, `VirtualList`.

## §3 Enforcement already in place

`tooling/` holds 17 gate scripts. The ones the reset must extend rather than replace:

- `check-role-accent.mjs` — the one-accent-moment law.
- `check-contrast.mjs` — contrast pairs. The reset adds text-over-artwork pairs.
- `check-controls.mjs`, `check-targets.mjs` — radius and band touch targets.
- `check-copy-law.mjs` — voice gate.
- `check-references.mjs` + `references-baseline.json` — reference tracking; the Mobbin docs written for this reset should register here.
- `ui-sweep.mjs` — the sweep the reset extends to fail on any image outside `packages/art/registry.ts`.
- `check-store-separation.mjs`, `check-no-flatlist.mjs`, `check-barrels.mjs`, `check-fail-closed.mjs`, `check-runtime-classes.mjs`, `check-utilities.mjs`, `check-voice-egress.mjs`, `check-crm-wall.mjs`, `check-no-training-path.mjs`, `check-sentry-invariants.mjs`, `check-versions-off.mjs`.

## §4 What this changes about the plan

1. Natalie is not an unstarted asset problem. A textured GLTF and a 364-line presence component exist. The open work is placement across Today and completion, and the 3D-off path — not modelling.
2. The primitive count drops from eleven to six new plus four extensions. Rewrite brief §6 accordingly before any component work starts.
3. `apps/web-vite` carries 43 real photographs across `public/images` and `data/photography`. The adult-photography lane starts from an existing licensed set, not from zero; the registry's first job is to record what those 43 files are and whether their licences are documented.
4. Token and gate infrastructure needs extension, not authorship. Budget accordingly.

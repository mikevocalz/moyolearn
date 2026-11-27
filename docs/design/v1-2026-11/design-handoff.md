# Design handoff: v1 screens

Date: 2026-11-25. Spec sheet per screen. Every element names the `packages/ui` export or token it uses, read from `origin/codex/homework-prior-work-ui-20261114` (phone) and `origin/codex/hands-integration-20261114` (headset). Anything not in those trees is marked `[add]` and pointed at doc 38 §8 or `design-system-diff.md`. Copy keys live in `ux-copy.md`.

## Shared token map

| Role | Real token | Source |
| --- | --- | --- |
| Learner target floor per band | `targets.young` 72px · `targets.child` 56px · `targets.teen` 48px · `targets.adult` 44px | `packages/theme/tokens.ts:targets` |
| Band class set (target, title, lead, gap, inset) | `BAND_SCALE[band]` | `packages/app/features/capture/age-band.ts:BAND_SCALE` |
| Row and group rhythm | `element` · `stack` · `group` · `section` | `packages/theme/tokens.ts` spacing tiers |
| Field padding | `inset-field` · `inset` · `inset-roomy` | same |
| Control radius | `radius.control` (6px) | `packages/theme/tokens.ts:radius` |
| Hot / cool dial | `hot.row-height` 4rem · `cool.row-height` 2.75rem | `packages/theme/tokens.ts` |
| Role accent (guardian) | `role-guardian` #95EBFF, `role-guardian-underlay` | `packages/theme/tokens.ts` semantic block |
| Spatial spacing | `spatialSpacing.xs` 0.025 … `xl` 0.35 | `packages/ui/xr/spatial-tokens.ts:spatialSpacing` |
| Board distance | `spatialDistance.board` 1.5 · `nearInteraction` 0.45–0.8 | `spatial-tokens.ts:spatialDistance` |
| Spatial hit floor | `minHitSize(distanceM, hands, band)` | `spatial-tokens.ts:minHitSize` |
| Spatial type | `spatialType.caption/body/title`, `spatialFontSize`, `spatialLabelScale` 0.25 | `spatial-tokens.ts` |
| Tray grid | `boardTrayGrid` 2×4, `boardTrayHeight()` | `spatial-tokens.ts:boardTrayGrid` |

Tokens missing (propose, do not hardcode): a seated near-board distance; a band-indexed hand target table that callers can read without recomputing; a done-mark component in `packages/ui`. All three are in `design-system-diff.md`.

## FD-01 Welcome

| Element | Component / token | Notes |
| --- | --- | --- |
| Shell | `TwoPaneShell`, `BrandPaneContent(variant="welcome")` (doc 38 §8 says exists, doc 37) | Photo on web, clip on mobile per FD-01 |
| Wordmark, tagline | `Wordmark` · `Text variant="display-sm"` (`packages/ui/Text.tsx` ramp variants) | H1 = tagline |
| Three doors | `Button variant="primary"` · `"secondary"` · `"outline"` (`packages/ui/Button.tsx`, `size` carries `min-h-target-*`) | "I have a code" gets `accessibilityHint` per FD-01 |
| Footer | `LegalFooter` [add] per doc 38 | |

States: loading = skeleton ≤400 ms; offline = doors still work; error n/a. Responsive: dual ≥840, single below, learner door reachable at every width.

## FD-04 Create account

| Element | Component / token |
| --- | --- |
| Name, email | `TextField` (label required by lint, doc 38 §7) |
| Password | `PasswordField` + `PasswordRules` [add] (doc 38 §8) |
| Adult attestation | `Checkbox` (`packages/ui/Checkbox.tsx` native, `Checkbox.web.tsx` web); `label` is the tap target |
| Primary | `Button variant="primary" size` ≥ `targets.adult` |
| Error summary | `FormErrorSummary` with polite live region |

Edge cases: 30-char name, +30% strings, keyboard over the primary (keyboard-avoiding scroll), offline mid-submit keeps the form filled, fold mid-form survives (Zustand store).

## FD-10 Parental consent

| Element | Component / token |
| --- | --- |
| H1, body | `Text variant="title"` · `"body"` |
| Three "what we collect" rows | list semantics, `gap-element` |
| Method chooser | `ConsentCheckpoint` [add] (doc 38 §8) |
| Attestation | `Checkbox` with the exact FD-10 label |
| Primary / secondary | `Button primary` · `outline`; secondary only if doc 06 allows consent-pending |

## FD-12 Add child

| Element | Component / token |
| --- | --- |
| First name | `TextField` |
| Grade | segmented `radiogroup`, 13 options, each ≥ `targets.adult` (guardian surface) |
| Live band line | `Text variant="caption"` reading `BAND_SCALE` name for the grade |
| Avatar grid | 8 visible + More, each announces by name |
| Primary | `Button` `Add {name}` |

## FD-13 Choose plan / PW-01

| Element | Component / token |
| --- | --- |
| Reassurance card above price | `Text variant="body"` in a `rounded-card border-2 border-border` panel (same classes `guardian-prior-work-review.tsx` uses) |
| Plan | `PlanCard` [add] with the `tier[]` type guard (doc 38 §8) |
| Primary / Maybe later | `Button primary` · `Button outline` with full contrast |
| Auto-renew sentence | real `Text`, adjacent to the primary |

Rule check: this screen is guardian-only (`(onboarding)/guardian/plan`). No learner route renders `PlanCard`.

## Upload (capture → processing)

| Element | Component / token |
| --- | --- |
| Capture | `packages/app/features/capture/capture-screen.tsx:startWithNatalie` seam (prior-work handoff) |
| Per-page status row | `View className="gap-element"` + `Text variant="label"` + `Text variant="caption" tone="muted"` |
| Retry a failed page | `Button variant="outline"` per row; never drop page identity |

## Review with done marks (guardian)

| Element | Component / token | Notes |
| --- | --- | --- |
| Open / close | `Button variant="outline"` titled "Review already-done marks" / "Close question review" (`guardian-prior-work-review.tsx:GuardianPriorWorkReview`) | |
| Count line | `Text variant="body" aria-live="polite"` | announced once per change |
| Explainer | `Text variant="caption" tone="muted"`: "These marks skip work finished before upload. They do not check answers." | already in code |
| Problem card | `View className="gap-element rounded-card border-2 border-border p-3"` | `p-3` is a raw Tailwind step, not `inset-*`; flag for the design-system audit |
| Done mark | `PriorWorkMark` (`prior-work-mark.tsx`) → `Checkbox label="Problem {n}, page {p}: Already done before upload"` | Read-only variant renders `Text variant="caption" tone="muted"` "✓ Already done before upload" |
| Mark height | `className="min-h-14 py-2"` on the Checkbox | **Finding:** `min-h-14` is 3.5rem; `tokens.ts:targets` documents that mobile resolves rem at 14, so this lands at 49dp on device, not the 56 the author meant. Use `min-h-target-child` or the band class from `BAND_SCALE`; see `design-system-diff.md` |

States: loading "Loading questions…", error + Retry, save pending "Saving change…", save failed + Reload, locked after tutoring starts ("Already-done marks can only be changed before tutoring starts."). All exist in `guardian-prior-work-review.tsx`.

## Learner problem (phone)

| Element | Component / token |
| --- | --- |
| Problem text pinned | `Text` at `BAND_SCALE[band].rowTitle` |
| Band targets | `BAND_SCALE[band].target` on every pressable; never `min-h-11` |
| Done-mark behaviour | A problem with `priorWork === 'complete'` is skipped by the server cursor (`apps/web/lib/homework.repository.ts:advanceSubmission`, per the prior-work handoff); the UI shows no mark, no score and no answer for it |
| No paywall | Nothing from §5B renders here (CLAUDE.md "Children's surfaces") |

## Session summary (learner)

| Element | Component / token |
| --- | --- |
| Worked list | one row per problem the child opened, text visible, `BAND_SCALE[band].gap` |
| Skipped-as-done | shown as "Done before" with the same caption style as the read-only mark; no counts of right/wrong |
| Primary | `Button` `Back to Today` at the band target |

## Hand coach (headset)

| Element | Component / token |
| --- | --- |
| Card | plate stack using `spatialLayer.surface` / `.content` |
| Step text | `spatialType.body`, laid out at `spatialLabelFontSize.body` and scaled by `spatialLabelScale` |
| Skip / Next keys | `minHitSize(distance, true, band)` each; one `spatialSpacing.sm` apart |
| Steps | three max, one gesture each (`ux-copy.md`); step 2 gated on direct-touch qualification per the hands handoff |
| Persistence | learner-scoped completion version through the existing persistence boundary, Zustand state |

## Tool tray (headset)

| Element | Component / token |
| --- | --- |
| Grid | `boardTrayGrid` 2 rows × 4, height `boardTrayHeight(distance, hands, band)` |
| Key size | `minHitSize(distance, true, band)` |
| Selected tool | selected outline plus name label, retained on tracking loss |
| Colour swatches | colour name beside each swatch |
| Clear | separated by `spatialSpacing.xs`, confirmation "Clear this page?" |

## Pinch and touch thresholds

Every value in this section is **UNQUALIFIED** until device traces exist for all four bands (see `user-research-plan.md`). They are copied from `docs/design/hands-input-handoff.md` so the implementer has one place to read them; none is an approved default.

| Parameter | Candidate | Status |
| --- | --- | --- |
| Far pinch strength | down ≥ 0.75, up ≤ 0.55 (current single cutoff 0.7) | UNQUALIFIED |
| Direct-touch plane | down on crossing ≤ 0 m inside paper bounds; up at ≥ 0.012 m retreat | UNQUALIFIED |
| Safety depth | 0.02 m behind paper (0.025 m is the alternate under test) | UNQUALIFIED |
| Near/far zone | enter ≤ 0.05 m, leave ≥ 0.08 m | UNQUALIFIED |
| Poke action | press/release edges once per crossing, no repeat while held | UNQUALIFIED |
| Hand hit floor at 1.5 m | young 0.214 · child 0.167 · teen 0.143 · adult 0.131 m, from `minHitSize(1.5, true, band)` | derived, not measured |
| Hand hit floor at 0.6 m | young 0.086 · child 0.067 · teen 0.057 · adult 0.052 m, from `minHitSize(0.6, true, band)` | derived, not measured; 0.6 itself is unqualified |

Rule carried from the hands handoff: compute with `minHitSize` in code, never paste these rounded numbers.

## Open questions

1. Does doc 06 allow a consent-pending state (decides FD-10's secondary button)?
2. Which seated distance wins the 1.5 m / 0.6 m conflict (device decision; proposal in `design-system-diff.md`)?
3. Is direct touch shipped for v1, or ray-only (decides hand coach step 2 copy)?

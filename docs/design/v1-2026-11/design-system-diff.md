# Design-system diff: proposals for packages/ui and spatial-tokens

Date: 2026-11-25. Nothing here is applied. Each block is a diff the owning agent can paste once the decision beside it is made. Base: `origin/codex/hands-integration-20261114` for `packages/ui/xr/spatial-tokens.ts`, `origin/codex/homework-prior-work-ui-20261114` for `packages/ui` and the homework feature.

## 1. Done-before-upload mark as a `packages/ui` component

Problem: `packages/app/features/homework/prior-work-mark.tsx:PriorWorkMark` wraps `Checkbox` with a fixed label and a read-only caption. It is the only place that knows the mark's wording and height, and the height is a raw Tailwind step (`min-h-14`) that resolves at 49dp on mobile because the bundler polyfills rem at 14 (`packages/theme/tokens.ts:targets` comment). Doc 38 §7 wants learner-adjacent controls ≥ 56dp and the band tokens already exist as `min-h-target-*` classes (`age-band.ts:BAND_SCALE`).

Existing patterns: `Checkbox` (interactive, no band prop) and `Text variant="caption" tone="muted"` (read-only). Neither carries the "done, not graded" semantics, so a thin wrapper belongs in `packages/ui` where the homework feature and the session summary can both use it.

```ts
// packages/ui/DoneMark.tsx  [add]
'use client';
// A mark that says "finished before upload" and nothing else. It never says
// correct, right, or graded; the label is fixed here so a feature cannot
// re-word it into a score.
// SOT: docs/design/homework-prior-work-handoff.md
// SOT-KEYWORDS: done mark prior work already done before upload checkbox band
import { Checkbox } from './Checkbox';
import { Text } from './Text';

export type DoneMarkBand = 'young' | 'child' | 'teen' | 'adult';

const bandMinHeight: Record<DoneMarkBand, string> = {
  young: 'min-h-target-young',
  child: 'min-h-target-child',
  teen: 'min-h-target-teen',
  adult: 'min-h-target-adult',
};

export interface DoneMarkProps {
  done: boolean;
  /** Who is looking: guardian surfaces pass 'adult'; learner surfaces pass the learner's band. */
  band: DoneMarkBand;
  /** Visible, screen-reader-read description of the item, e.g. "Problem 3, page 2". */
  itemLabel: string;
  /** Omit for the read-only form. */
  onChange?: (done: boolean) => void;
  disabled?: boolean;
}

export function DoneMark({ done, band, itemLabel, onChange, disabled }: DoneMarkProps) {
  if (!onChange) {
    return done ? <Text variant="caption" tone="muted">Already done before upload</Text> : null;
  }
  return (
    <Checkbox
      label={`${itemLabel}: Already done before upload`}
      checked={done}
      disabled={disabled}
      className={`${bandMinHeight[band]} py-2`}
      onChange={onChange}
    />
  );
}
```

Follow-up diff in the feature (not applied):

```diff
--- a/packages/app/features/homework/prior-work-mark.tsx
+++ b/packages/app/features/homework/prior-work-mark.tsx
-import { Checkbox, Text } from '@acme/ui';
+import { DoneMark } from '@acme/ui';
 ...
-  return <Checkbox
-    label={`Problem ${questionNumber}, page ${sourcePage}: Already done before upload`}
-    checked={complete}
-    className="min-h-14 py-2"
-    disabled={disabled}
-    onChange={(checked) => onChange(checked ? 'complete' : 'none')}
-  />;
+  return <DoneMark
+    done={complete}
+    band="adult"
+    itemLabel={`Problem ${questionNumber}, page ${sourcePage}`}
+    disabled={disabled}
+    onChange={(checked) => onChange(checked ? 'complete' : 'none')}
+  />;
```

Stories required before a screen uses it: read-only done, read-only not done (renders nothing), interactive unchecked, checked, disabled, each at `young` and `adult`.

## 2. Hand targets by band, readable without recomputing

Problem: `spatial-tokens.ts:minHitSize(distanceM, hands, band)` is the only correct source, and the hands handoff forbids a second size table. Callers still want a band-indexed record for a given distance (the tray, the coach keys, tests). A function that returns the record keeps one trigonometry and gives the implementer the shape they keep asking for.

```diff
--- a/packages/ui/xr/spatial-tokens.ts
+++ b/packages/ui/xr/spatial-tokens.ts
@@ export function minHitSize(distanceM: number, hands: boolean, band: SpatialBand): number {
   return size * reach * spatialTarget.bandMultiplier[band];
 }
+
+/** Every band's floor at one distance, from `minHitSize` and nothing else. */
+export function handTargetsAt(distanceM: number): Record<SpatialBand, number> {
+  return {
+    young: minHitSize(distanceM, true, 'young'),
+    child: minHitSize(distanceM, true, 'child'),
+    teen: minHitSize(distanceM, true, 'teen'),
+    adult: minHitSize(distanceM, true, 'adult'),
+  };
+}
```

No static `spatialHandTarget` constant is proposed; a constant would be correct at one distance only, which is the problem `spatialDistance.board` already documents.

## 3. Seated near-board distance (proposal, decide on device)

Problem: `spatialDistance.board` is 1.5 m and every static board token is sized there. The build prompt asks for every target within 0.6096 m. `spatialDistance.nearInteraction` is 0.45–0.8 m and the hands handoff says those values "do not establish a seated near layout." A token that names the candidate, its bounds, and the fact that it is unqualified lets `layoutBoard` report fit at the candidate without anyone editing `board` or rescaling the scene.

```diff
--- a/packages/ui/xr/spatial-tokens.ts
+++ b/packages/ui/xr/spatial-tokens.ts
@@ export const spatialDistance = {
   nearInteraction: { min: 0.45, max: 0.8 },
   comfortableUI: { min: 1.25, max: 2.0 },
   board: 1.5,
+  /**
+   * A seated child's board, for direct touch. UNQUALIFIED: `candidate` is the
+   * build prompt's two feet; `min` is `nearInteraction.min` because a board
+   * closer than that sits inside the hand volume; `max` is the far edge of
+   * near interaction. The number that ships is the one the seated-reach study
+   * (`user-research-plan.md`) measures for the `young` band, never this
+   * candidate copied forward. `board` above stays the ray-mode distance.
+   */
+  seatedBoard: { min: 0.45, candidate: 0.6, max: 0.8, qualified: false as const },
 } as const;
```

What this does not do: it does not change `boardComposition`, `DESIGN_KEY_BOX`, or the window contract, all of which the hands handoff says must stay. At the candidate, `handTargetsAt(0.6)` gives young 0.086 m, which is 2.8× the `young` tray key budget change; `boardTrayHeight(0.6, true, 'young')` must be checked against the paper height before anyone claims the tray fits. Keep a ray option when the surface is beyond comfortable reach.

## 4. Audit findings to clear alongside

| File | Finding | Fix |
| --- | --- | --- |
| `prior-work-mark.tsx` | `min-h-14` raw step (49dp on device) | Section 1 |
| `guardian-prior-work-review.tsx` | `p-3` raw step on the problem card | `p-inset-tight` or `p-inset` from the spacing tiers |
| `Checkbox.web.tsx` | box is `h-5 w-5` (20px); the Pressable root has no min-height, so target size depends on the label line | Acceptable while the label is the tap target; `DoneMark` sets the min-height on the root through `className` |
| `Checkbox.tsx` (native) | no `band` or min-height prop; `className` only | Same; no fork, the wrapper carries the band |

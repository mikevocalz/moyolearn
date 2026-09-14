'use client';
// The two small ornaments above and below the paper.
//
// The question line is what the 2D work pane puts above the board and nothing
// else — `TutorWorkCanvas … problemOnly`. The placement row is the spatial
// equivalent of nothing in 2D: move, recenter, fit and exit exist only because
// a board in a room can be in the wrong place, and they sit BELOW the paper so
// that a ray reaching for them never crosses the writing surface.
//
// Both are stacked quads now rather than flex views, and the placement row is
// the clearest case for why: it was a `ViroFlexView` with `materials={[]}` — an
// invisible slab whose only job was to space two keys, and a slab a ray can
// still land on. A row that is a bare `ViroNode` with its keys placed in metres
// has nothing between them to hit. See `XrPlate.native.tsx`.
// SOT: packages/app/features/tutor/tutor-work-canvas.tsx · packages/ui/xr/spatial-tokens.ts
// SOT-KEYWORDS: xr ornament question line placement controls recenter exit fit viro spatial

import { ViroNode } from '@reactvision/react-viro';
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { XR_COLOR } from './xr-colors.ts';
import { XrKey, XrLabel, XrPlate } from './XrPlate.native.tsx';
import { runOffsets } from './run-layout.ts';
import {
  boardComposition,
  minHitSize,
  spatialSpacing,
  spatialTextHeight,
} from './spatial-tokens.ts';
/* Props live outside this file so the web fork can name them without naming
   Viro — the `XrPanel.types.ts` arrangement, for the same reason. */
import type { XrPlacementControlsProps, XrQuestionLineProps } from './XrOrnaments.types.ts';

/**
 * The question, above the paper, at content height.
 *
 * It changes when the problem does and at no other time, so a child working
 * through a page sees the line above their paper follow them rather than
 * flicker on every turn.
 */
export function XrQuestionLine({ text, width }: XrQuestionLineProps) {
  if (text.length === 0) return null;
  return (
    <XrPlate
      width={width}
      /* The token, not a second copy of it. The literal here and the
         `topOrnamentHeight` token were two writings of one number, and the
         caller places this node at the TOKEN's extent — so the day they
         disagreed, the bar would have been drawn outside the space reserved
         for it. The token is also what the type step is sized against now. */
      height={boardComposition.topOrnamentHeight}
      material={XR_MATERIAL.card}
    >
      <XrLabel
        text={text}
        width={width - spatialSpacing.xs * 2}
        /* Exactly the two lines the token reserves room for, so the box the
           glyphs are clipped to and the box the caller allocated are one
           number. */
        height={spatialTextHeight.body * 2}
        step="body"
        color={XR_COLOR.onPanel}
        maxLines={2}
      />
    </XrPlate>
  );
}

/**
 * Recenter and Exit, below the paper.
 *
 * Recenter is explicit and always reachable, because the app never moves the
 * camera for a child — the comfort rule that matters most in a headset is that
 * the only thing which moves the view is the person wearing it.
 *
 * Move is not a key: it is the panel's frame, which is a physical affordance
 * rather than a mode. Fit is not here either — the board's page-to-paper
 * mapping is fixed and uniform, so there is nothing to fit to.
 */
export function XrPlacementControls({
  width,
  distanceM,
  handsPrimary,
  band,
  onRecenter,
  onExit,
}: XrPlacementControlsProps) {
  const size = minHitSize(distanceM, handsPrimary, band);
  /*
    Wider than the floor because each key carries a word; never SHORTER than
    it. The height was `size × 0.6`, which cleared 4° across and missed it by
    40% down the other axis — a target is the smaller of its two edges, so one
    of them being generous does not buy the other one anything.
  */
  const keyWidth = size * 1.6;
  const keys = [
    { id: 'recenter', label: 'Recenter', onPress: onRecenter },
    { id: 'exit', label: 'Leave', onPress: onExit },
  ];
  const x = runOffsets(
    keys.map(() => keyWidth),
    width,
    spatialSpacing.xs,
    'center',
  );

  return (
    <ViroNode>
      {keys.map((entry, index) => (
        <XrKey
          key={entry.id}
          label={entry.label}
          width={keyWidth}
          height={size}
          selected={false}
          disabled={false}
          onPress={entry.onPress}
          position={[-width / 2 + (x[index] ?? 0), 0, 0]}
        />
      ))}
    </ViroNode>
  );
}

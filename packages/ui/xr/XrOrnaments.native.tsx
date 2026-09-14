'use client';
// The two small ornaments above and below the paper.
//
// The question line is what the 2D work pane puts above the board and nothing
// else — `TutorWorkCanvas … problemOnly`. The placement row is the spatial
// equivalent of nothing in 2D: move, recenter, fit and exit exist only because
// a board in a room can be in the wrong place, and they sit BELOW the paper so
// that a ray reaching for them never crosses the writing surface.
// SOT: packages/app/features/tutor/tutor-work-canvas.tsx · packages/ui/xr/spatial-tokens.ts
// SOT-KEYWORDS: xr ornament question line placement controls recenter exit fit viro spatial

import { useState } from 'react';
import { ViroClickStateTypes, ViroFlexView, ViroText } from '@reactvision/react-viro';
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { XR_COLOR } from './xr-colors.ts';
import { boardComposition, minHitSize, spatialFontSize, spatialSpacing } from './spatial-tokens.ts';
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
    <ViroFlexView
      width={width}
      /* The token, not a second copy of it. The literal here and the
         `topOrnamentHeight` token were two writings of one number, and the
         caller places this node at the TOKEN's extent — so the day they
         disagreed, the bar would have been drawn outside the space reserved
         for it. The token is also what the type step is sized against now. */
      height={boardComposition.topOrnamentHeight}
      materials={[XR_MATERIAL.card]}
      style={{ padding: spatialSpacing.xs, flexDirection: 'column', justifyContent: 'center' }}
    >
      <ViroText
        text={text}
        style={{ fontSize: spatialFontSize.body, color: XR_COLOR.onPanel }}
        textLineBreakMode="WordWrap"
        maxLines={2}
      />
    </ViroFlexView>
  );
}

function ControlKey({
  label,
  size,
  onPress,
}: {
  label: string;
  size: number;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <ViroFlexView
      /*
        Wider than the floor because it carries a word; never SHORTER than it.
        The height was `size × 0.6`, which cleared 4° across and missed it by
        40% down the other axis — a target is the smaller of its two edges, so
        one of them being generous does not buy the other one anything.
      */
      width={size * 1.6}
      height={size}
      materials={[pressed ? XR_MATERIAL.keyPressed : XR_MATERIAL.key]}
      style={{
        padding: 0.008,
        flexDirection: 'column',
        justifyContent: 'center',
        borderWidth: hovered ? 0.004 : 0,
        borderColor: XR_COLOR.focus,
      }}
      onHover={(isHovering) => setHovered(isHovering)}
      onClickState={(clickState) => {
        if (clickState === ViroClickStateTypes.CLICK_DOWN) setPressed(true);
        else if (clickState === ViroClickStateTypes.CLICK_UP) {
          setPressed(false);
          onPress();
        }
      }}
    >
      <ViroText
        text={label}
        style={{ fontSize: spatialFontSize.body, color: XR_COLOR.onKey, textAlign: 'center' }}
      />
    </ViroFlexView>
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
  return (
    <ViroFlexView
      width={width}
      /* The token, for the same reason `XrQuestionLine` uses its own: the
         caller reserves `bottomOrnamentHeight` for this node, so a literal
         here is a second number free to disagree with the reservation. */
      height={boardComposition.bottomOrnamentHeight}
      materials={[]}
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spatialSpacing.xs,
      }}
    >
      <ControlKey label="Recenter" size={size} onPress={onRecenter} />
      <ControlKey label="Leave" size={size} onPress={onExit} />
    </ViroFlexView>
  );
}

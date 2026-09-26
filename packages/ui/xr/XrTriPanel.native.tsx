'use client';
// Three world-locked panels: tools, portrait paper, and the current conversation.
// A successful native binding selects the live board material. Otherwise the
// last export remains a recovery preview; the screen disables handwriting.
// Panel dragging is disabled so artwork and the sibling input plane cannot drift.
// SOT: world-slot.ts · premium/PremiumXRMediaPanel.tsx
// SOT-KEYWORDS: xr panels live board tools portrait workspace

import { XR_MATERIAL } from './spatial-materials.native.ts';
import { PremiumXRMediaPanel } from './premium/index.ts';
/* The same call `XrBoardSurface` places the pointer quad by — one arithmetic,
   so the board a child sees and the plane their ray hits cannot drift apart. */
import { worldSlot } from './world-slot.ts';
import type { XrTriPanelProps } from './XrTriPanel.types.ts';

export function XrTriPanel({
  headPosition,
  headYawDeg,
  boardUri,
  boardLive,
  controlSize,
  boardTitle,
  chatRows,
  controlRows,
  tutorName,
  placeholderUri,
}: XrTriPanelProps) {
  const left = worldSlot('left', headPosition, headYawDeg);
  const centre = worldSlot('center', headPosition, headYawDeg);
  const right = worldSlot('right', headPosition, headYawDeg);

  return (
    <>
      <PremiumXRMediaPanel
        title="Tools"
        controlSize={controlSize}
        imageSource={{ uri: placeholderUri }}
        rows={[...controlRows]}
        size="toolsCard"
        /* No art column: these panels are a list, and a media strip would take
           the width the rows read in. */
        mediaFraction={0}
        worldPlacement={left}
        draggable={false}
        animate={false}
      />
      {/*
        THE BOARD, IN A PANEL. `mediaFraction={1}` gives the child's paper the
        whole body — the poke-xr clamp opened at both ends for exactly this —
        and the media source is the engine's own raster, so the panel shows the
        real board rather than a second rendering of it. Wider than the flanks
        because it is the thing being worked on.
      */}
      <PremiumXRMediaPanel
        title={boardTitle}
        mediaMaterial={boardLive ? XR_MATERIAL.boardLive : undefined}
        imageSource={{ uri: boardUri ?? placeholderUri }}
        rows={[]}
        size="boardPanel"
        mediaFraction={1}
        worldPlacement={centre}
        draggable={false}
        animate={false}
      />
      <PremiumXRMediaPanel
        title={tutorName}
        imageSource={{ uri: placeholderUri }}
        rows={[...chatRows]}
        size="portraitCard"
        mediaFraction={0}
        worldPlacement={right}
        draggable={false}
        animate={false}
        /* The conversation is the surface that genuinely needs the rail — it is
           the only one that outgrows its panel. */
        alwaysShowRail
      />
    </>
  );
}

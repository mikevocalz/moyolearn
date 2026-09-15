'use client';
// The two flanking panels, on the arc, at the child's eye level — tools to the
// left, the conversation to the right.
//
// WHY THE CENTRE IS NOT HERE, AND THAT IS DELIBERATE. The board is `XrPanel`,
// and it stays `XrPanel` because it is the only surface a child DRAWS on: its
// pointer quad, its drag plane and its world→surface mapping are all computed
// in WORLD space (`surface-drag.ts`). Parenting it under a head node would make
// that placement head-local while the ray stayed world — ink at a plausible,
// slightly wrong place, which is the hardest class of bug to see in a headset
// and the one ADR-117 already paid for once. So the flanks are placed in world
// space too, from the same head pose, and every surface keeps one frame.
//
// THE ARC IS `SLOTS`, ROTATED ONTO THE HEAD. poke-xr authors the three slots
// head-relative — a cylinder of radius 1.9 m at `SLOT_Y`, just below eye level
// — which is only true when the origin IS the head. On a PICO the world origin
// is the FLOOR, and that single mismatch is what opened the composition at the
// child's feet three sessions running. Here the slot offsets are turned by the
// child's yaw and added to their measured head position, so "eye level" holds
// standing or seated, for any height.
//
// THE PANELS THEMSELVES ARE poke-xr's, VENDORED WHOLE (`premium/`): slot
// snapping, drag with snap-back, and a scrolling row rail that has been revised
// seven times against this hardware. The conversation is what that rail is for.
// SOT: packages/ui/xr/premium/index.ts · packages/ui/xr/surface-drag.ts
// SOT-KEYWORDS: xr tri panel side panels arc slots drag snap scroll eye level head relative world space

import { PremiumXRMediaPanel } from './premium/index.ts';
/* The same call `XrBoardSurface` places the pointer quad by — one arithmetic,
   so the board a child sees and the plane their ray hits cannot drift apart. */
import { worldSlot } from './world-slot.ts';
import type { XrTriPanelProps } from './XrTriPanel.types.ts';

export function XrTriPanel({
  headPosition,
  headYawDeg,
  boardUri,
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
        imageSource={{ uri: placeholderUri }}
        rows={[...controlRows]}
        size="portraitCard"
        /* No art column: these panels are a list, and a media strip would take
           the width the rows read in. */
        mediaFraction={0}
        worldPlacement={left}
        draggable
        snapOnRelease
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
        imageSource={{ uri: boardUri ?? placeholderUri }}
        rows={[]}
        size="boardPanel"
        mediaFraction={1}
        worldPlacement={centre}
        draggable
        snapOnRelease
      />
      <PremiumXRMediaPanel
        title={tutorName}
        imageSource={{ uri: placeholderUri }}
        rows={[...chatRows]}
        size="portraitCard"
        mediaFraction={0}
        worldPlacement={right}
        draggable
        snapOnRelease
        /* The conversation is the surface that genuinely needs the rail — it is
           the only one that outgrows its panel. */
        alwaysShowRail
      />
    </>
  );
}

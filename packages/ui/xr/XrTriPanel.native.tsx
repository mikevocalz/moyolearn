'use client';
// Three world-locked panels: tools, portrait paper, and the current conversation.
// A successful native binding selects the live board material. Otherwise the
// last export plus pending ink is the board, and it still takes handwriting.
// Dragging: each flank's grip moves that flank alone (native carrier write,
// committed on release — see carrier-drag.ts). This fallback centre panel is
// not draggable because `XrBoardSurface` is placed from the same `worldSlot`
// and would not follow it; the Rive board, which carries its own input plane,
// drags alone.
// SOT: world-slot.ts · premium/PremiumXRMediaPanel.tsx
// SOT-KEYWORDS: xr panels live board tools portrait workspace

import { ViroNode, ViroSpinner } from '@reactvision/react-viro';
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { PremiumXRMediaPanel } from './premium/index.ts';
/* The same call `XrBoardSurface` places the pointer quad by — one arithmetic,
   so the board a child sees and the plane their ray hits cannot drift apart. */
import { worldSlot } from './world-slot.ts';
import type { XrTriPanelProps } from './XrTriPanel.types.ts';

export function XrTriPanel({
  loading = false,
  centerPanel,
  leftPanel,
  questionRows,
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
      {loading ? [left, centre, right].map((slot, i) => (
        <ViroSpinner
          key={i}
          type="light"
          materials={[XR_MATERIAL.spinner]}
          ignoreEventHandling
          position={[slot.position[0], slot.position[1], slot.position[2]]}
          rotation={[0, slot.yaw, 0]}
          scale={[0.3, 0.3, 0.3]}
        />
      )) : null}
      {/* Always this node, so flipping `loading` never remounts the panels. */}
      <ViroNode visible={!loading}>
      {leftPanel ?? <PremiumXRMediaPanel
        title={questionRows ? "Lesson & tools" : "Tools"}
        controlSize={controlSize}
        imageSource={{ uri: placeholderUri }}
        rows={[...controlRows, ...(questionRows ?? [])]}
        size="toolsCard"
        /* No art column: these panels are a list, and a media strip would take
           the width the rows read in. */
        mediaFraction={0}
        worldPlacement={left}
        draggable
        /* Slot snapping targets the head-local SLOTS table, not this world
           placement — snapping would throw the panel across the room. */
        snapOnRelease={false}
        animate={false}
      />}
      {/*
        THE BOARD, IN A PANEL. `mediaFraction={1}` gives the child's paper the
        whole body — the poke-xr clamp opened at both ends for exactly this —
        and the media source is the engine's own raster, so the panel shows the
        real board rather than a second rendering of it. Wider than the flanks
        because it is the thing being worked on.
      */}
      {centerPanel ?? <PremiumXRMediaPanel
        title={boardTitle}
        mediaMaterial={boardLive ? XR_MATERIAL.boardLive : undefined}
        imageSource={{ uri: boardUri ?? placeholderUri }}
        rows={[]}
        size="boardPanel"
        mediaFraction={1}
        worldPlacement={centre}
        draggable={false}
        animate={false}
      />}
      <PremiumXRMediaPanel
        title={tutorName}
        imageSource={{ uri: placeholderUri }}
        rows={[...(leftPanel ? controlRows : []), ...chatRows]}
        size="portraitCard"
        mediaFraction={0}
        worldPlacement={right}
        draggable
        snapOnRelease={false}
        animate={false}
        /* The conversation is the surface that genuinely needs the rail — it is
           the only one that outgrows its panel. */
        alwaysShowRail
        scrollResetKey={chatRows[0]?.id}
      />
      </ViroNode>
    </>
  );
}

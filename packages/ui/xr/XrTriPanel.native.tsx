'use client';
// The three panels, on the arc, at the child's eye level — controls left,
// board centre, conversation right.
//
// WHAT THIS REPLACES. The board used to carry its rail and the chat as
// ornaments of ONE anchor: a rail coplanar with the paper and a companion
// hanging off its edge, which read in the headset as a single wide slab. These
// are three separate `PremiumXRMediaPanel`s — the poke-xr component, vendored
// whole under `premium/` — each snapped to its own named slot, each draggable
// on its own, each snapping back when released.
//
// THE HEAD IS THE PARENT, AND THAT IS THE EYE-LEVEL FIX. `SLOTS` is authored
// head-relative: a cylinder of radius 1.9 m around the ORIGIN, at `SLOT_Y`
// just below eye level. That is only true if the origin IS the head, and on a
// PICO the world origin is the FLOOR — which is exactly how three sessions in
// a row opened with the composition at the child's feet. So this node is
// placed AT the head pose and the three panels hang off it in the frame they
// were designed for. Standing, seated, tall, small: the arc follows the head
// rather than assuming one.
//
// THE BOARD IS THE CENTRE PANEL'S MEDIA. `imageSource` takes the engine's own
// raster (`WhiteboardHandle.exportPng`), which is the picture the spatial paper
// was already drawing — so the centre slot shows the real board rather than a
// second rendering of it.
// SOT: packages/ui/xr/premium/index.ts · packages/app/features/tutor/tutor-xr-screen.native.tsx
// SOT-KEYWORDS: xr tri panel three slots arc drag snap eye level head relative board chat controls

import { ViroNode } from '@reactvision/react-viro';
import { PremiumXRMediaPanel, type MediaPanelRow } from './premium/index.ts';
import type { XrVector3 } from './XrPanel.types.ts';

export interface XrTriPanelProps {
  /** The child's head in world metres — the frame `SLOTS` is authored in. */
  headPosition: XrVector3;
  /** The child's facing, in degrees about Y. The whole arc turns with them. */
  headYawDeg: number;
  /** The board, as the engine's own PNG. Null until the first raster lands. */
  boardUri: string | null;
  /** The question above the board, as the centre panel's title. */
  boardTitle: string;
  /** Rows for the conversation panel — oldest first; the panel scrolls them. */
  chatRows: readonly MediaPanelRow[];
  /** Rows for the controls panel: what the rail offers, as readable lines. */
  controlRows: readonly MediaPanelRow[];
  tutorName: string;
  /** A blank 1×1 the media column falls back to before the first raster. */
  placeholderUri: string;
}

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
  return (
    <ViroNode
      position={[headPosition[0], headPosition[1], headPosition[2]]}
      rotation={[0, headYawDeg, 0]}
    >
      {/*
        Each panel owns its slot. `draggable` and `snapOnRelease` are the
        component's defaults and are named here because they are the behaviour
        being asked for: a child can pull a panel toward them and let go, and it
        returns to the arc.
      */}
      <PremiumXRMediaPanel
        slot="left"
        title="Tools"
        imageSource={{ uri: placeholderUri }}
        rows={[...controlRows]}
        size="standardCard"
        mediaFraction={0}
        draggable
        snapOnRelease
        useSlotYaw
      />
      <PremiumXRMediaPanel
        slot="center"
        title={boardTitle}
        imageSource={{ uri: boardUri ?? placeholderUri }}
        rows={[]}
        size="widePanel"
        /* The board IS the panel: the media column takes the whole body. */
        mediaFraction={1}
        draggable
        snapOnRelease
        useSlotYaw
      />
      <PremiumXRMediaPanel
        slot="right"
        title={tutorName}
        imageSource={{ uri: placeholderUri }}
        rows={[...chatRows]}
        size="standardCard"
        mediaFraction={0}
        draggable
        snapOnRelease
        useSlotYaw
        /* The conversation is the one surface that genuinely needs the rail. */
        alwaysShowRail
      />
    </ViroNode>
  );
}

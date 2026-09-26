/**
 * Layouts-API probe: the three-slot arc populated with the real pieces —
 * Rive panel LEFT, digital board CENTER, Natalie RIGHT.
 *
 * `worldSlot` is the layout primitive under test: the same call that places
 * `XrTriPanel` places these, so the probe proves slot geometry against
 * production payloads rather than placeholder quads.
 *
 * Mount below a Viro scene with one ViroController. `head`/`yawDeg` come from
 * the first credible camera transform — same latch `rive-panel-probe` uses.
 *
 * SOT: packages/ui/xr/world-slot.ts · packages/ui/xr/premium/spatialTokens.ts
 * SOT-KEYWORDS: xr layout probe three slot arc rive board natalie engineering
 */
import React from 'react';
import { worldSlot, PremiumXRMediaPanel } from '@acme/ui/xr';
import { XrNatalie } from '@acme/app/features/tutor/XrNatalie.native.tsx';
import { RivePanelProbe, type PanelPose } from './rive-panel-probe';

/* The board slot's paper — a solid navy tile standing in for the live raster.
   The probe is about WHERE the pieces sit, not board content. */
const BOARD_NAVY =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMQ1HUBAADVAIMlT/4aAAAAAElFTkSuQmCC';

/* Her feet: slots are head-relative at eye height; she stands ~1.55 m below. */
const NATALIE_DROP_M = 1.55;

export function XrLayoutProbe({
  bytes,
  head,
  yawDeg,
  resetKey = 0,
}: {
  bytes: ArrayBuffer;
  head: readonly [number, number, number];
  yawDeg: number;
  /* Controller reconnect remounts the Rive panel — same latch as the probe. */
  resetKey?: number;
}) {
  const left = worldSlot('left', head, yawDeg);
  const centre = worldSlot('center', head, yawDeg);
  const right = worldSlot('right', head, yawDeg);

  const rivePose: PanelPose = {
    position: [left.position[0], left.position[1], left.position[2]],
    rotation: [0, left.yaw, 0],
  };

  return (
    <>
      <RivePanelProbe bytes={bytes} initialPose={rivePose} resetKey={resetKey} />
      <PremiumXRMediaPanel
        title="Digital board"
        imageSource={{ uri: BOARD_NAVY }}
        rows={[
          { id: 'probe-1', text: 'Layout probe — centre slot' },
          { id: 'probe-2', text: 'Live ink wires in via XrBoardSurface' },
        ]}
        size="boardPanel"
        mediaFraction={0.62}
        worldPlacement={centre}
        draggable={false}
        animate={false}
      />
      <XrNatalie
        position={[right.position[0], right.position[1] - NATALIE_DROP_M, right.position[2]]}
        rotationY={right.yaw}
      />
    </>
  );
}

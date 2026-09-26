/**
 * Layouts-API probe: the three-slot arc populated with the real pieces —
 * Rive panel LEFT, digital board CENTRE, Natalie RIGHT.
 *
 * `worldSlot` is the layout primitive under test: the same call that places
 * `XrTriPanel` places these, so the probe proves slot geometry against
 * production payloads rather than placeholder quads.
 *
 * THE BOARD IS THE REAL ENGINE, not a picture of one: `BoardTextureHost`
 * parks a live `WhiteboardBoard` in the 2D tree (the route mounts it), binds
 * its page to `XR_MATERIAL.boardLive`, and `XrBoardSurface` turns ray hits on
 * the paper into `injectPointer` calls — the same pipeline the tutor scene
 * runs. While the binding is out the panel falls back to a navy tile and the
 * surface stays disabled.
 *
 * THE BOARD DRAGS LIKE THE RIVE PANEL DOES — the same `dragTransform="parent"`
 * mechanic: the amber grip below the tray drags the CARRIER node, and the
 * panel, the pointer surface, the tray and the grip are all children of it, so
 * the ink plane can never drift from the paper it measures against. That is
 * the reason `XrTriPanel` disables panel drag outright; the carrier is the
 * form that keeps the sibling surface and the artwork in one transform.
 *
 * Mount below a Viro scene with one ViroController. `head`/`yawDeg` come from
 * a settled camera pose — see the route.
 *
 * SOT: packages/ui/xr/world-slot.ts · packages/ui/xr/premium/spatialTokens.ts
 * SOT-KEYWORDS: xr layout probe three slot arc rive board natalie engineering drag carrier tray live board
 */
import React, { useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { ViroMaterials, ViroNode, ViroQuad, ViroText } from '@reactvision/react-viro';
import {
  PANEL_HEIGHT_M,
  PremiumXRMediaPanel,
  SIZES,
  XR_MATERIAL,
  XrBoardSurface,
  XrBoardTray,
  boardSurfacePixels,
  boardTrayHeight,
  panelMediaArea,
  spatialDistance,
  spatialSpacing,
  worldSlot,
  type XrSurfaceInput,
  type XrVector3,
} from '@acme/ui/xr';
import type { WhiteboardHandle, WhiteboardInk, WhiteboardTool } from '@acme/ui';
import { XrNatalie } from '@acme/app/features/tutor/XrNatalie.native.tsx';
import { useTutorStore } from '@acme/app/features/tutor/tutor.store.ts';
import { RivePanelProbe, type PanelPose } from './rive-panel-probe';
import { RiveBoardPanel } from './rive-board-panel';
import type { BoardChromeHandlers } from './board-chrome-bind';

/* The board slot's paper before the engine binds — a solid navy tile. */
const BOARD_NAVY =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMQ1HUBAADVAIMlT/4aAAAAAElFTkSuQmCC';

/* The grip bar — same amber as the Rive panel's, so the affordance reads the
   same on both panels. */
const GRIP_W = 0.65;
const GRIP_H = 0.09;

/*
 * Probe state lives at module scope rather than in the route component: the
 * scene renders inside the navigator's own tree, and one JS VM backs both —
 * so a module store is the seam the 2D host writes through (bound, engine
 * ready) and the immersive side reads, which is also how the route learns
 * `placed` without a callback.
 */
export const xrLayoutProbe = createStore(() => ({
  /** The settled pose the composition was placed from — written by the route's
     camera latch, read for diagnostics and the `live` gate. */
  placed: null as { head: XrVector3; yawDeg: number } | null,
  bound: false,
  boundReason: null as string | null,
  engineReady: false,
  /** Set once the greeting has been sent — it must not re-fire on rebinds. */
  greeted: false,
  tool: 'draw' as WhiteboardTool,
  ink: 'black' as WhiteboardInk,
  asking: false,
  /** The carrier's persisted drag transform — survives `resetKey` remounts. */
  boardOffset: null as {
    position: [number, number, number];
    rotation: [number, number, number];
  } | null,
  grabbed: false,
  natalieStatus: '' as string,
  /* The Rive chrome's view of the board — `onHistory` reports these off the
     engine's own `listenHistory`, the presentation half of the bind. */
  canUndo: false,
  canRedo: false,
  hasMarks: false,
  /** The chrome's inks row is showing in place of the tools row. */
  paletteOpen: false,
  /** Clear pressed once — the second press empties the board. */
  clearArmed: false,
  /** The Rive chrome failed to start — the tray is the fallback toolbar. */
  chromeFailed: false,
}));

/* The engine handle, for the same reason `active.engine` is module scope in
   the tutor screen: the immersive tree cannot close over a route-level ref. */
export const xrLayoutEngine: { current: WhiteboardHandle | null } = { current: null };

const setTool = (tool: WhiteboardTool) => {
  xrLayoutProbe.setState({ tool });
  xrLayoutEngine.current?.setTool(tool);
};
const setInk = (ink: WhiteboardInk) => {
  xrLayoutProbe.setState({ ink });
  xrLayoutEngine.current?.setInk(ink);
};

/* The probe's Ask is a greeting turn — the same signed coach stream the
   production Ask lands on, minus the microphone. Shared by the tray and the
   Rive chrome so both buttons do the same thing, not two similar things. */
const askNatalie = () => {
  xrLayoutProbe.setState({ asking: true });
  useTutorStore
    .getState()
    .coach('The learner tapped Ask on the digital board. Say hello and invite them to draw something on it.')
    .catch(() => undefined)
    .finally(() => xrLayoutProbe.setState({ asking: false }));
};

/*
  The verbs Rive commands reach — every one lands on the same engine/store the
  tray drives, so a chrome press and a tray key are indistinguishable to the
  document. Clear is two-step: first press arms, second commits — a ray is a
  far less precise instrument than a thumb, and an empty board is not a
  recoverable click away.
*/
const boardChromeHandlers: BoardChromeHandlers = {
  onTool: (tool) => {
    setTool(tool);
    xrLayoutProbe.setState({ clearArmed: false });
  },
  onInk: (ink) => {
    setInk(ink);
    setTool('draw');
    xrLayoutProbe.setState({ paletteOpen: false, clearArmed: false });
  },
  onPalette: (open) => xrLayoutProbe.setState({ paletteOpen: open, clearArmed: false }),
  onUndo: () => {
    xrLayoutEngine.current?.undo();
    xrLayoutProbe.setState({ clearArmed: false });
  },
  onRedo: () => {
    xrLayoutEngine.current?.redo();
    xrLayoutProbe.setState({ clearArmed: false });
  },
  onClear: () => {
    if (!xrLayoutProbe.getState().clearArmed) {
      xrLayoutProbe.setState({ clearArmed: true });
      return;
    }
    xrLayoutEngine.current?.clear();
    xrLayoutProbe.setState({ clearArmed: false });
  },
  onAsk: () => {
    xrLayoutProbe.setState({ clearArmed: false });
    askNatalie();
  },
};

export function XrLayoutProbe({
  bytes,
  chromeBytes,
  head,
  yawDeg,
  resetKey = 0,
}: {
  bytes: ArrayBuffer;
  /** `moyo_board_chrome.riv` — when absent the centre slot keeps the
      media-panel + tray composition the probe always had. */
  chromeBytes: ArrayBuffer | null;
  head: readonly [number, number, number];
  yawDeg: number;
  /* Controller reconnect remounts the Rive panel — same latch as the probe. */
  resetKey?: number;
}) {
  const bound = useStore(xrLayoutProbe, (s) => s.bound);
  const boundReason = useStore(xrLayoutProbe, (s) => s.boundReason);
  const engineReady = useStore(xrLayoutProbe, (s) => s.engineReady);
  const grabbed = useStore(xrLayoutProbe, (s) => s.grabbed);
  const boardOffset = useStore(xrLayoutProbe, (s) => s.boardOffset);
  const tool = useStore(xrLayoutProbe, (s) => s.tool);
  const ink = useStore(xrLayoutProbe, (s) => s.ink);
  const asking = useStore(xrLayoutProbe, (s) => s.asking);
  const canUndo = useStore(xrLayoutProbe, (s) => s.canUndo);
  const canRedo = useStore(xrLayoutProbe, (s) => s.canRedo);
  const hasMarks = useStore(xrLayoutProbe, (s) => s.hasMarks);
  const paletteOpen = useStore(xrLayoutProbe, (s) => s.paletteOpen);
  const clearArmed = useStore(xrLayoutProbe, (s) => s.clearArmed);
  const chromeFailed = useStore(xrLayoutProbe, (s) => s.chromeFailed);
  /* Chrome bytes present and the runtime hasn't reported an error → the Rive
     frame owns the centre slot. */
  const chrome = chromeBytes !== null && !chromeFailed;

  const left = worldSlot('left', head, yawDeg);
  const centre = worldSlot('center', head, yawDeg);
  const right = worldSlot('right', head, yawDeg);

  const rivePose: PanelPose = {
    position: [left.position[0], left.position[1], left.position[2]],
    rotation: [0, left.yaw, 0],
  };

  /*
    The tray hangs under the panel's own bottom edge — a classroom ledge, one
    `sm` below the frame. `boardTrayHeight` is the tray's extent for this band;
    the panel's is `SIZES`, both read rather than guessed.
  */
  const mediaArea = panelMediaArea('boardPanel');
  const trayHeight = boardTrayHeight(spatialDistance.board, false, 'young');
  const trayCenterY = centre.position[1] - SIZES.boardPanel.height / 2 - spatialSpacing.sm - trayHeight / 2;
  const gripCenterY = trayCenterY - trayHeight / 2 - spatialSpacing.xs - GRIP_H / 2;
  /* The chrome panel is taller than the boardPanel media card — its grip hangs
     the same `sm` under its own bottom edge, not the media card's. */
  const chromeGripY = centre.position[1] - PANEL_HEIGHT_M / 2 - spatialSpacing.sm - GRIP_H / 2;

  const boardGroup = useRef<ViroNode>(null);
  const grabOwner = useRef<number | null>(null);

  useEffect(() => {
    ViroMaterials.createMaterials({
      xrProbeGrip: { diffuseColor: '#ffc168', lightingModel: 'Constant' },
    });
    return () => ViroMaterials.deleteMaterials(['xrProbeGrip']);
  }, []);

  const finishDrag = async () => {
    grabOwner.current = null;
    try {
      const next = await boardGroup.current?.getTransformAsync();
      if (next) xrLayoutProbe.setState({ boardOffset: { position: next.position, rotation: next.rotation } });
    } catch {
      /* A transform that never read back just re-centres on remount. */
    }
    xrLayoutProbe.setState({ grabbed: false });
  };

  const inject = (sample: XrSurfaceInput) => {
    xrLayoutEngine.current?.injectPointer({
      phase: sample.phase,
      x: sample.u * boardSurfacePixels.width,
      y: sample.v * boardSurfacePixels.height,
      pressure: sample.pressure,
    });
  };

  return (
    <>
      <RivePanelProbe bytes={bytes} initialPose={rivePose} resetKey={resetKey} />
      {chrome && chromeBytes ? (
        <RiveBoardPanel
          chromeBytes={chromeBytes}
          slot={{ position: [centre.position[0], centre.position[1], centre.position[2]], yaw: centre.yaw }}
          carrier={boardOffset}
          grabbed={grabbed}
          bound={bound}
          resetKey={resetKey}
          onCarrierRelease={(pose) => xrLayoutProbe.setState({ boardOffset: pose })}
          onGrab={(v) => xrLayoutProbe.setState({ grabbed: v })}
          onSurfaceInput={inject}
          handlers={boardChromeHandlers}
          presentation={{
            tool,
            ink,
            canUndo,
            canRedo,
            asking,
            hasMarks,
            paletteOpen,
            clearArmed,
            grabbed,
            reducedMotion: false,
            status: bound ? '' : boundReason ?? 'Waiting for the board…',
          }}
          gripWorld={{ position: [centre.position[0], chromeGripY, centre.position[2]], yawDeg: centre.yaw }}
          onChromeError={(message) => {
            if (__DEV__) console.warn('[xr-layout-probe]', message);
            xrLayoutProbe.setState({ chromeFailed: true });
          }}
        />
      ) : (
      /*
        The carrier is the dragged node. It starts at identity — every child
        carries an absolute world pose — so the grip's `dragTransform="parent"`
        translates the whole board stack together, exactly like the Rive
        panel's grip moves its group. The persisted offset re-applies on
        remount so a tracking blink does not steal the child's arrangement.

        This stack is ALSO the chrome's fallback: if the BoardChrome runtime
        fails, `chromeFailed` latches and the same board the probe always had
        keeps working — the `boardOffset` store is shared, so a pose the grip
        earned under one survives the swap.
      */
      <ViroNode
        ref={boardGroup}
        position={boardOffset?.position ?? [0, 0, 0]}
        rotation={boardOffset?.rotation ?? [0, 0, 0]}
      >
        <PremiumXRMediaPanel
          title="Digital board"
          mediaMaterial={bound ? XR_MATERIAL.boardLive : undefined}
          imageSource={{ uri: BOARD_NAVY }}
          rows={[]}
          size="boardPanel"
          mediaFraction={1}
          worldPlacement={centre}
          draggable={false}
          animate={false}
        />
        <XrBoardSurface
          headPosition={[head[0], head[1], head[2]]}
          headYawDeg={yawDeg}
          /* Unbound there is no paper to see a stroke on — the probe has no
             raster fallback, so the honest state is rays declined, not ink a
             child cannot watch land. */
          enabled={bound && !grabbed}
          onSurfaceInput={inject}
        />
        <ViroNode
          position={[centre.position[0], trayCenterY, centre.position[2]]}
          rotation={[0, centre.yaw, 0]}
        >
          <XrBoardTray
            width={mediaArea.width}
            distanceM={spatialDistance.board}
            handsPrimary={false}
            band="young"
            tool={tool}
            ink={ink}
            canUndo={canUndo}
            canRedo={canRedo}
            asking={asking}
            onTool={setTool}
            onInk={(next) => {
              setInk(next);
              setTool('draw');
            }}
            onUndo={() => xrLayoutEngine.current?.undo()}
            onRedo={() => xrLayoutEngine.current?.redo()}
            onAsk={askNatalie}
            onClear={() => xrLayoutEngine.current?.clear()}
          />
        </ViroNode>
        {/* The amber grip — the Rive panel's move affordance, under the ledge. */}
        <ViroQuad
          position={[centre.position[0], gripCenterY, centre.position[2]]}
          rotation={[0, centre.yaw, 0]}
          width={GRIP_W}
          height={GRIP_H}
          materials={['xrProbeGrip']}
          highAccuracyEvents
          dragType="FixedDistanceOrigin"
          dragTransform="parent"
          onDrag={() => {}}
          onClickState={(state: number, _position: number[], sourceId: number) => {
            if (state === 1 && grabOwner.current === null) {
              grabOwner.current = sourceId;
              xrLayoutProbe.setState({ grabbed: true });
            } else if (state === 2 && sourceId === grabOwner.current) void finishDrag();
          }}
        />
        <ViroText
          text={grabbed ? 'Moving board' : 'Hold to move'}
          position={[centre.position[0], gripCenterY + 0.008, centre.position[2]]}
          rotation={[0, centre.yaw, 0]}
          width={2.4}
          height={0.36}
          scale={[0.25, 0.25, 0.25]}
          maxLines={1}
          textClipMode="ClipToBounds"
          ignoreEventHandling
          style={{ fontSize: 20, color: '#112d44', textAlign: 'center', textAlignVertical: 'center' }}
        />
      </ViroNode>
      )}
      {/*
        Her feet sit at y = 0: on a floor-referenced runtime that IS the floor,
        which is the convention `tutor-xr-screen` already keeps — the GLB is
        authored 1.673 m tall at scale 1, average human height, so no scale
        prop is applied or needed.
      */}
      <XrNatalie
        position={[right.position[0], 0, right.position[2]]}
        rotationY={right.yaw}
        onStatus={(status) => xrLayoutProbe.setState({ natalieStatus: status })}
      />
    </>
  );
}

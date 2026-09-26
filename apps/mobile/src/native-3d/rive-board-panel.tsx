/**
 * The Rive-framed digital board — ONE spatial object: Rive chrome (frame +
 * toolbar + palette) wrapped around the live Quickdraw quad, inside the
 * carrier node that drags, with the invisible input plane covering exactly the
 * content window.
 *
 * THE COMPOSITION, AND WHY THERE IS NO ROUTER:
 *
 *   carrier ViroNode (the dragged object; persisted offset)
 *     └─ slot ViroNode (world slot pose, as a child of the carrier)
 *         ├─ ViroRivePanel   BoardChrome artboard — the whole panel face.
 *         │                  Its own native input maps rays to artboard
 *         │                  listeners; nothing sits in front of its chrome.
 *         └─ ViroQuad        XR_MATERIAL.boardLive at CONTENT_RECT — the
 *                            engine's texture visible through the chrome's
 *                            transparent window.
 *   XrBoardSurface           WORLD-anchored sibling (never nested — Viro
 *                            reports hits in world space, so its anchor is
 *                            carrier ∘ slot ∘ rect, recomputed on release).
 *                            It covers ONLY the content rect, which is the
 *                            arbitration: paper rays draw, toolbar rays fall
 *                            through to the chrome, grip rays drag. One owner
 *                            per pointer is BoardPointer's own contract.
 *   grip ViroQuad            the same amber parent-drag bar the Rive probe
 *                            carries — `dragTransform="parent"`.
 *
 * While `grabbed` the surface is disabled (which cancels an in-flight stroke
 * via its own cleanup) and the chrome's input is off — a panel in the hand
 * never draws and a stroke in the hand never moves the panel.
 *
 * SOT: packages/ui/xr/board-chrome-layout.ts · packages/ui/xr/board-chrome-commands.ts ·
 *      packages/ui/xr/XrBoardSurface.native.tsx · ./board-chrome-bind.ts
 * SOT-KEYWORDS: xr rive board chrome panel composition carrier content rect input arbitration live texture grip drag
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { ViroMaterials, ViroNode, ViroQuad, ViroRivePanel, ViroText } from '@reactvision/react-viro';
import { worldMatrix, type RivePanel, type RiveCanvasOptions } from 'nitro-canvas-in-Vision';
import {
  CONTENT_BAND,
  CONTENT_RECT_PANEL,
  PANEL_HEIGHT_M,
  PANEL_WIDTH_M,
  XrBoardLive,
  XrBoardSurface,
  artboardCenter,
  contentAnchorWorld,
  type XrSurfaceInput,
  type XrVector3,
} from '@acme/ui/xr';
import { bindBoardChrome, type BoardChromeHandlers, type BoardChromePresentation } from './board-chrome-bind';

/** The grip bar — same affordance as the Rive probe's, same amber. */
const GRIP_W = 0.65;
const GRIP_H = 0.09;

/* The content window's centre in panel-local metres — computed once from the
   same artboard rect the RML draws. */
const contentCentre = artboardCenter(CONTENT_BAND);

export interface RiveBoardPanelProps {
  /** Compiled `moyo_board_chrome.riv` bytes. */
  chromeBytes: ArrayBuffer;
  /** The centre slot's world pose at placement time. */
  slot: { position: readonly [number, number, number]; yaw: number };
  /** The carrier's persisted drag pose — `null` is identity at the slot. */
  carrier: { position: readonly [number, number, number]; rotation: readonly [number, number, number] } | null;
  /** True while the grip is held — gates BOTH input paths off. */
  grabbed: boolean;
  /** The live texture is bound — unbound, the window shows the navy tile. */
  bound: boolean;
  resetKey?: number;
  /** Persisted carrier pose on release — same contract as the probe grip. */
  onCarrierRelease(pose: { position: [number, number, number]; rotation: [number, number, number] }): void;
  onGrab(grabbed: boolean): void;
  /** One surface sample → the engine (`injectPointer`). */
  onSurfaceInput(sample: XrSurfaceInput): void;
  /** The verbs Rive commands reach. */
  handlers: BoardChromeHandlers;
  /** Current application state — pushed into the view model on change. */
  presentation: BoardChromePresentation;
  /** The grip's world position under the panel — callers keep the tokens. */
  gripWorld: { position: XrVector3; yawDeg: number };
  /** The chrome runtime failed — the host decides the fallback (tray etc.). */
  onChromeError?(message: string): void;
}

export function RiveBoardPanel({
  chromeBytes,
  slot,
  carrier,
  grabbed,
  bound,
  resetKey = 0,
  onCarrierRelease,
  onGrab,
  onSurfaceInput,
  handlers,
  presentation,
  gripWorld,
  onChromeError,
}: RiveBoardPanelProps) {
  const carrierNode = useRef<ViroNode>(null);
  const runtime = useRef<RivePanel | null>(null);
  const binding = useRef<ReturnType<typeof bindBoardChrome> | null>(null);
  const owner = useRef<number | null>(null);
  const mounted = useRef(true);
  /* Handlers change every render; the binding is installed once. A ref is the
     established pattern here (`XrBoardSurface.emit`). */
  const dispatch = useRef(handlers);
  const presented = useRef(presentation);
  dispatch.current = handlers;
  presented.current = presentation;

  const carrierPose = useMemo(() => ({
    position: carrier?.position ?? ([0, 0, 0] as const),
    rotation: carrier?.rotation ?? ([0, 0, 0] as const),
  }), [carrier]);

  /*
    The chrome's own input maps world rays to artboard hits off this matrix —
    the SAME ancestor chain the Viro tree composes, expressed the way
    `useCanvasInViroInput` wants it. Stale during a drag is safe because input
    is disabled while grabbed; it recomputes on the release render.
  */
  const panelWorld = useMemo(
    () =>
      worldMatrix([
        { position: carrierPose.position, rotation: carrierPose.rotation },
        { position: slot.position, rotation: [0, slot.yaw, 0] },
      ]),
    [carrierPose, slot],
  );

  /* The world anchor the input plane covers — content rect only. */
  const contentAnchor = useMemo(
    () =>
      contentAnchorWorld(slot, {
        position: carrierPose.position as [number, number, number],
        yawDeg: carrierPose.rotation[1] ?? 0,
      }),
    [slot, carrierPose],
  );

  const source = useMemo<RiveCanvasOptions>(
    () => ({ rivBytes: chromeBytes, artboard: 'BoardChrome', stateMachine: 'BoardChrome', fit: 'contain' }),
    [chromeBytes],
  );

  const finishGrab = async () => {
    if (owner.current === null) return;
    owner.current = null;
    runtime.current?.setBoolean('grabbed', false);
    try {
      const next = await carrierNode.current?.getTransformAsync();
      if (mounted.current && next) onCarrierRelease({ position: next.position, rotation: next.rotation });
    } finally {
      if (mounted.current) onGrab(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    ViroMaterials.createMaterials({
      xrBoardGrip: { diffuseColor: '#ffc168', lightingModel: 'Constant' },
      xrBoardEmpty: { diffuseColor: '#112d44', lightingModel: 'Constant' },
    });
    return () => {
      mounted.current = false;
      binding.current?.dispose();
      binding.current = null;
      runtime.current = null;
      ViroMaterials.deleteMaterials(['xrBoardGrip', 'xrBoardEmpty']);
    };
  }, []);

  /* resetKey (tracking loss / controller reconnect) releases any grab —
     identical latch to the Rive probe's. */
  useEffect(() => { void finishGrab(); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Push application state into the view model whenever it moves. */
  useEffect(() => {
    binding.current?.push(presented.current);
  }, [presentation]);

  return (
    <>
      <ViroNode ref={carrierNode} position={[...carrierPose.position]} rotation={[...carrierPose.rotation]}>
        <ViroNode position={[slot.position[0], slot.position[1], slot.position[2]]} rotation={[0, slot.yaw, 0]}>
          <ViroRivePanel
            source={source}
            width={PANEL_WIDTH_M}
            height={PANEL_HEIGHT_M}
            position={[0, 0, 0]}
            resolution={{ width: 1024, height: 780 }}
            input={{ panelWorld, enabled: !grabbed, resetKey }}
            onError={(error) => onChromeError?.(`Board controls unavailable: ${error.message}`)}
            onRuntimeReady={(rt) => {
              runtime.current = rt;
              binding.current?.dispose();
              binding.current = bindBoardChrome(rt, {
                onTool: (t) => dispatch.current.onTool(t),
                onInk: (i) => dispatch.current.onInk(i),
                onPalette: (o) => dispatch.current.onPalette(o),
                onUndo: () => dispatch.current.onUndo(),
                onRedo: () => dispatch.current.onRedo(),
                onClear: () => dispatch.current.onClear(),
                onAsk: () => dispatch.current.onAsk(),
              });
              binding.current.push(presented.current);
            }}
          />
          {/*
            The live board texture — `XrBoardLive`, the same quad the media
            panel binds — sits at `boardLayer.raster` (0.5 mm) off this node,
            which puts it in front of the chrome face and behind the pointer
            plane (2 mm). It spans only the transparent window, so toolbar
            chrome shows everywhere else. Unbound: the navy tile the old probe
            drew for the same state.
          */}
          <ViroNode position={[...contentCentre]}>
            {bound ? (
              <XrBoardLive width={CONTENT_RECT_PANEL.width} height={CONTENT_RECT_PANEL.height} />
            ) : (
              <ViroQuad
                width={CONTENT_RECT_PANEL.width}
                height={CONTENT_RECT_PANEL.height}
                materials={['xrBoardEmpty']}
                ignoreEventHandling
              />
            )}
          </ViroNode>
        </ViroNode>
        {/* The grip — carrier child at a world pose, the probe's own trick. */}
        <ViroQuad
          position={[gripWorld.position[0], gripWorld.position[1], gripWorld.position[2]]}
          rotation={[0, gripWorld.yawDeg, 0]}
          width={GRIP_W}
          height={GRIP_H}
          materials={['xrBoardGrip']}
          highAccuracyEvents
          dragType="FixedDistanceOrigin"
          dragTransform="parent"
          onDrag={() => {}}
          onClickState={(state: number, _position: number[], sourceId: number) => {
            if (state === 1 && owner.current === null) {
              owner.current = sourceId;
              onGrab(true);
              runtime.current?.setBoolean('grabbed', true);
            } else if (state === 2 && sourceId === owner.current) void finishGrab();
          }}
        />
        <ViroText
          text={grabbed ? 'Moving board' : 'Hold to move'}
          position={[gripWorld.position[0], gripWorld.position[1] + 0.008, gripWorld.position[2]]}
          rotation={[0, gripWorld.yawDeg, 0]}
          width={2.4}
          height={0.36}
          scale={[0.25, 0.25, 0.25]}
          maxLines={1}
          textClipMode="ClipToBounds"
          ignoreEventHandling
          style={{ fontSize: 20, color: '#112d44', textAlign: 'center', textAlignVertical: 'center' }}
        />
      </ViroNode>
      {/*
        THE INPUT PLANE IS A SIBLING, WORLD-ANCHORED. It is invisible, so it
        does not need to ride the carrier; it needs the anchor recomputed when
        the carrier lands — which `contentAnchor` does from the persisted
        pose. While grabbed it is unmounted entirely (`enabled`), which is also
        the stroke-cancel path: a panel in motion cannot carry a stroke.
      */}
      <XrBoardSurface
        headPosition={[0, 0, 0]}
        headYawDeg={0}
        anchor={{ position: contentAnchor.position, yawDeg: contentAnchor.yawDeg }}
        area={{ width: CONTENT_RECT_PANEL.width, height: CONTENT_RECT_PANEL.height }}
        enabled={bound && !grabbed}
        onSurfaceInput={onSurfaceInput}
      />
    </>
  );
}

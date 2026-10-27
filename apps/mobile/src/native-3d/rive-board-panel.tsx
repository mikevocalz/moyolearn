import type { ReactNode } from 'react';
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
 *   grip ViroQuad            the amber bar. Report-only (`dragTransform=
 *                            "none"`); `useCarrierDrag` writes the carrier
 *                            natively per report and commits on release, so
 *                            a drag re-renders nothing until the hand lets go.
 *
 * THE BOARD MOVES ALONE. Its offset is its own (the kit hook's state), so a
 * grip here never touches a neighbour, and the input plane re-anchors from the
 * committed carrier on the release render.
 *
 * While `grabbed` the surface is disabled (which cancels an in-flight stroke
 * via its own cleanup) and the chrome's input is off — a panel in the hand
 * never draws and a stroke in the hand never moves the panel.
 *
 * SOT: packages/ui/xr/board-chrome-layout.ts · packages/ui/xr/board-chrome-commands.ts ·
 *      packages/ui/xr/XrBoardSurface.native.tsx · ./board-chrome-bind.ts
 * SOT-KEYWORDS: xr rive board chrome panel composition carrier content rect input arbitration live texture grip drag
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ViroMaterials, ViroNode, ViroQuad, ViroRivePanel, ViroText } from '@reactvision/react-viro';
import { worldMatrix, type RivePanel, type RiveCanvasOptions } from 'nitro-canvas-in-Vision';
import {
  CONTENT_BAND,
  CONTENT_RECT_PANEL,
  PANEL_HEIGHT_M,
  PANEL_WIDTH_M,
  XrBoardLive,
  XrBoardSurface,
  ZERO_OFFSET,
  addOffset,
  artboardCenter,
  contentAnchorWorld,
  useCarrierDrag,
  type XrSurfaceInput,
  type XrVector3,
} from '@acme/ui/xr';
import { bindBoardChrome, type BoardChromeHandlers, type BoardChromePresentation } from './board-chrome-bind';
import { NativeRiveChrome, chromeBindings, useNativeRiveEnabled } from './native-rive-chrome';

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
  /** A persisted carrier pose the drag starts from — `null` is identity at
      the slot. The panel's own drag offset is added to it until the caller
      persists the released pose back here. */
  carrier: { position: readonly [number, number, number]; rotation: readonly [number, number, number] } | null;
  /** The caller's own "held" flag, OR-ed with the panel's — gates BOTH input
      paths off. */
  grabbed: boolean;
  /** The live texture is bound — unbound, the window shows the navy tile. */
  bound: boolean;
  /** Panel face opacity 0..1 — multiplies the chrome's translucent fills;
      icons, text and accents stay full-strength. Defaults to authored. */
  opacity?: number;
  enabled?: boolean;
  movable?: boolean;
  content?: ReactNode;
  termination?: { source: number; cancel: boolean; revision: number };
  resetKey?: number;
  /** The carrier pose a drag landed at (`carrier` + the drag), once per
      release that moved. */
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
  /** The Rive runtime is up and bound. */
  onReady?(): void;
}

export function RiveBoardPanel({
  chromeBytes,
  slot,
  carrier,
  grabbed,
  bound,
  opacity = 1,
  enabled = bound,
  movable = true,
  content,
  termination,
  resetKey = 0,
  onCarrierRelease,
  onGrab,
  onSurfaceInput,
  handlers,
  presentation,
  gripWorld,
  onChromeError,
  onReady,
}: RiveBoardPanelProps) {
  /* Round 2 device validation: off unless asked for AND native-panels is linked. */
  const nativeRive = useNativeRiveEnabled();
  const runtime = useRef<RivePanel | null>(null);
  const binding = useRef<ReturnType<typeof bindBoardChrome> | null>(null);
  const owner = useRef<number | null>(null);
  const mounted = useRef(true);
  /* Handlers change every render; the binding is installed once. A ref is the
     established pattern here (`XrBoardSurface.emit`). */
  const dispatch = useRef(handlers);
  const presented = useRef(presentation);
  /* Synced after commit, before the passive effects below read them. */
  useLayoutEffect(() => {
    dispatch.current = handlers;
    presented.current = presentation;
  });

  const base = carrier?.position ?? ZERO_OFFSET;
  const rotation = carrier?.rotation ?? ZERO_OFFSET;
  const carrierDrag = useCarrierDrag({
    base,
    /* A new slot (recenter), a newly persisted carrier or a reset drops the
       panel's own offset — each is a new place to be moved from. */
    resetKey: `${resetKey}|${slot.position.join(',')}|${slot.yaw}|${base.join(',')}`,
    enabled: movable,
    onCommit: (offset) => {
      const landed = addOffset(base, offset);
      onCarrierRelease({ position: [landed[0], landed[1], landed[2]], rotation: [rotation[0], rotation[1], rotation[2]] });
    },
    onGrab: (next) => {
      runtime.current?.setBoolean('grabbed', next);
      if (mounted.current) onGrab(next);
    },
  });
  const held = grabbed || carrierDrag.grabbed;
  const [cx, cy, cz] = carrierDrag.position;
  const carrierPose = useMemo(() => ({
    position: [cx, cy, cz] as const,
    rotation,
  }), [cx, cy, cz, rotation]);

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

  /* Ends the grab from any terminal event; a disconnected controller cannot
     leave the panel permanently grabbed. */
  const finishGrab = () => {
    if (owner.current === null) return;
    owner.current = null;
    carrierDrag.release();
  };

  useEffect(() => {
    mounted.current = true;
    ViroMaterials.createMaterials({
      xrBoardGrip: { diffuseColor: '#ffc168', lightingModel: 'Constant' },
      xrBoardEmpty: { diffuseColor: '#112d44', lightingModel: 'Constant' },
      /* The opaque slab behind the whole face — the chrome's own fills can
         stay translucent without the room ever showing through. */
      xrBoardBacking: { diffuseColor: '#0a1524', lightingModel: 'Constant' },
    });
    return () => {
      mounted.current = false;
      binding.current?.dispose();
      binding.current = null;
      runtime.current = null;
      ViroMaterials.deleteMaterials(['xrBoardGrip', 'xrBoardEmpty', 'xrBoardBacking']);
    };
  }, []);

  /* resetKey (tracking loss / controller reconnect) releases any grab —
     identical latch to the Rive probe's. */
  useEffect(() => { finishGrab(); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Push application state into the view model whenever it moves. The
    panel's `opacity` prop is the one place the face's translucency is set —
    it composes over whatever the caller put in the presentation. */
  const present = (state: BoardChromePresentation) => ({ ...state, uiOpacity: opacity });
  useEffect(() => {
    binding.current?.push(present(presented.current));
  }, [presentation, opacity]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <ViroNode
        ref={(node: ViroNode | null) => carrierDrag.bindNode(node)}
        position={carrierDrag.position}
        rotation={[rotation[0], rotation[1], rotation[2]]}
      >
        <ViroNode position={[slot.position[0], slot.position[1], slot.position[2]]} rotation={[0, slot.yaw, 0]}>
          {/* Full-size opaque backing — the face reads solid whatever
              `uiOpacity` or a translucent fill decides. 1 mm behind so it
              never intersects the chrome's own ray hit region. */}
          <ViroQuad
            position={[0, 0, -0.001]}
            width={PANEL_WIDTH_M}
            height={PANEL_HEIGHT_M}
            materials={['xrBoardBacking']}
            ignoreEventHandling
          />
          {nativeRive ? (
            /* Round 2 `nativeRive`: ViroCore's Rive producer. Draws the chrome
               from `bindings`; its toolbar takes no input (native-rive-chrome.tsx). */
            <NativeRiveChrome
              source={source}
              width={PANEL_WIDTH_M}
              height={PANEL_HEIGHT_M}
              position={[0, 0, 0]}
              resolution={{ width: 2496, height: 1560 }}
              bindings={chromeBindings(present(presentation))}
              onError={(error) => onChromeError?.(`Board controls unavailable: ${error.message}`)}
            />
          ) : (
          <ViroRivePanel
            source={source}
            width={PANEL_WIDTH_M}
            height={PANEL_HEIGHT_M}
            position={[0, 0, 0]}
            /* 2× the artboard — micro-labels stay crisp at arm's length in
               the headset; the quad is 1.2 m wide and text lives at fs9. */
            resolution={{ width: 2496, height: 1560 }}
            input={{ panelWorld, enabled: enabled && !held, resetKey }}
            onError={(error) => onChromeError?.(`Board controls unavailable: ${error.message}`)}
            onRuntimeReady={(rt) => {
              onReady?.();
              runtime.current = rt;
              binding.current?.dispose();
              binding.current = bindBoardChrome(rt, {
                onTool: (t) => { if (__DEV__) console.log('[xr-board] onTool', t); dispatch.current.onTool(t); },
                onInk: (i) => { if (__DEV__) console.log('[xr-board] onInk', i); dispatch.current.onInk(i); },
                onPalette: (o) => { if (__DEV__) console.log('[xr-board] onPalette', o); dispatch.current.onPalette(o); },
                onUndo: () => { if (__DEV__) console.log('[xr-board] onUndo'); dispatch.current.onUndo(); },
                onRedo: () => { if (__DEV__) console.log('[xr-board] onRedo'); dispatch.current.onRedo(); },
                onClear: () => { if (__DEV__) console.log('[xr-board] onClear'); dispatch.current.onClear(); },
                onAsk: () => { if (__DEV__) console.log('[xr-board] onAsk'); dispatch.current.onAsk(); },
              });
              binding.current.push(present(presented.current));
            }}
          />
          )}
          {/*
            The live board texture — `XrBoardLive`, the same quad the media
            panel binds — sits at `boardLayer.raster` (0.5 mm) off this node,
            which puts it in front of the chrome face and behind the pointer
            plane (2 mm). It spans only the transparent window, so toolbar
            chrome shows everywhere else. Unbound: the navy tile the old probe
            drew for the same state.
          */}
          <ViroNode position={[...contentCentre]}>
            {content ?? (bound ? (
              <XrBoardLive width={CONTENT_RECT_PANEL.width} height={CONTENT_RECT_PANEL.height} />
            ) : (
              <ViroQuad
                width={CONTENT_RECT_PANEL.width}
                height={CONTENT_RECT_PANEL.height}
                materials={['xrBoardEmpty']}
                ignoreEventHandling
              />
            ))}
          </ViroNode>
        </ViroNode>
        {/* The grip — carrier child at a world pose, the probe's own trick. */}
        {movable ? <>
        <ViroQuad
          position={[gripWorld.position[0], gripWorld.position[1], gripWorld.position[2]]}
          rotation={[0, gripWorld.yawDeg, 0]}
          width={GRIP_W}
          height={GRIP_H}
          materials={['xrBoardGrip']}
          highAccuracyEvents
          dragType="FixedDistanceOrigin"
          dragTransform="none"
          onDrag={(position: number[]) => { if (owner.current !== null) carrierDrag.drag(position); }}
          onClickState={(state: number, _position: number[], sourceId: number) => {
            /* Any terminal event from the owner ends the grab — not just
               CLICK_UP. If the up is lost (cancel, capture stolen mid-drag)
               and `grabbed` never clears, every `enabled: !grabbed` gate in
               the scene stays shut and the whole board goes silent. */
            if (state === 1) {
              if (owner.current !== null || held) return;
              owner.current = sourceId;
              carrierDrag.grab();
            } else if (owner.current !== null && (state === 2 || state === 3) && sourceId === owner.current) {
              finishGrab();
            }
          }}
        />
        <ViroText
          text={held ? 'Moving board' : 'Hold to move'}
          /* VROTextFormatter's Center places the BASELINE on the node, not the
             optical middle — the label reads high in the pill by ~cap/2. Dropping
             the Y by that amount centres the glyphs, not their line box. */
          position={[
            gripWorld.position[0] + Math.sin((gripWorld.yawDeg * Math.PI) / 180) * 0.012,
            gripWorld.position[1] - 0.025,
            gripWorld.position[2] + Math.cos((gripWorld.yawDeg * Math.PI) / 180) * 0.012,
          ]}
          rotation={[0, gripWorld.yawDeg, 0]}
          width={3.36}
          height={0.5}
          scale={[0.25, 0.25, 0.25]}
          maxLines={1}
          textClipMode="ClipToBounds"
          ignoreEventHandling
          style={{ fontSize: 28, color: '#112d44', textAlign: 'center', textAlignVertical: 'center' }}
        />
        </> : null}
      </ViroNode>
      {/*
        THE INPUT PLANE IS A SIBLING, WORLD-ANCHORED. It is invisible, so it
        does not need to ride the carrier; it needs the anchor recomputed when
        the carrier lands — which `contentAnchor` does from the committed
        pose on the release render. While grabbed it is unmounted entirely (`enabled`), which is also
        the stroke-cancel path: a panel in motion cannot carry a stroke.
      */}
      <XrBoardSurface
        headPosition={[0, 0, 0]}
        headYawDeg={0}
        anchor={{ position: contentAnchor.position, yawDeg: contentAnchor.yawDeg }}
        area={{ width: CONTENT_RECT_PANEL.width, height: CONTENT_RECT_PANEL.height }}
        enabled={enabled && !held}
        termination={termination}
        onSurfaceInput={onSurfaceInput}
      />
    </>
  );
}

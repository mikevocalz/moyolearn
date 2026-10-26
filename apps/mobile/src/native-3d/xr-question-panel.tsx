/**
 * The Rive-framed learning question — ONE spatial object: `LearningQuestion`
 * chrome (header, choice rail, footer controls, loader) wrapped around a
 * hosted content window, inside the carrier that drags.
 *
 * THE COMPOSITION — `rive-board-panel`'s, with a different centre:
 *
 *   carrier ViroNode (the dragged object; persisted offset)
 *     └─ slot ViroNode (world slot pose, as a child of the carrier)
 *         ├─ ViroRivePanel   LearningQuestion/QuestionFlow — the whole panel
 *         │                  face. Its own native input maps rays to the
 *         │                  artboard listeners; the command channel reaches
 *         │                  `bindQuestionChrome`.
 *         └─ ViroQuad        XR_MATERIAL.questionLive at QUESTION_CONTENT_BAND —
 *                            the hosted `XrQuestionContent` surface visible
 *                            through the chrome's transparent hole. Unbound,
 *                            the window shows the navy tile instead of void.
 *   grip ViroQuad            the amber bar, report-only; `useCarrierDrag`
 *                            moves the carrier natively and commits on
 *                            release. The panel moves alone.
 *
 * Content interaction does NOT come through a second input plane here —
 * the spec's answer surface is the Rive rail (bounded choices) and the
 * footer verbs; rich block input (diagram labels, ordering) resolves
 * semantically in the hosted page, driven by the flow store, not by rays.
 *
 * SOT: packages/ui/xr/question-chrome-layout.ts · packages/ui/xr/question-commands.ts ·
 *      ./question-chrome-bind.ts · ./rive-board-panel.tsx
 * SOT-KEYWORDS: xr rive question panel composition carrier content window learning question grip drag
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { ViroMaterials, ViroNode, ViroQuad, ViroRivePanel, ViroText } from '@reactvision/react-viro';
import { worldMatrix, type RivePanel, type RiveCanvasOptions } from 'nitro-canvas-in-Vision';
import {
  QUESTION_CONTENT_BAND,
  QUESTION_CONTENT_RECT_PANEL,
  QUESTION_PANEL_HEIGHT_M,
  QUESTION_PANEL_WIDTH_M,
  ZERO_OFFSET,
  addOffset,
  questionArtboardCenter,
  useCarrierDrag,
  type XrVector3,
} from '@acme/ui/xr';
import { bindQuestionChrome, type QuestionChromeHandlers, type QuestionChromePresentation } from './question-chrome-bind';

const GRIP_W = 0.65;
const GRIP_H = 0.09;

const contentCentre = questionArtboardCenter(QUESTION_CONTENT_BAND);

export interface XrQuestionPanelProps {
  /** Compiled `moyo_learning_question.riv` bytes. */
  chromeBytes: ArrayBuffer;
  slot: { position: readonly [number, number, number]; yaw: number };
  /** The carrier's persisted drag pose — `null` is identity at the slot. */
  carrier: { position: readonly [number, number, number]; rotation: readonly [number, number, number] } | null;
  grabbed: boolean;
  /** The hosted content texture bound — unbound shows the navy tile. */
  bound: boolean;
  /** Panel face opacity 0..1 — the chrome's art stays full-strength. */
  opacity?: number;
  enabled?: boolean;
  movable?: boolean;
  content?: React.ReactNode;
  resetKey?: number;
  onCarrierRelease(pose: { position: [number, number, number]; rotation: [number, number, number] }): void;
  onGrab(grabbed: boolean): void;
  handlers: QuestionChromeHandlers;
  presentation: QuestionChromePresentation;
  gripWorld: { position: XrVector3; yawDeg: number };
  onChromeError?(message: string): void;
  /** The Rive runtime is up and bound. */
  onReady?(): void;
}

export function XrQuestionPanel({
  chromeBytes,
  slot,
  carrier,
  grabbed,
  bound,
  opacity = 1,
  enabled = true,
  movable = true,
  content,
  resetKey = 0,
  onCarrierRelease,
  onGrab,
  handlers,
  presentation,
  gripWorld,
  onChromeError,
  onReady,
}: XrQuestionPanelProps) {
  const runtime = useRef<RivePanel | null>(null);
  const binding = useRef<ReturnType<typeof bindQuestionChrome> | null>(null);
  const owner = useRef<number | null>(null);
  const mounted = useRef(true);
  /* Handlers/presentation change every render; the binding installs once. */
  const dispatch = useRef(handlers);
  const presented = useRef(presentation);
  dispatch.current = handlers;
  presented.current = presentation;

  const base = carrier?.position ?? ZERO_OFFSET;
  const rotation = carrier?.rotation ?? ZERO_OFFSET;
  const carrierDrag = useCarrierDrag({
    base,
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
  /* `panelWorld` follows the COMMITTED carrier: stale while the panel is in
     the hand, which is safe because its input is off until the release render. */
  const carrierPose = useMemo(() => ({
    position: [cx, cy, cz] as const,
    rotation,
  }), [cx, cy, cz, rotation]);

  const panelWorld = useMemo(
    () =>
      worldMatrix([
        { position: carrierPose.position, rotation: carrierPose.rotation },
        { position: slot.position, rotation: [0, slot.yaw, 0] },
      ]),
    [carrierPose, slot],
  );

  const source = useMemo<RiveCanvasOptions>(
    () => ({ rivBytes: chromeBytes, artboard: 'LearningQuestion', stateMachine: 'QuestionFlow', fit: 'contain' }),
    [chromeBytes],
  );

  /* A lost controller must release the input gate. */
  const finishGrab = () => {
    if (owner.current === null) return;
    owner.current = null;
    carrierDrag.release();
  };

  useEffect(() => {
    mounted.current = true;
    ViroMaterials.createMaterials({
      xrQuestionGrip: { diffuseColor: '#ffc168', lightingModel: 'Constant' },
      xrQuestionEmpty: { diffuseColor: '#112d44', lightingModel: 'Constant' },
      /* The opaque slab behind the whole face — the chrome's own fills can
         stay translucent without the room ever showing through. */
      xrQuestionBacking: { diffuseColor: '#0a1524', lightingModel: 'Constant' },
    });
    return () => {
      mounted.current = false;
      binding.current?.dispose();
      binding.current = null;
      runtime.current = null;
      ViroMaterials.deleteMaterials(['xrQuestionGrip', 'xrQuestionEmpty', 'xrQuestionBacking']);
    };
  }, []);

  useEffect(() => { finishGrab(); }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The `opacity` prop is the one place face translucency is set — it
     composes over whatever the caller put in the presentation, exactly the
     board panel's rule. */
  const present = (state: QuestionChromePresentation) => ({ ...state, uiOpacity: opacity });
  useEffect(() => {
    binding.current?.push(present(presented.current));
  }, [presentation, opacity]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
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
          width={QUESTION_PANEL_WIDTH_M}
          height={QUESTION_PANEL_HEIGHT_M}
          materials={['xrQuestionBacking']}
          ignoreEventHandling
        />
        <ViroRivePanel
          source={source}
          width={QUESTION_PANEL_WIDTH_M}
          height={QUESTION_PANEL_HEIGHT_M}
          position={[0, 0, 0]}
          /* 2× the artboard — the header micro-labels survive headset optics. */
          resolution={{ width: 2560, height: 1600 }}
          input={{ panelWorld, enabled: enabled && !held, resetKey }}
          onError={(error) => onChromeError?.(`Question controls unavailable: ${error.message}`)}
          onRuntimeReady={(rt) => {
            onReady?.();
            runtime.current = rt;
            binding.current?.dispose();
            binding.current = bindQuestionChrome(rt, {
              onSelectChoice: (...a: never[]) => { if (__DEV__) console.log('[xr-q] onSelectChoice'); return (dispatch.current.onSelectChoice as (...x: never[]) => void)(...a); },
              onToggleChoice: (...a: never[]) => { if (__DEV__) console.log('[xr-q] onToggleChoice'); return (dispatch.current.onToggleChoice as (...x: never[]) => void)(...a); },
              onSubmit: (...a: never[]) => { if (__DEV__) console.log('[xr-q] onSubmit'); return (dispatch.current.onSubmit as (...x: never[]) => void)(...a); },
              onNext: (...a: never[]) => { if (__DEV__) console.log('[xr-q] onNext'); return (dispatch.current.onNext as (...x: never[]) => void)(...a); },
              onHint: (...a: never[]) => { if (__DEV__) console.log('[xr-q] onHint'); return (dispatch.current.onHint as (...x: never[]) => void)(...a); },
              onVoice: (...a: never[]) => { if (__DEV__) console.log('[xr-q] onVoice'); return (dispatch.current.onVoice as (...x: never[]) => void)(...a); },
              onBoard: (...a: never[]) => { if (__DEV__) console.log('[xr-q] onBoard'); return (dispatch.current.onBoard as (...x: never[]) => void)(...a); },
              onRetry: (...a: never[]) => { if (__DEV__) console.log('[xr-q] onRetry'); return (dispatch.current.onRetry as (...x: never[]) => void)(...a); },
              onSkip: (...a: never[]) => { if (__DEV__) console.log('[xr-q] onSkip'); return (dispatch.current.onSkip as (...x: never[]) => void)(...a); },
            });
            binding.current.push(present(presented.current));
          }}
        />
        {/* The hosted content window — the questionLive texture must sit
            in FRONT of the chrome face: at the chrome's own z it shares a
            plane with the artboard surface and the two z-fight, which is
            what the "text fading in and out" was. */}
        <ViroNode position={[contentCentre[0], contentCentre[1], 0.002]}>
          {content ?? <ViroQuad
            width={QUESTION_CONTENT_RECT_PANEL.width}
            height={QUESTION_CONTENT_RECT_PANEL.height}
            materials={[bound ? 'moyoQuestionLive' : 'xrQuestionEmpty']}
            ignoreEventHandling
          />}
        </ViroNode>
      </ViroNode>
      {movable ? <>
      <ViroQuad
        position={[gripWorld.position[0], gripWorld.position[1], gripWorld.position[2]]}
        rotation={[0, gripWorld.yawDeg, 0]}
        width={GRIP_W}
        height={GRIP_H}
        materials={['xrQuestionGrip']}
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
        text={held ? 'Moving panel' : 'Hold to move'}
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
  );
}

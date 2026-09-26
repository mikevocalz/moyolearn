/**
 * Engineering route: moyo://xr-question-probe.
 *
 * The dynamic question panel end-to-end on the fixture sequence —
 * `LearningQuestion` chrome at the centre slot, `XrQuestionContent` hosted
 * into `questionLive` through the same `BoardTextureHost` path that
 * carries the Quickdraw board. Placement waits for a settled head — the
 * same rule `xr-layout-probe` already proved on hardware.
 *
 * The hosted page is parked off-screen rather than hidden — a `display:
 * none` tears the surface down and restarts it; moved aside it survives.
 * Deep-linked and nothing else.
 * SOT: apps/mobile/src/native-3d/xr-question-probe.tsx ·
 *      packages/ui/xr/question-chrome-layout.ts
 * SOT-KEYWORDS: xr question probe route deep link hosted content questionlive settled pose floor origin
 */
import React, { useEffect, useMemo } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import {
  ViroARScene,
  ViroAmbientLight,
  ViroController,
  ViroDirectionalLight,
  ViroXRSceneNavigator,
} from '@reactvision/react-viro';
import {
  BoardTextureHost,
  QUESTION_CONTENT_BAND,
  XR_MATERIAL,
  XrQuestionContent,
  questionSurfacePixels,
  resolveQuestionLayout,
  spatialSpacing,
} from '@acme/ui/xr';
import { useXrQuestionFlow } from '@acme/app/features/tutor/xr-question.store.ts';
import { XrQuestionProbe, xrQuestionProbe } from '../src/native-3d/xr-question-probe';

interface Placed {
  head: readonly [number, number, number];
  yawDeg: number;
}

const SETTLE_MS = 350;
const SETTLE_TRAVEL_M = 0.2;
const SETTLE_TURN_DOT = 0.9;

function Scene({ bytes }: { bytes: ArrayBuffer }) {
  const store = useMemo(() => createStore(() => ({ placed: null as Placed | null, reset: 0 })), []);
  const samples = React.useRef<{ pos: [number, number, number]; fwd: [number, number, number]; t: number }[]>([]);
  const latched = React.useRef(false);
  const placed = useStore(store, (state) => state.placed);
  const reset = useStore(store, (state) => state.reset);
  return (
    <ViroARScene
      onCameraTransformUpdate={
        placed
          ? undefined
          : (camera) => {
              if (latched.current) return;
              const [x, y, z] = camera.position;
              const [fx, fy, fz] = camera.forward;
              const length = Math.hypot(fx, fz);
              if (![x, y, z, fx, fy, fz].every(Number.isFinite) || length < 0.1) return;
              const now = Date.now();
              const last = samples.current[samples.current.length - 1];
              if (last !== undefined && now - last.t < SETTLE_MS) return;
              const current = { pos: [x, y, z] as [number, number, number], fwd: [fx, fy, fz] as [number, number, number], t: now };
              if (last !== undefined) {
                const travel = Math.hypot(x - last.pos[0], y - last.pos[1], z - last.pos[2]);
                const turn = last.fwd[0] * fx + last.fwd[1] * fy + last.fwd[2] * fz;
                if (travel < SETTLE_TRAVEL_M && turn > SETTLE_TURN_DOT) {
                  latched.current = true;
                  const yawDeg2 = (Math.atan2(-fx, -fz) * 180) / Math.PI;
                  store.setState({ placed: { head: [x, y, z], yawDeg: yawDeg2 } });
                  if (__DEV__) console.log('[xr-question-probe] placing from settled pose', current.pos);
                  return;
                }
              }
              samples.current.push(current);
            }
      }
    >
      <ViroAmbientLight color="#ffffff" intensity={600} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.5]} intensity={800} />
      <ViroController
        controllerVisibility
        reticleVisibility
        onControllerStatus={(status: number) => {
          if (status === 4 || status === 5) store.setState((state) => ({ reset: state.reset + 1 }));
        }}
      />
      {placed && <XrQuestionProbe head={placed.head} yawDeg={placed.yawDeg} resetKey={reset} />}
    </ViroARScene>
  );
}

export default function XrQuestionProbeRoute() {
  const store = useMemo(
    () => createStore(() => ({ bytes: null as ArrayBuffer | null, error: null as string | null })),
    [],
  );
  const bytes = useStore(store, (state) => state.bytes);
  const error = useStore(store, (state) => state.error);
  const bound = useStore(xrQuestionProbe, (s) => s.bound);

  /* The flow store feeds BOTH sides: the chrome's presentation in the
     scene, and this hosted surface — one question, two renderers. */
  const current = useStore(useXrQuestionFlow, (s) => s.current);

  const layout = useMemo(
    () =>
      current
        ? resolveQuestionLayout(current.content, current.interaction, current.choices?.length ?? 0, {
            width: QUESTION_CONTENT_BAND.w,
            height: QUESTION_CONTENT_BAND.h,
          })
        : null,
    [current],
  );

  useEffect(() => {
    let alive = true;
    void (async () => {
      const asset = Asset.fromModule(require('../assets/rive/moyo_learning_question.riv'));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('The question chrome file was not downloaded');
      const data = await new File(asset.localUri).arrayBuffer();
      if (alive) xrQuestionProbe.setState({ chromeBytes: data });
    })().catch((reason) => {
      if (__DEV__) console.warn('[xr-question-probe] chrome asset unavailable:', reason);
      if (alive) store.setState({ error: String(reason) });
    });
    return () => {
      alive = false;
    };
  }, []);

  const initialScene = useMemo(
    () => ({ scene: () => (bytes ? <Scene bytes={bytes} /> : <ViroARScene />) }),
    [bytes],
  );

  if (Platform.OS !== 'android' || error) {
    return (
      <View style={{ flex: 1, padding: 32, backgroundColor: '#112d44' }}>
        <Text style={{ color: '#ffffff', fontSize: 22 }}>
          {Platform.OS !== 'android' ? 'This probe uses the Android native surfaces.' : error}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ViroXRSceneNavigator
        initialScene={initialScene}
        viroAppProps={{}}
        trackingOrigin="floor"
        style={{ flex: 1 }}
      />
      {/*
        THE QUESTION SURFACE — a parked RN view re-parented into the
        `questionLive` texture, exactly the board's construction with a
        different page. `live` gates on the scene having a place to draw.
      */}
      <BoardTextureHost
        style={styles.surface}
        material={XR_MATERIAL.questionLive}
        pageWidth={questionSurfacePixels.width}
        pageHeight={questionSurfacePixels.height}
        live={current !== null}
        onBound={(binding) => {
          if (__DEV__) console.log('[xr-question-probe] content binding', binding);
          xrQuestionProbe.setState({ bound: binding.bound, boundReason: binding.reason });
        }}
      >
        {current && layout ? (
          <XrQuestionContent
            question={current}
            layout={layout}
            /* Swap is atomic at the question id — `commitNext` only fires
               at the hidden midpoint, so a remount never shows. */
            key={current.id}
          />
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </BoardTextureHost>
      {!bound && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
          <Text style={{ color: '#ffffff' }}>Binding question surface…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /* Parked, not hidden — same reason the board's engine is parked. */
  surface: {
    position: 'absolute',
    left: -questionSurfacePixels.width - spatialSpacing.md,
    top: 0,
    width: questionSurfacePixels.width,
    height: questionSurfacePixels.height,
    opacity: 0,
  },
});

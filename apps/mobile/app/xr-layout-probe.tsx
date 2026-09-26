/**
 * Engineering route: moyo://xr-layout-probe.
 *
 * The layouts API (`worldSlot`/`SLOTS`) populated end-to-end: Rive panel on the
 * left slot, live digital board on centre (engine bound to `boardLive`), drag
 * grip + control tray under it, Natalie on the right with her feet at y = 0.
 *
 * PLACEMENT WAITS FOR A SETTLED HEAD, NOT A CREDIBLE ONE — the lesson the
 * tutor screen already learned on hardware: the first pose a session reports
 * can arrive while the headset is still in someone's hands, and latching it
 * parks the whole composition at whatever height that happened to be (measured
 * on PICO at y = 0.90 m — three floor-level sessions in a row). A worn head
 * differs from a handled one in exactly one observable: it holds still. So the
 * route samples the camera transform ~400 ms apart and places when two
 * consecutive samples agree — under 20 cm of travel and under ~25° of turn —
 * which is `tutor-xr-screen`'s own settle rule mirrored, not invented.
 *
 * `trackingOrigin="floor"` is asked for explicitly so y = 0 is the physical
 * floor — Natalie's feet and the head's real height both depend on it.
 *
 * Deep-linked and nothing else — no tab, no link, no menu item.
 * SOT: apps/mobile/src/native-3d/xr-layout-probe.tsx
 * SOT-KEYWORDS: xr layout probe route deep link three panel arc natalie board settled pose floor origin
 */
import React, { useEffect, useMemo, useRef } from 'react';
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
  XR_MATERIAL,
  boardSurfacePixels,
  spatialSpacing,
} from '@acme/ui/xr';
import { WhiteboardBoard } from '@acme/ui';
import { useTutorStore } from '@acme/app/features/tutor/tutor.store.ts';
import { XrLayoutProbe, xrLayoutEngine, xrLayoutProbe } from '../src/native-3d/xr-layout-probe';

interface Placed {
  head: readonly [number, number, number];
  yawDeg: number;
}

/* Two camera samples this far apart are "settled" under the tutor screen's own
   rule: < 0.2 m of travel and a forward dot > 0.9 between them. */
const SETTLE_MS = 350;
const SETTLE_TRAVEL_M = 0.2;
const SETTLE_TURN_DOT = 0.9;

function Scene({ bytes, chromeBytes }: { bytes: ArrayBuffer; chromeBytes: ArrayBuffer | null }) {
  const store = useMemo(() => createStore(() => ({ placed: null as Placed | null, reset: 0 })), []);
  const samples = useRef<{ pos: [number, number, number]; fwd: [number, number, number]; t: number }[]>([]);
  const latched = useRef(false);
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
                const turn =
                  last.fwd[0] * fx + last.fwd[1] * fy + last.fwd[2] * fz;
                if (travel < SETTLE_TRAVEL_M && turn > SETTLE_TURN_DOT) {
                  latched.current = true;
                  /* Same facing convention as placeInFrontOf: atan2(-fx, -fz). */
                  const placedPose: Placed = { head: [x, y, z], yawDeg: (Math.atan2(-fx, -fz) * 180) / Math.PI };
                  store.setState({ placed: placedPose });
                  xrLayoutProbe.setState({ placed: { head: [x, y, z], yawDeg: placedPose.yawDeg } });
                  if (__DEV__) console.log('[xr-layout-probe] placing from settled pose', current.pos);
                  return;
                }
              }
              samples.current.push(current);
            }
      }
    >
      {/* Same rig the tutor screen lights her with — without it the GLB is black. */}
      <ViroAmbientLight color="#ffffff" intensity={600} />
      <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.5]} intensity={800} />
      <ViroController
        controllerVisibility
        reticleVisibility
        onControllerStatus={(status: number) => {
          if (status === 4 || status === 5) store.setState((state) => ({ reset: state.reset + 1 }));
        }}
      />
      {placed && (
        <XrLayoutProbe bytes={bytes} chromeBytes={chromeBytes} head={placed.head} yawDeg={placed.yawDeg} resetKey={reset} />
      )}
    </ViroARScene>
  );
}

export default function XrLayoutProbeRoute() {
  const store = useMemo(
    () =>
      createStore(() => ({
        bytes: null as ArrayBuffer | null,
        chromeBytes: null as ArrayBuffer | null,
        error: null as string | null,
      })),
    [],
  );
  const bytes = useStore(store, (state) => state.bytes);
  const chromeBytes = useStore(store, (state) => state.chromeBytes);
  const error = useStore(store, (state) => state.error);
  const engineReady = useStore(xrLayoutProbe, (s) => s.engineReady);
  const bound = useStore(xrLayoutProbe, (s) => s.bound);
  const placed = useStore(xrLayoutProbe, (s) => s.placed);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const asset = Asset.fromModule(require('../assets/rive/moyo_fractions.riv'));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('The lesson file was not downloaded');
      const data = await new File(asset.localUri).arrayBuffer();
      if (alive) store.setState({ bytes: data });
    })().catch((reason) => {
      if (alive) store.setState({ error: String(reason) });
    });
    /*
      The chrome asset is OPTIONAL — a missing or stale build must not gate the
      board. Its absence selects the media-panel + tray composition, which is
      the fallback the scene already keeps.
    */
    void (async () => {
      const asset = Asset.fromModule(require('../assets/rive/moyo_board_chrome.riv'));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('The chrome file was not downloaded');
      const data = await new File(asset.localUri).arrayBuffer();
      if (alive) store.setState({ chromeBytes: data });
    })().catch((reason) => {
      if (__DEV__) console.warn('[xr-layout-probe] board chrome asset unavailable:', reason);
      if (alive) xrLayoutProbe.setState({ chromeFailed: true });
    });
    return () => {
      alive = false;
    };
  }, []);

  /*
    SHE SPEAKS THROUGH THE COACH STREAM, the only path that carries a voice
    tag: `coach` posts the turn, the SSE frames enqueue tagged audio on
    `audioQueue`, and `XrNatalie` samples it for speech and face. Fired once
    the board is bound — the first thing she says arrives with the first thing
    the board shows. It needs a signed-in session; on the engineering route a
    failed call is silent rather than a surface.
  */
  useEffect(() => {
    if (!bound || xrLayoutProbe.getState().greeted) return;
    xrLayoutProbe.setState({ greeted: true });
    void useTutorStore
      .getState()
      .coach('Say hello to the learner and tell them the digital board is ready for them to draw on.')
      .catch(() => undefined);
  }, [bound]);

  const initialScene = useMemo(
    () => ({ scene: () => (bytes ? <Scene bytes={bytes} chromeBytes={chromeBytes} /> : <ViroARScene />) }),
    [bytes, chromeBytes],
  );

  if (Platform.OS !== 'android' || error || !bytes) {
    return (
      <View style={{ flex: 1, padding: 32, backgroundColor: '#112d44' }}>
        <Text style={{ color: '#ffffff', fontSize: 22 }}>
          {Platform.OS !== 'android' ? 'This probe uses the Android native surfaces.' : error ?? 'Loading layout…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ViroXRSceneNavigator
        initialScene={initialScene}
        viroAppProps={{ bytes }}
        /* y = 0 is the physical floor — her feet, and the settle guard, need it. */
        trackingOrigin="floor"
        style={{ flex: 1 }}
      />
      {/*
        THE HOST IS WHERE THE RENDERER REACHES THE ENGINE — the same parked
        construction the tutor screen keeps: a plain View until
        `MoyoBoardTexture` binds, at which point the page is re-parented into
        the texture the `boardLive` material draws from, without reloading or
        dropping a stroke in progress.
      */}
      <BoardTextureHost
        style={styles.engine}
        material={XR_MATERIAL.boardLive}
        pageWidth={boardSurfacePixels.width}
        pageHeight={boardSurfacePixels.height}
        /* A bind attempt needs the renderer alive: `placed` is the flag that
           proves the scene is running, not just the navigator mounted — an
           early `live` binds against nothing and `onBound` fires once per
           attempt. */
        live={engineReady && placed !== null}
        onBound={(binding) =>
          xrLayoutProbe.setState({ bound: binding.bound, boundReason: binding.reason })
        }
      >
        <WhiteboardBoard
          ref={(handle) => {
            xrLayoutEngine.current = handle;
          }}
          onReady={() => xrLayoutProbe.setState({ engineReady: true })}
          onHistory={(history) =>
            xrLayoutProbe.setState({
              canUndo: history.canUndo,
              canRedo: history.canRedo,
              hasMarks: history.marks > 0,
            })
          }
          onCalibration={(result) => {
            if (__DEV__) console.log('[xr-layout-probe] calibration', result);
          }}
        />
      </BoardTextureHost>
    </View>
  );
}


const styles = StyleSheet.create({
  /* Parked, not hidden — `display: none` tears the WebView's surface down and
     the engine restarts; moved aside it keeps its editor and its camera. The
     units are deliberately mixed the way the tutor screen mixes them: the
     pixel size parks it past the screen's edge, the metre token is a fraction
     of a dp and only ever nudges it further out. */
  engine: {
    position: 'absolute',
    left: -boardSurfacePixels.width - spatialSpacing.md,
    top: 0,
    width: boardSurfacePixels.width,
    height: boardSurfacePixels.height,
    opacity: 0,
  },
});

/**
 * Engineering route: moyo://xr-layout-probe.
 *
 * The layouts API (`worldSlot`/`SLOTS`) populated end-to-end: Rive panel on the
 * left slot, digital board on centre, Natalie on the right — each placed from
 * the first credible head pose, exactly like `rive-panel-probe`.
 *
 * Deep-linked and nothing else — no tab, no link, no menu item.
 * SOT: apps/mobile/src/native-3d/xr-layout-probe.tsx
 * SOT-KEYWORDS: xr layout probe route deep link three panel arc natalie board
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { Platform, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { ViroARScene, ViroAmbientLight, ViroController, ViroDirectionalLight, ViroXRSceneNavigator } from '@reactvision/react-viro';
import { XrLayoutProbe } from '../src/native-3d/xr-layout-probe';

interface Placed {
  head: readonly [number, number, number];
  yawDeg: number;
}

function Scene({ bytes }: { bytes: ArrayBuffer }) {
  const store = useMemo(() => createStore(() => ({ placed: null as Placed | null, reset: 0 })), []);
  const latched = useRef(false);
  const placed = useStore(store, state => state.placed);
  const reset = useStore(store, state => state.reset);
  return <ViroARScene onCameraTransformUpdate={placed ? undefined : camera => {
    if (latched.current) return;
    const [x, y, z] = camera.position;
    const [fx, , fz] = camera.forward;
    const length = Math.hypot(fx, fz);
    if (![x, y, z, fx, fz].every(Number.isFinite) || length < 0.1) return;
    latched.current = true;
    /* Same facing convention as placeInFrontOf: atan2(-fx, -fz). */
    store.setState({ placed: { head: [x, y, z], yawDeg: Math.atan2(-fx, -fz) * 180 / Math.PI } });
  }}>
    {/* Same rig the tutor screen lights her with — without it the GLB is black. */}
    <ViroAmbientLight color="#ffffff" intensity={600} />
    <ViroDirectionalLight color="#ffffff" direction={[0, -1, -0.5]} intensity={800} />
    <ViroController controllerVisibility reticleVisibility
      onControllerStatus={(status: number) => { if (status === 4 || status === 5) store.setState(state => ({ reset: state.reset + 1 })); }} />
    {placed && <XrLayoutProbe bytes={bytes} head={placed.head} yawDeg={placed.yawDeg} resetKey={reset} />}
  </ViroARScene>;
}

export default function XrLayoutProbeRoute() {
  const store = useMemo(() => createStore(() => ({ bytes: null as ArrayBuffer | null, error: null as string | null })), []);
  const bytes = useStore(store, state => state.bytes);
  const error = useStore(store, state => state.error);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const asset = Asset.fromModule(require('../assets/rive/moyo_fractions.riv'));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('The lesson file was not downloaded');
      const data = await new File(asset.localUri).arrayBuffer();
      if (alive) store.setState({ bytes: data });
    })().catch(reason => { if (alive) store.setState({ error: String(reason) }); });
    return () => { alive = false; };
  }, []);
  const initialScene = useMemo(() => ({ scene: () => bytes ? <Scene bytes={bytes} /> : <ViroARScene /> }), [bytes]);
  if (Platform.OS !== 'android' || error || !bytes) return <View style={{ flex: 1, padding: 32, backgroundColor: '#112d44' }}>
    <Text style={{ color: '#ffffff', fontSize: 22 }}>{Platform.OS !== 'android'
      ? 'This probe uses the Android native surfaces.' : error ?? 'Loading layout…'}</Text>
  </View>;
  return <ViroXRSceneNavigator initialScene={initialScene} viroAppProps={{ bytes }} style={{ flex: 1 }} />;
}

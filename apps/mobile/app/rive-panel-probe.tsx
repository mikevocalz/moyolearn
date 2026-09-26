/** Engineering route: moyo://rive-panel-probe. Device evidence is recorded separately. */
import React, { useEffect, useMemo, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { Platform, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { ViroARScene, ViroController, ViroXRSceneNavigator } from '@reactvision/react-viro';
import { RivePanelProbe, type PanelPose } from '../src/native-3d/rive-panel-probe';

function Scene({ bytes }: { bytes: ArrayBuffer }) {
  const store = useMemo(() => createStore(() => ({ reset: 0, initialPose: null as PanelPose | null })), []);
  const reset = useStore(store, state => state.reset);
  const placed = useRef(false);
  const initialPose = useStore(store, state => state.initialPose);
  return <ViroARScene onCameraTransformUpdate={initialPose ? undefined : camera => {
    if (placed.current) return;
    const [x, y, z] = camera.position;
    const [fx, , fz] = camera.forward;
    const length = Math.hypot(fx, fz);
    if (![x, y, z, fx, fz].every(Number.isFinite) || length < 0.1) return;
    placed.current = true;
    // Place once relative to the viewer, then let the grip own world movement.
    store.setState({ initialPose: {
      position: [x + 1.8 * fx / length, y - 0.2, z + 1.8 * fz / length],
      rotation: [0, Math.atan2(-fx, -fz) * 180 / Math.PI, 0],
    } });
  }}>
    <ViroController controllerVisibility reticleVisibility
      onControllerStatus={(status: number) => { if (status === 4 || status === 5) store.setState(state => ({ reset: state.reset + 1 })); }} />
    {initialPose && <RivePanelProbe bytes={bytes} initialPose={initialPose} resetKey={reset} />}
  </ViroARScene>;
}
export default function RivePanelProbeRoute() {
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
      ? 'This probe uses the Android native Rive surface.' : error ?? 'Loading lesson…'}</Text>
  </View>;
  return <ViroXRSceneNavigator initialScene={initialScene} viroAppProps={{ bytes }} style={{ flex: 1 }} />;
}

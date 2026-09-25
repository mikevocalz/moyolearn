/** Engineering route: moyo://rive-panel-probe. Device evidence is recorded separately. */
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { ViroARScene, ViroController, ViroXRSceneNavigator } from '@reactvision/react-viro';
import { RivePanelProbe } from '../src/native-3d/rive-panel-probe';

function Scene({ bytes }: { bytes: ArrayBuffer }) {
  const [reset, setReset] = useState(0);
  return <ViroARScene>
    <ViroController controllerVisibility reticleVisibility
      onControllerStatus={(status: number) => { if (status === 4 || status === 5) setReset(n => n + 1); }} />
    <RivePanelProbe bytes={bytes} resetKey={reset} />
  </ViroARScene>;
}
export default function RivePanelProbeRoute() {
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const asset = Asset.fromModule(require('../assets/rive/moyo_fractions.riv'));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('The lesson file was not downloaded');
      const data = await new File(asset.localUri).arrayBuffer();
      if (alive) setBytes(data);
    })().catch(reason => { if (alive) setError(String(reason)); });
    return () => { alive = false; };
  }, []);
  const initialScene = useMemo(() => ({ scene: () => bytes ? <Scene bytes={bytes} /> : <ViroARScene /> }), [bytes]);
  if (Platform.OS !== 'android' || error || !bytes) return <View style={{ flex: 1, padding: 32, backgroundColor: '#112d44' }}>
    <Text style={{ color: '#ffffff', fontSize: 22 }}>{Platform.OS !== 'android'
      ? 'This probe uses the Android native Rive surface.' : error ?? 'Loading lesson…'}</Text>
  </View>;
  return <ViroXRSceneNavigator initialScene={initialScene} viroAppProps={{ bytes }} style={{ flex: 1 }} />;
}

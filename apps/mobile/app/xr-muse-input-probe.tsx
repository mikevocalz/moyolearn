import { useEffect, useMemo, useRef } from 'react';
import { Redirect, useRouter } from 'expo-router';
import { Platform, View, Text } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  ViroAmbientLight, ViroController, ViroMaterials, ViroNode, ViroQuad,
  ViroScene, ViroText, ViroXRSceneNavigator,
} from '@reactvision/react-viro';

function GenericInputScene() {
  const state = useMemo(() => createStore(() => ({
    statusEvents: 0, controllerEvents: 0, targetEvents: 0, last: 'No generic controller events received.',
    targetPosition: [0, 0, -1.5] as [number, number, number],
    targetRotation: [0, 0, 0] as [number, number, number],
  })), []);
  const statusEvents = useStore(state, (s) => s.statusEvents);
  const controllerEvents = useStore(state, (s) => s.controllerEvents);
  const targetEvents = useStore(state, (s) => s.targetEvents);
  const last = useStore(state, (s) => s.last);
  const targetPosition = useStore(state, (s) => s.targetPosition);
  const targetRotation = useStore(state, (s) => s.targetRotation);
  const cameraSeen = useRef(false);
  const record = (kind: 'status' | 'controller-click-state' | 'controller-click' | 'target-click-state' | 'target-click', fields: object) => {
    const event = { kind, wallTimeMs: Date.now(), monotonicMs: performance.now(), ...fields };
    console.log('[MUSE-XR-PROBE]', JSON.stringify(event));
    state.setState((s) => ({
      statusEvents: s.statusEvents + (kind === 'status' ? 1 : 0),
      controllerEvents: s.controllerEvents + (kind.startsWith('controller-') ? 1 : 0),
      targetEvents: s.targetEvents + (kind.startsWith('target-') ? 1 : 0),
      last: JSON.stringify(event),
    }));
  };
  useEffect(() => {
    console.log('[MUSE-XR-PROBE]', JSON.stringify({ kind: 'scene-mounted', wallTimeMs: Date.now(), trackingOrigin: 'eye', target: [0, 0, -1.5] }));
    ViroMaterials.createMaterials({ moyo_muse_generic_probe_target: { diffuseColor: '#E8F07A', lightingModel: 'Constant' } });
    return () => console.log('[MUSE-XR-PROBE]', JSON.stringify({ kind: 'scene-unmounted', wallTimeMs: Date.now() }));
  }, []);
  return (
    <ViroScene onCameraTransformUpdate={(camera) => {
      if (cameraSeen.current) return;
      const { position, forward, rotation } = camera.cameraTransform;
      if (![...position, ...forward, ...rotation].every(Number.isFinite)) return;
      const forwardLength = Math.hypot(...forward);
      if (forwardLength < 0.000001) return;
      const measuredTarget: [number, number, number] = [
        position[0] + forward[0] / forwardLength * 1.5,
        position[1] + forward[1] / forwardLength * 1.5,
        position[2] + forward[2] / forwardLength * 1.5,
      ];
      cameraSeen.current = true;
      state.setState({ targetPosition: measuredTarget, targetRotation: [...rotation] });
      console.log('[MUSE-XR-PROBE]', JSON.stringify({ kind: 'first-native-camera-transform', wallTimeMs: Date.now(), monotonicMs: performance.now(), camera,
        reference: 'measured-head-camera-once', targetPosition: measuredTarget, targetRotation: rotation, distanceMeters: 1.5,
      }));
    }}>
      <ViroAmbientLight color="#FFFFFF" intensity={500} />
      <ViroController controllerVisibility reticleVisibility
        onControllerStatus={(status, source) => record('status', { status, source })}
        onClickState={(clickState, position, source) => record('controller-click-state', { clickState, position, source })}
        onClick={(position, source) => record('controller-click', { position, source })} />
      {/* The first valid head camera anchors this target once; it is not a measured pen pose. */}
      <ViroNode position={targetPosition} rotation={targetRotation}>
        <ViroQuad width={1.8} height={1.2} materials="moyo_muse_generic_probe_target"
          onClickState={(clickState, position, source) => record('target-click-state', { clickState, position, source })}
          onClick={(position, source) => record('target-click', { position, source })} />
        <ViroText position={[0, 0, 0.01]} width={1.65} height={1.1} color="#111111" ignoreEventHandling
          style={{ fontSize: 22, textAlign: 'center', textAlignVertical: 'center' }}
          text={`PUBLIC GENERIC INPUT TEST\nAim at this target. Press and release the Muse TIP.\nKeep Touch controllers still.\n\nStatus events: ${statusEvents}\nController events: ${controllerEvents}\nTarget events: ${targetEvents}\n\n${last}\n\nThese are generic controller events, not verified Muse identity or pressure.`} />
      </ViroNode>
    </ViroScene>
  );
}

const INITIAL_SCENE = { scene: GenericInputScene };

/** Development-only public OpenXR controller fallback probe, without board or pen protocol ownership. */
export default function XrMuseInputProbeRoute() {
  const router = useRouter();
  if (!__DEV__) return <Redirect href="/" />;
  if (Platform.OS !== 'android') return <View><Text>This input probe runs on an Android XR headset.</Text></View>;
  return <ViroXRSceneNavigator vrInitialScene={INITIAL_SCENE} onExitViro={() => router.back()}
    trackingOrigin="eye" handTrackingEnabled={false} hdrEnabled={false} pbrEnabled={false} bloomEnabled={false}
    style={{ flex: 1 }} />;
}

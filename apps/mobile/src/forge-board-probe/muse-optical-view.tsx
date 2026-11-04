import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { ViroGeometry, ViroMaterials, ViroNode, ViroPolyline } from '@reactvision/react-viro';
import type { createMuseOpticalController } from './muse-optical';
import { buildOpticalPenVisual, opticalPenTriangles, type OpticalPenShape } from './muse-optical-visual';

interface OpticalPenViewProps {
  readonly controller: ReturnType<typeof createMuseOpticalController>;
  readonly shape: OpticalPenShape;
  /** Set only after the capture-time camera-to-Viro-space transform has been established. */
  readonly renderSpaceReady: boolean;
}

/** Small imperative renderer sink. Never displays historical, stale, or camera-relative values as a world pose. */
export function OpticalPenView({ controller, shape, renderSpaceReady }: OpticalPenViewProps) {
  const root = useRef<ViroNode>(null);
  const body = useRef<ViroGeometry>(null);
  const ray = useRef<ViroPolyline>(null);
  useEffect(() => {
    ViroMaterials.createMaterials({
      moyo_optical_pen_proxy: { diffuseColor: '#343A46', lightingModel: 'Constant', cullMode: 'None' },
      moyo_optical_pen_ray: { diffuseColor: '#59C8FA', lightingModel: 'Constant' },
    });
    let lastPose: unknown = null;
    const hide = () => { root.current?.setNativeProps({ visible: false }); lastPose = null; };
    const update = () => {
      controller.tick();
      const state = controller.state.getState();
      if (!renderSpaceReady || AppState.currentState !== 'active' || state.phase !== 'tracking' || !state.currentPose) {
        hide(); return;
      }
      if (lastPose === state.currentPose) return;
      const visual = buildOpticalPenVisual(state.currentPose, shape);
      if (!visual || !body.current || !ray.current || !root.current) { hide(); return; }
      body.current.setNativeProps({ vertices: visual.vertices });
      ray.current.setNativeProps({ points: visual.ray });
      root.current.setNativeProps({ visible: true });
      lastPose = state.currentPose;
    };
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        const id = controller.state.getState().sessionId;
        if (id) controller.reportLoss(id, 'Optical presentation backgrounded');
        hide();
      }
    });
    // Coalesce to the newest compact measurement; no FIFO or full React sensor renders.
    const timer = setInterval(update, 50);
    const unsubscribe = controller.state.subscribe((state) => { if (!state.currentPose) hide(); });
    update();
    return () => { clearInterval(timer); unsubscribe(); subscription.remove(); hide(); };
  }, [controller, shape, renderSpaceReady]);
  return <ViroNode ref={root} visible={false} ignoreEventHandling>
    <ViroGeometry ref={body} vertices={Array.from({ length: 9 }, () => [0, 0, 0] as [number, number, number])}
      triangleIndices={opticalPenTriangles} materials="moyo_optical_pen_proxy" />
    <ViroPolyline ref={ray} points={[[0, 0, 0], [0, 0, 0]]} thickness={0.0015} materials="moyo_optical_pen_ray" />
  </ViroNode>;
}

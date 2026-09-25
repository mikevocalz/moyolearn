import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ViroNode, ViroQuad, ViroText, ViroMaterials, ViroRivePanel } from '@reactvision/react-viro';
import { worldMatrix, type RivePanel, type RiveCanvasOptions } from 'nitro-canvas-in-Vision';

type Pose = { position: [number, number, number]; rotation: [number, number, number] };
const INITIAL: Pose = { position: [0, 1.45, -2], rotation: [0, 0, 0] };

/** Mount below a Viro scene with one ViroController. Supply compiled Fractions .riv bytes.
 * Change resetKey on recenter/tracking loss. The grip moves the native parent, including
 * the reference label; React only persists its final transform after release.
 */
export function RivePanelProbe({ bytes, resetKey = 0 }: { bytes: ArrayBuffer; resetKey?: number }) {
  const group = useRef<ViroNode>(null);
  const panel = useRef<RivePanel | null>(null);
  const owner = useRef<number | null>(null);
  const mounted = useRef(true);
  const [pose, setPose] = useState<Pose>(INITIAL);
  const [grabbed, setGrabbed] = useState(false);
  const [status, setStatus] = useState('Loading lesson…');
  const [count, setCount] = useState(0);
  const [materialsReady, setMaterialsReady] = useState(false);
  const source = useMemo<RiveCanvasOptions>(() => ({ rivBytes: bytes, artboard: 'Fractions', stateMachine: 'Lesson', fit: 'contain' }), [bytes]);
  const panelWorld = useMemo(() => worldMatrix([pose]), [pose]);
  const finish = async () => {
    if (owner.current === null) return;
    owner.current = null;
    panel.current?.setBoolean('grabbed', false);
    try {
      const next = await group.current?.getTransformAsync();
      if (mounted.current && next) setPose({ position: next.position, rotation: next.rotation });
    } catch (error) {
      if (mounted.current) setStatus(`Could not save panel position: ${String(error)}`);
    } finally { if (mounted.current) setGrabbed(false); }
  };
  useEffect(() => {
    mounted.current = true;
    ViroMaterials.createMaterials({ riveProbeGrip: { diffuseColor: '#ffc168', lightingModel: 'Constant' },
      riveProbeFallback: { diffuseColor: '#112d44', lightingModel: 'Constant' } });
    setMaterialsReady(true);
    return () => {
      mounted.current = false;
      // Runtime lifetime belongs to ViroRivePanel, including removal of its observers.
      panel.current = null;
      ViroMaterials.deleteMaterials(['riveProbeGrip', 'riveProbeFallback']);
    };
  }, []);
  useEffect(() => { void finish(); }, [resetKey]);
  useEffect(() => {
    const id = setInterval(() => {
      const runtime = panel.current;
      if (!runtime) return;
      if (runtime.error) setStatus(`Lesson unavailable: ${runtime.error}`);
      else if (runtime.renderedFrames > 0) setStatus('');
    }, 500);
    return () => clearInterval(id);
  }, []);
  if (!materialsReady) return null;
  return <ViroNode ref={group} position={pose.position} rotation={pose.rotation}>
    <ViroRivePanel source={source} width={1.2} height={0.8} position={[0, 0, 0]}
      resolution={{ width: 960, height: 640 }}
      input={{ panelWorld, enabled: !grabbed && status === '', resetKey }}
      onError={(error) => setStatus(`Lesson unavailable: ${error.message}`)}
      onRuntimeReady={(runtime) => {
        panel.current = runtime;
        runtime.observeNumber('selectedCount', setCount);
      }} />
    {status !== '' && <ViroNode position={[0, 0, 0.004]}>
      <ViroQuad width={1.2} height={0.8} materials={['riveProbeFallback']} />
      <ViroText text={status + '\nUse the amber grip to move this panel.'} position={[0, 0, 0.002]}
        width={1.08} height={0.4} style={{ fontSize: 26, color: '#ffffff', textAlign: 'center' }} />
    </ViroNode>}
    <ViroQuad position={[0, -0.48, 0.01]} width={0.65} height={0.12} materials={['riveProbeGrip']}
      dragType="FixedDistanceOrigin" dragTransform="parent" onDrag={() => {}}
      onClickState={(state, _position, sourceId) => {
        if (state === 1 && owner.current === null) {
          owner.current = sourceId;
          setGrabbed(true);
          panel.current?.setBoolean('grabbed', true);
        } else if (state === 2 && sourceId === owner.current) void finish();
      }} />
    <ViroText text={grabbed ? 'Moving panel' : 'Hold to move'} position={[0, -0.48, 0.016]}
      width={0.6} height={0.09} ignoreEventHandling style={{ fontSize: 22, color: '#112d44', textAlign: 'center' }} />
    <ViroText text={`Selected in Rive: ${count}/4`} position={[0, -0.64, 0]}
      width={1.2} height={0.12} style={{ fontSize: 22, color: '#ffffff', textAlign: 'center' }} />
  </ViroNode>;
}

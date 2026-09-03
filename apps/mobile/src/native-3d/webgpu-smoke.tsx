/**
 * The native WebGPU smoke harness — ADR-111's evidence surface.
 *
 * Before Natalie is asked to render on a device, three cheaper questions have
 * to be answered on that device, in this order, because each one makes the next
 * one meaningful:
 *
 *   1. Does Dawn come up at all? (`navigator.gpu.requestAdapter()` returns an
 *      adapter, and that adapter is not the software fallback.)
 *   2. Can a raw WGSL pipeline draw and present? (the docs' hello-triangle —
 *      no three.js, so a failure here is Dawn's, not three's.)
 *   3. Can three's WebGPURenderer drive that same surface every frame? (the
 *      example `Cube.tsx` pattern, with a measured frame rate.)
 *
 * Splitting them matters. A black screen from the full avatar could be Dawn,
 * the surface, the renderer lifecycle, the glTF, or a shader that Dawn refused
 * to compile — five candidates and no way to tell them apart on a phone at
 * 3 a.m. Each step here fails independently and says which one it was.
 *
 * ── HOW THIS SURFACE STAYS OFF THE DEMO PATH ────────────────────────────────
 *
 * `react-native-webgpu` installs its JSI bindings and assigns `navigator.gpu`
 * as a SIDE EFFECT OF BEING IMPORTED. So it is imported here, in a module that
 * only the deep-linked smoke route pulls in, and that route imports this file
 * lazily. Nothing on the learner path reaches it, so nothing on the learner
 * path installs WebGPU.
 *
 * ── THE THREE RULES THIS FILE EXISTS TO PROVE ───────────────────────────────
 *
 *  - `await renderer.init()` before the first render. Not `renderer.init()`
 *    fire-and-forget as the upstream example writes it: the first frame then
 *    races device creation, and on a cold pipeline cache that race is lost
 *    often enough to look like "WebGPU doesn't work on this phone".
 *  - `context.present()` after every frame. Three draws into the surface; the
 *    surface is not shown until it is presented. Omitting it renders a
 *    permanently black view with a perfectly healthy frame loop behind it.
 *  - `disposeWebGPURenderer` on GENUINE unmount only (wcandillon#445): three's
 *    internal rAF callback roots the whole renderer graph, and
 *    `setAnimationLoop(null)` alone does not drop it.
 *
 * SOT: docs/decisions/adr-111-native-3d-runtime.md; qa/walkthroughs/NATIVE-3D-SMOKE-2026-09-03.md
 * SOT-KEYWORDS: webgpu dawn smoke triangle cube three renderer present fps native-3d adr-111
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PixelRatio, View } from 'react-native';
import { Canvas, type CanvasRef, type NativeCanvas } from 'react-native-webgpu';
import * as THREE from 'three/webgpu';
import { Button, SafeArea, Text } from '@acme/ui';

/** Which probe is mounted. Exactly one at a time — one surface, one owner. */
type Probe = 'none' | 'triangle' | 'cube';

interface AdapterReport {
  ok: boolean;
  vendor: string;
  architecture: string;
  device: string;
  description: string;
  fallback: boolean;
}

const TRIANGLE_VERT_WGSL = `@vertex
fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4f {
  var pos = array<vec2f, 3>(vec2(0.0, 0.5), vec2(-0.5, -0.5), vec2(0.5, -0.5));
  return vec4f(pos[VertexIndex], 0.0, 1.0);
}`;

const TRIANGLE_FRAG_WGSL = `@fragment
fn main() -> @location(0) vec4f {
  return vec4(1.0, 0.0, 0.0, 1.0);
}`;

/**
 * Drops the event listeners three leaves on its module-level `QuadMesh`
 * geometry singleton after a renderer is disposed.
 *
 * three's `RenderObjects.dispose()` clears its chain maps without disposing the
 * individual RenderObjects, so their `dispose`/`release` listeners stay attached
 * to that shared geometry and keep the DISPOSED renderer's backend reachable —
 * wcandillon/react-native-webgpu#445. Safe only while the app has at most one
 * live renderer at a time, which the single-probe rule below guarantees.
 *
 * The parameter names the three types this is actually called with, so a typo
 * at a call site is still a type error. `_listeners` itself is three's own
 * private field and appears in no public declaration, which is why reading it
 * needs the local narrowing — the alternative is `any`, and the whole point is
 * to touch exactly one property and nothing else.
 */
type ThreeListenerHolder =
  | THREE.BufferGeometry
  | THREE.BufferAttribute
  | THREE.InterleavedBufferAttribute;

function clearStaleListeners(target: ThreeListenerHolder | null | undefined): void {
  if (!target) return;
  const holder = target as { _listeners?: object };
  if (holder._listeners) holder._listeners = {};
}

/**
 * A frame-rate counter that reports once a second and allocates nothing per
 * frame. Deliberately a closure over two numbers rather than an array of
 * timestamps: the thing being measured is a frame budget, and a measurement
 * that allocates inside the loop changes the number it is reporting.
 */
function createFpsMeter(report: (fps: number) => void) {
  let frames = 0;
  let windowStartMs = 0;
  return (nowMs: number) => {
    if (windowStartMs === 0) windowStartMs = nowMs;
    frames += 1;
    const elapsed = nowMs - windowStartMs;
    if (elapsed >= 1000) {
      report(Math.round((frames * 1000) / elapsed));
      frames = 0;
      windowStartMs = nowMs;
    }
  };
}

/**
 * Step 1 — raw Dawn. No three.js in the failure surface, so a red triangle on
 * blue means the adapter, the device, the surface, the WGSL compiler and
 * `present()` all work, and anything that breaks later is three's.
 */
function TriangleProbe({ onResult }: { onResult: (line: string) => void }) {
  const ref = useRef<CanvasRef>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error('requestAdapter() returned null');
        const device = await adapter.requestDevice();
        const format = navigator.gpu.getPreferredCanvasFormat();
        const canvasRef = ref.current;
        if (!canvasRef) throw new Error('canvas ref was empty after mount');
        const context = canvasRef.getContext('webgpu');
        if (!context) throw new Error('getContext("webgpu") returned null');
        if (cancelled) return;

        // The surface is created at layout size; the drawing buffer has to be
        // scaled to physical pixels or the triangle renders soft and the number
        // this harness reports would not be the number the avatar will see.
        //
        // Reached through `getNativeSurface()` rather than `context.canvas`.
        // They are the same native object — both are looked up by `contextId`
        // in the native registry — but `@webgpu/types` declares `.canvas` as
        // the DOM union (`HTMLCanvasElement | OffscreenCanvas`), which this is
        // not, so reading it needs a double cast through `unknown`. The typed
        // accessor is the same write with none of that.
        const surface: NativeCanvas = canvasRef.getNativeSurface();
        surface.width = surface.clientWidth * PixelRatio.get();
        surface.height = surface.clientHeight * PixelRatio.get();

        context.configure({ device, format, alphaMode: 'premultiplied' });

        const pipeline = device.createRenderPipeline({
          layout: 'auto',
          vertex: {
            module: device.createShaderModule({ code: TRIANGLE_VERT_WGSL }),
            entryPoint: 'main',
          },
          fragment: {
            module: device.createShaderModule({ code: TRIANGLE_FRAG_WGSL }),
            entryPoint: 'main',
            targets: [{ format }],
          },
          primitive: { topology: 'triangle-list' },
        });

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              clearValue: [0, 0, 0, 0],
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        });
        pass.setPipeline(pipeline);
        pass.draw(3);
        pass.end();
        device.queue.submit([encoder.finish()]);
        context.present();

        onResult(`triangle: submitted and presented at ${surface.width}x${surface.height}`);
      } catch (error) {
        onResult(`triangle FAILED: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onResult]);

  return (
    <View className="flex-1">
      <View className="flex-1 bg-primary" />
      <Canvas ref={ref} style={{ position: 'absolute', inset: 0 }} transparent />
    </View>
  );
}

/**
 * Step 2 — three's WebGPURenderer over the same surface, every frame, with the
 * frame rate measured. This is the exact lifecycle the avatar stage will use,
 * with a box standing in for a head.
 */
function CubeProbe({ onResult }: { onResult: (line: string) => void }) {
  const ref = useRef<CanvasRef>(null);
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    const context = ref.current?.getContext('webgpu');
    if (!context) {
      onResult('cube FAILED: getContext("webgpu") returned null');
      return;
    }

    const { width, height } = context.canvas;
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
    camera.position.z = 1;

    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const material = new THREE.MeshNormalMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const renderer = new THREE.WebGPURenderer({
      antialias: true,
      canvas: context.canvas,
      context,
    });

    const measure = createFpsMeter(setFps);
    let disposed = false;

    (async () => {
      try {
        // Awaited, unlike the upstream example. The first render must not race
        // device creation — see the header block.
        await renderer.init();
        if (disposed) return;
        onResult('cube: renderer.init() resolved');
        renderer.setAnimationLoop((time: number) => {
          mesh.rotation.x = time / 2000;
          mesh.rotation.y = time / 1000;
          renderer.render(scene, camera);
          context.present();
          measure(time);
        });
      } catch (error) {
        onResult(`cube FAILED: ${error instanceof Error ? error.message : String(error)}`);
      }
    })();

    return () => {
      // Genuine unmount. `setAnimationLoop(null)` alone leaves three's internal
      // rAF callback rooting the entire renderer graph (wcandillon#445), so the
      // dispose has to run too — and the shared QuadMesh singleton's stale
      // listeners have to be cleared or they root the disposed backend.
      disposed = true;
      renderer.setAnimationLoop(null);
      // Before the dispose: destroying the device first leaves the native
      // view's later surface release walking a dead one, which is a SIGSEGV
      // rather than an error. Same fix, same reasoning as the avatar stage —
      // see `tutor-avatar-3d.native.tsx`'s teardown.
      context.unconfigure();
      renderer.dispose();
      const quad = new THREE.QuadMesh();
      clearStaleListeners(quad.geometry);
      clearStaleListeners(quad.geometry.index);
      for (const attribute of Object.values(quad.geometry.attributes)) {
        clearStaleListeners(attribute);
      }
      geometry.dispose();
      material.dispose();
    };
  }, [onResult]);

  return (
    <View className="flex-1">
      <Canvas ref={ref} style={{ flex: 1 }} />
      <View className="absolute left-group top-group">
        <Text variant="data" tone="inverse">
          {fps === null ? 'measuring…' : `${fps} fps`}
        </Text>
      </View>
    </View>
  );
}

export function WebGpuSmoke() {
  const [probe, setProbe] = useState<Probe>('none');
  const [adapter, setAdapter] = useState<AdapterReport | null>(null);
  const [log, setLog] = useState<readonly string[]>([]);

  const append = useCallback((line: string) => {
    setLog((previous) => [...previous, line]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await navigator.gpu.requestAdapter();
        if (cancelled) return;
        if (!found) {
          setAdapter({
            ok: false,
            vendor: '',
            architecture: '',
            device: '',
            description: 'requestAdapter() returned null',
            fallback: false,
          });
          return;
        }
        const info = found.info;
        setAdapter({
          ok: true,
          vendor: info.vendor,
          architecture: info.architecture,
          device: info.device,
          description: info.description,
          // A fallback adapter is Dawn's software rasteriser. It "works" and it
          // will never hold a frame budget, so it is reported as loudly as a
          // failure rather than quietly passing the smoke.
          fallback: Boolean(info.isFallbackAdapter),
        });
      } catch (error) {
        if (cancelled) return;
        setAdapter({
          ok: false,
          vendor: '',
          architecture: '',
          device: '',
          description: error instanceof Error ? error.message : String(error),
          fallback: false,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeArea edges={['top', 'bottom']} className="flex-1 bg-surface">
      <View className="gap-stack p-group">
        <Text variant="heading">Native 3D smoke</Text>
        <Text variant="data" tone={adapter?.ok && !adapter.fallback ? 'default' : 'danger'}>
          {adapter === null
            ? 'adapter: probing…'
            : adapter.ok
              ? `adapter: ${adapter.vendor} ${adapter.architecture} ${adapter.device} ${adapter.description}${adapter.fallback ? ' [SOFTWARE FALLBACK]' : ''}`
              : `adapter FAILED: ${adapter.description}`}
        </Text>
        <View className="flex-row gap-group">
          <Button title="Triangle" onPress={() => setProbe('triangle')} />
          <Button title="Cube" onPress={() => setProbe('cube')} />
          <Button title="Stop" onPress={() => setProbe('none')} />
        </View>
        {log.map((line) => (
          <Text key={line} variant="caption" tone="muted">
            {line}
          </Text>
        ))}
      </View>
      {/*
        Keyed remount per probe, and only one mounted at a time. Two live
        surfaces would each claim a Dawn swapchain, which is exactly the
        condition issue #445 makes unrecoverable.
      */}
      <View className="flex-1">
        {probe === 'triangle' ? <TriangleProbe key="triangle" onResult={append} /> : null}
        {probe === 'cube' ? <CubeProbe key="cube" onResult={append} /> : null}
      </View>
    </SafeArea>
  );
}

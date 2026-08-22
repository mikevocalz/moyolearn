/**
 * The `GoldenTarget` implementation that actually renders — doc 22 §10.5.
 *
 * `golden.ts` owns the deterministic loop and knows nothing about three.js.
 * This is the other side of that interface: it points the camera, drives a
 * frame, and reads the colour attachment back. It is the last piece of the
 * golden gate, and the only one whose correctness cannot be settled without a
 * GPU — everything here compiles against real three 0.185.1, and none of it has
 * produced a pixel.
 *
 * ── WHY IT RENDERS TO A RENDER TARGET AND NOT TO THE SCREEN ─────────────────
 *
 * A canvas-backed capture would have to read back from the swap chain, which is
 * transient, presentation-scaled, and on some backends already composited
 * against the page. A `RenderTarget` is none of those: it is ours, it is exactly
 * the size we asked for, and `readRenderTargetPixelsAsync` is the sanctioned
 * way off it. That also makes the harness headless — it runs against an
 * offscreen surface on device and against a desktop context in dev without a
 * branch.
 *
 * ── THE THREE THINGS THAT SILENTLY RUIN A CAPTURE ──────────────────────────
 *
 * 1. **Pixel ratio.** `renderer.setPixelRatio` defaults to the device's, so the
 *    same code captures 512×512 on one machine and 1024×1024 on another. Pinned
 *    to 1 here, and `assertCaptureInvariants` checks it independently.
 * 2. **Row order.** WebGPU readback is BOTTOM-UP; PNG is top-down. Nothing
 *    throws if you get this wrong — you get a vertically mirrored golden that
 *    passes its own diff forever and fails the moment anyone regenerates it
 *    from a screenshot. `flipY` is on by default and the flip is one memcpy per
 *    row.
 * 3. **Colour space and alpha.** The pipeline's `outputColorTransform` already
 *    applied tone mapping and sRGB, so the target must be a plain `UnsignedByte`
 *    RGBA in `NoColorSpace` — asking the target to convert again double-encodes
 *    and every golden comes out washed out.
 *
 * ── WHAT THE CALLER STILL OWNS ──────────────────────────────────────────────
 *
 * `advance(deltaMs, elapsedMs)` — stepping the idle engine, the face bus, the
 * speech clock and the head evaluation. This module deliberately does not know
 * what a frame *contains*; it knows how to make one happen and how to get it
 * back. Keeping that boundary is what lets the same target capture the avatar,
 * a material probe, or a wardrobe-only scene.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §8, §10.5
 * SOT-KEYWORDS: golden offscreen target rendertarget readback flipy pixelratio capture webgpu
 */
import {
  LinearFilter,
  MathUtils,
  NoColorSpace,
  RenderTarget,
  UnsignedByteType,
  Vector3,
} from 'three';
import type { PerspectiveCamera } from 'three';
import type { Renderer } from 'three/webgpu';
import type { GoldenCamera, GoldenTarget } from './golden.ts';

export interface OffscreenTargetOptions {
  renderer: Renderer;
  camera: PerspectiveCamera;
  /**
   * Draws one frame. Everything time-dependent is stepped here — idle engine,
   * face bus, speech clock, head evaluation — and then the stage is rendered.
   * The target does not know what a frame contains, only how to cause one.
   */
  advance(deltaMs: number, elapsedMs: number): void;
  width?: number;
  height?: number;
  /**
   * WebGPU reads back bottom-up and PNG is top-down. Leave this on unless you
   * are feeding something that expects GL row order — a mirrored golden passes
   * its own diff forever and only fails when someone regenerates it.
   */
  flipY?: boolean;
}

/** 512 square: big enough for the eye close-up to be meaningful, small enough for CI. */
export const GOLDEN_WIDTH = 512;
export const GOLDEN_HEIGHT = 512;

export interface OffscreenTarget extends GoldenTarget {
  renderTarget: RenderTarget;
  dispose(): void;
}

export function createOffscreenTarget(options: OffscreenTargetOptions): OffscreenTarget {
  const width = options.width ?? GOLDEN_WIDTH;
  const height = options.height ?? GOLDEN_HEIGHT;
  const flipY = options.flipY ?? true;
  const { renderer, camera } = options;

  // Pinned, not inherited. The device's own ratio would silently change the
  // capture size between machines, and two goldens of different sizes are not
  // comparable at all — `diffImages` refuses them outright.
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);

  const renderTarget = new RenderTarget(width, height, {
    // The RenderPipeline already applied tone mapping and the output colour
    // transform. Converting again here double-encodes and washes out every
    // golden — a failure that looks like a lighting regression.
    type: UnsignedByteType,
    colorSpace: NoColorSpace,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: true,
    stencilBuffer: false,
    // No MSAA on the capture target: the stage's own `pass({ samples })` owns
    // antialiasing, and a second resolve here would change the picture relative
    // to what ships.
    samples: 0,
  });

  const target = new Vector3();
  const rgba = new Uint8Array(width * height * 4);
  const row = new Uint8Array(width * 4);

  return {
    width,
    height,
    renderTarget,

    setCamera(golden: GoldenCamera) {
      camera.position.set(...(golden.position as [number, number, number]));
      target.set(...(golden.target as [number, number, number]));
      camera.fov = golden.fov;
      camera.aspect = width / height;
      camera.near = 0.02;
      camera.far = 30;
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      // Both, in this order: `updateProjectionMatrix` picks up fov/aspect and
      // `updateMatrixWorld` picks up the lookAt. Skipping either leaves the
      // first frame after a camera change rendered with the previous camera,
      // which in a 240-frame capture is invisible and in a 1-frame one is the
      // whole picture.
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    },

    renderFrame(deltaMs: number, elapsedMs: number) {
      renderer.setRenderTarget(renderTarget);
      options.advance(deltaMs, elapsedMs);
      renderer.setRenderTarget(null);
    },

    async readPixels() {
      const data = await renderer.readRenderTargetPixelsAsync(renderTarget, 0, 0, width, height);
      const source = new Uint8Array(
        data.buffer as ArrayBuffer,
        data.byteOffset,
        width * height * 4
      );
      if (!flipY) {
        rgba.set(source);
        return rgba;
      }
      // Bottom-up to top-down, one row at a time. `subarray` is a view, so the
      // three-way swap through `row` is necessary — copying in place without it
      // corrupts the second half of the image.
      const stride = width * 4;
      for (let y = 0; y < height; ++y) {
        row.set(source.subarray((height - 1 - y) * stride, (height - y) * stride));
        rgba.set(row, y * stride);
      }
      return rgba;
    },

    dispose() {
      renderTarget.dispose();
    },
  };
}

/**
 * The invariants this target guarantees, for `assertCaptureInvariants()`.
 *
 * Reported rather than assumed: the whole point of that assertion is that it
 * checks the setup independently, and a target that asserted its own
 * correctness would be marking its own homework.
 */
export function describeCapture(
  target: OffscreenTarget,
  dampingEnabled: boolean,
  seed: number
) {
  return {
    devicePixelRatio: 1,
    dampingEnabled,
    seed,
    width: target.width,
    height: target.height,
  };
}

/** Degrees to radians, for camera specs written the way a DP would write them. */
export const degToRad = MathUtils.degToRad;

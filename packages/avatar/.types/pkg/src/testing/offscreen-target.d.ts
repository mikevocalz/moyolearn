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
import { RenderTarget } from 'three';
import type { PerspectiveCamera } from 'three';
import type { Renderer } from 'three/webgpu';
import type { GoldenTarget } from './golden.ts';
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
export declare const GOLDEN_WIDTH = 512;
export declare const GOLDEN_HEIGHT = 512;
export interface OffscreenTarget extends GoldenTarget {
    renderTarget: RenderTarget;
    dispose(): void;
}
export declare function createOffscreenTarget(options: OffscreenTargetOptions): OffscreenTarget;
/**
 * The invariants this target guarantees, for `assertCaptureInvariants()`.
 *
 * Reported rather than assumed: the whole point of that assertion is that it
 * checks the setup independently, and a target that asserted its own
 * correctness would be marking its own homework.
 */
export declare function describeCapture(target: OffscreenTarget, dampingEnabled: boolean, seed: number): {
    devicePixelRatio: number;
    dampingEnabled: boolean;
    seed: number;
    width: number;
    height: number;
};
/** Degrees to radians, for camera specs written the way a DP would write them. */
export declare const degToRad: typeof import("three/src/math/MathUtils.js").degToRad;

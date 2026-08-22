/**
 * The stage: lighting rig, IBL, shadows, tone mapping, and the post chain.
 *
 * This is doc 22 §4 rows 8-12 — the other half of the rewrite. The reference
 * drove an `EffectComposer` (`RenderPass → SSAOPass → UnrealBloomPass →
 * OutputPass`) and read `THREE.ShaderChunk` at runtime. On WebGPU none of that
 * exists; the pipeline is a node graph.
 *
 * DEEP-SKIN LIGHTING LAWS, carried over unchanged because they are the reason
 * the character reads at all: the rig is deliberately rim + fill so the shadow
 * side of a brown face keeps STRUCTURE. IBL is low-intensity ambient fill and
 * never the key. A broad warm under-bounce keeps the jaw underside alive.
 * Blacks must never crush — the tone-mapping choice was A/B'd against
 * shadow-side facial structure, not taste.
 *
 * FOUR THINGS THAT ARE NOT LIKE THE REFERENCE, each forced:
 *
 *   `RenderPipeline`, not `PostProcessing` — renamed in r183; the old name is
 *   a deprecation shim due for removal around r193.
 *
 *   `PCFShadowMap`, not `PCFSoftShadowMap` — r185 honours the soft variant on
 *   WebGPU and r186 REMOVES it and throws. PCF is soft in r186 and identical on
 *   WebGL, so it is the only value that survives the bump unchanged.
 *
 *   `ao()` (GTAO), not an SSAO look-alike — the only AO node at r185, and it
 *   needs a depth+normal MRT prepass, which is why it is the studio tier only.
 *   It is wired through `builtinAOContext`, which injects occlusion into the
 *   material's INDIRECT term rather than multiplying the composite. That is
 *   physically better and it will NOT match the reference frames; expect a
 *   re-tune and treat "the port looks wrong" reports against this first. GTAO
 *   is also temporally noisy — three's own example pairs it with `traa()`, and
 *   whether this look needs that is open (doc 22 §11).
 *
 *   No `OutputPass` — `RenderPipeline.outputColorTransform` is true by default
 *   and applies `renderOutput()` from `renderer.toneMapping` /
 *   `renderer.outputColorSpace` automatically.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 8-12, §6
 * SOT-KEYWORDS: stage lighting rectarealight ltc pmrem ibl shadows tone mapping renderpipeline bloom gtao
 */
import { Vector3 } from 'three';
import type { Camera, Scene, WebGPURenderer } from 'three/webgpu';
import type { TierProfile } from './tiers.ts';
export declare const TONE_MAPPING_CHOICES: {
    readonly acesfilmic: {
        readonly toneMapping: 4;
        readonly exposure: 1.05;
    };
    readonly agx: {
        readonly toneMapping: 6;
        readonly exposure: 1.15;
    };
};
export type ToneMappingName = keyof typeof TONE_MAPPING_CHOICES;
/**
 * DELIBERATE, and the reasoning is kept because it is the kind of decision that
 * gets silently reversed: measured on the face at the same frame, AgX lifts the
 * shadow-side cheek harder (p5 luminance 91 vs ACES 69) but pays in chroma —
 * relative saturation drops to ~0.34-0.40 against ACES's ~0.47-0.55, and the
 * brown skin reads grey-tan, off-character. ACES under THIS rig does not crush:
 * the cool fill plus the warm under-bounce hold the shadow-side cheek at p5 69,
 * where the old directional-only rig sat at 40. ACES wins for this character;
 * AgX stays one parameter away.
 */
export declare const DEFAULT_TONE_MAPPING: ToneMappingName;
export declare const OUTPUT_COLOR_SPACE: "srgb";
export declare function chooseToneMapping(name: string | null | undefined): ToneMappingName;
export declare function applyToneMapping(renderer: WebGPURenderer, name?: string | null): ToneMappingName;
interface LightSpec {
    role: string;
    color: number;
    intensity: number;
    width: number;
    height: number;
    offset: readonly [number, number, number];
}
/** Five area lights, unchanged from the reference — the look depends on them. */
export declare const RIG: readonly LightSpec[];
export declare function initRectAreaLights(): void;
export interface StageStats {
    /** EMA of frame-to-frame delta in ms — the input to tier demotion. */
    frameMs: number;
    drawCalls: number;
}
export interface Stage {
    render(): void;
    /** Re-aims every light once the framing is measured. */
    setFocus(focus: Vector3): void;
    setSize(width: number, height: number): void;
    readonly stats: StageStats;
    dispose(): void;
}
export interface StageOptions {
    renderer: WebGPURenderer;
    scene: Scene;
    camera: Camera;
    profile: TierProfile;
    toneMapping?: string | null;
    /** Head height in metres; the rig is aimed relative to it. */
    focus?: Vector3;
    /**
     * World Y of the ground the contact shadow lands on. Defaults to
     * `focus.y - STANDING_HEAD_HEIGHT`, i.e. the floor a standing avatar whose
     * head is at `focus` would be on.
     */
    groundY?: number;
}
/**
 * Head height of the SMPL-X female standing on y = 0. The shadow catcher is
 * placed relative to `focus` through this, so a stage framed on a seated or
 * child-height avatar still puts the ground under the feet.
 */
export declare const STANDING_HEAD_HEIGHT = 1.45;
/**
 * Where the shadow catcher goes, given the framing.
 *
 * Extracted as a pure function so it can be tested — `createStage()` itself
 * needs a live renderer (`PMREMGenerator`, `pass()`), which is why this file's
 * suite tests decisions rather than devices. The decision is: the ground is a
 * standing height below the head, unless the caller says otherwise.
 */
export declare function groundYFor(focus: Vector3, groundY?: number): number;
export declare function createStage(options: StageOptions): Stage;
export {};

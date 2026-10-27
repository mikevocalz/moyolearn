/**
 * Plays a retargeted clip onto the rig — compositor layer one, exclusively.
 *
 * EXCLUSIVE MEANS EXCLUSIVE. The pose-compositor rule is one writer per
 * joint, and `HumanoPresence` restores-and-writes every frame; a player
 * running beside it would be the whichever-runs-second-wins bug the skill
 * names. A stage runs the presence OR a standalone player, never both — and
 * when a clip should live UNDER the presence, the clip goes in as DATA via
 * `HumanoPresence.setBaseClip`, where the presence's own restore step samples
 * it as the base. One writer either way; this module refuses to be
 * constructed over bones a live presence owns by taking the scene, not the
 * presence.
 *
 * The clip format is the retargeter's: ABSOLUTE local quaternions per joint
 * per frame, plus translation tracks for the control twins whose pivots ride
 * (see tools/retarget_staystill.mjs — the two-chain obligation lives in the
 * DATA, so a player cannot forget the twins and detach the eyes).
 *
 * Sampling slerps between frames on the caller's clock. Nothing allocates
 * per frame: the working quaternions and vectors are owned by the player,
 * and `three`'s slerp writes in place.
 *
 * SOT: docs/decisions/adr-113-body-motion-layer.md · tools/retarget_staystill.mjs
 * SOT-KEYWORDS: clip player layer one retarget staystill exclusive twins slerp loop
 */
import * as THREE from 'three';
export interface RetargetedClip {
    readonly fps: number;
    readonly frames: number;
    /** `false` for one-shot takes (turns): the take ends facing elsewhere, so
     *  wrapping to frame 0 would snap the body back. Absent means looping. */
    readonly loop?: boolean;
    readonly source: string;
    readonly joints: Record<string, readonly [number, number, number, number][]>;
    readonly root: {
        readonly translation: readonly [number, number, number][];
    };
    readonly translations: Record<string, readonly [number, number, number][]>;
}
export interface ClipPlayer {
    /** Writes the pose for `timeS` onto the bones. Loops past the end, or
     *  holds the last frame when the clip says `loop: false`. */
    apply(timeS: number): void;
    /** Puts every touched bone back exactly where the clip found it. */
    release(): void;
    readonly durationS: number;
    /** Joints named by the clip that the scene could not resolve. */
    readonly unresolved: readonly string[];
}
export declare function createClipPlayer(scene: THREE.Object3D, clip: RetargetedClip): ClipPlayer;

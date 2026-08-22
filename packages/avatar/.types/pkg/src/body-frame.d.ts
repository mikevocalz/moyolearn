/**
 * Moyo header block: THE single neck/head writer. Two systems can plausibly
 * rotate the head — the body rig and the GNM head's own internal joints — and
 * when both do, the seam tears in a way that is close to undebuggable from a
 * screenshot. This module owns the decision: the body writes neck and head
 * bones, and mirrors the same split into GNM's internal joints through the
 * inverse align rotation, so the head mesh twists through its authored weights
 * instead of rotating as a rigid lump.
 *
 * It claims the neck-writer token at construction and presents it once per
 * frame; anything else touching those bones throws in dev.
 *
 * Ported verbatim from the gnm-avatar reference renderer (import paths only).
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: body frame rig neck head single-writer gesture pose idle breath sway emage
 */
/**
 * The ONE place that writes body bones AND the GNM head-pose joints (§8).
 * createBodyRig claims the neck writer token; applyBodyFrame presents it once
 * per frame and is the only code allowed to touch neck/head/spine/pelvis
 * bones — or GNM's own neck/head joints, which mirror the body rotations so
 * the head MESH twists through GNM's authored skinning weights instead of
 * rotating rigidly (a rigid chest-length skirt shears visibly under yaw).
 *
 *   breathPitch            -> spine2 pitch (config caps it at 0.3 deg)
 *   swayX/Y (+ breathY)    -> pelvis position, full +-10 mm scale
 *   driftYaw/driftPitch
 *     + nodPitch           -> neck+head split 40/60, written BOTH to the
 *                            body bones and to GNM's internal joints
 *
 * gaze eyeYaw/eyePitch stays on the GNM eye joints (applied by the page).
 * The head group is parented to the NECK-PARENT bone (near-static), so GNM's
 * internal FK is the only thing rotating the head mesh — no double rotation.
 *
 * Sign convention: every SMPL-X bone rests with an identity world rotation
 * (verified in tools/bake_neck_align.py) and the body faces +z, so +pitch
 * about x nods down and +yaw about y turns left. GNM joint axes live in GNM
 * model space, which differs from body space by the neck-align rotation —
 * axes are mapped through its inverse (uniform scale divides out).
 */
import * as THREE from 'three';
import type { Body } from './body.ts';
import type { GNMHeadModel } from './gnm/model.ts';
import type { IdleFrame } from './idle/engine.ts';
export interface GNMNeckDrive {
    model: GNMHeadModel;
    neckIndex: number;
    headIndex: number;
    /** Rotation part of the neck-align matrix (gnm-model -> body world). */
    alignRotation: THREE.Matrix3;
}
export interface GesturePose {
    joints: string[];
    pose: Float32Array;
}
export interface BodyRig {
    /** Applies one idle frame (+ optional co-speech gesture) to the skeleton. */
    apply: (frame: IdleFrame, frameId: number, gesture?: GesturePose | null, dt?: number) => void;
    /** The SMPL-X head bone (kept for reference/QA). */
    headBone: THREE.Bone;
    /** Near-static mount for the GNM head group (neck's parent bone). */
    mountBone: THREE.Bone;
    /** Dev-only held head turn (?pose=turn), added before distribution. */
    debugTurn: {
        pitch: number;
        yaw: number;
    } | null;
}
export declare function createBodyRig(body: Body, gnm: GNMNeckDrive): BodyRig;

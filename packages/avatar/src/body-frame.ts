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
import { claimNeckFrame, claimNeckWriter } from './neck-writer.ts';

/** Human-like distribution of head rotation across the cervical chain. */
const NECK_SHARE = 0.4;
const HEAD_SHARE = 0.6;

export interface GNMNeckDrive {
  model: GNMHeadModel;
  neckIndex: number;
  headIndex: number;
  /** Rotation part of the neck-align matrix (gnm-model -> body world). */
  alignRotation: THREE.Matrix3;
}

export interface GesturePose {
  joints: string[];
  pose: Float32Array; // axis-angle triples, joints order
}

export interface BodyRig {
  /** Applies one idle frame (+ optional co-speech gesture) to the skeleton. */
  apply: (
    frame: IdleFrame,
    frameId: number,
    gesture?: GesturePose | null,
    dt?: number
  ) => void;
  /** The SMPL-X head bone (kept for reference/QA). */
  headBone: THREE.Bone;
  /** Near-static mount for the GNM head group (neck's parent bone). */
  mountBone: THREE.Bone;
  /** Dev-only held head turn (?pose=turn), added before distribution. */
  debugTurn: { pitch: number; yaw: number } | null;
}

export function createBodyRig(body: Body, gnm: GNMNeckDrive): BodyRig {
  const bone = (name: string): THREE.Bone => {
    const index = body.manifest.bones.indexOf(name);
    const found = body.mesh.skeleton.bones[index];
    if (index < 0 || !found || found.name !== name) {
      throw new Error(`bone "${name}" missing from skeleton/manifest`);
    }
    return found;
  };
  const pelvis = bone('pelvis');
  const spine2 = bone('spine2');
  const neck = bone('neck');
  const head = bone('head');
  const mountName = body.manifest.parents['neck'];
  if (!mountName) throw new Error('neck has no parent in the manifest');
  const mount = bone(mountName);

  const rest = {
    pelvisPos: pelvis.position.clone(),
    spine2: spine2.quaternion.clone(),
    neck: neck.quaternion.clone(),
    head: head.quaternion.clone(),
  };

  // Gesture-driven bones (upper body + hands). We keep a deterministic
  // relaxed idle pose layered underneath any EMAGE gesture so the avatar never
  // reverts to the strict SMPL-X T-pose when speech is not active.
  const gestureBones = new Map<string, THREE.Bone>();
  const idle = new Map<THREE.Bone, THREE.Quaternion>();
  for (const b of body.mesh.skeleton.bones) {
    if (
      /^(spine[123]|(left|right)_(collar|shoulder|elbow|wrist|index|middle|pinky|ring|thumb))/.test(
        b.name
      )
    ) {
      gestureBones.set(b.name, b);
      idle.set(b, new THREE.Quaternion());
    }
  }

  const shoulderRest = new THREE.Vector3();
  const wristRest = new THREE.Vector3();
  const targetWorld = new THREE.Vector3();
  const targetLocal = new THREE.Vector3();
  const qTemp = new THREE.Quaternion();

  const setShoulderIdle = (side: 'left' | 'right'): void => {
    const s = side === 'left' ? 1 : -1;
    const shoulder = gestureBones.get(`${side}_shoulder`);
    const elbow = gestureBones.get(`${side}_elbow`);
    const wrist = gestureBones.get(`${side}_wrist`);
    if (!shoulder || !elbow || !wrist) return;

    // Shoulder: arm hangs down and slightly forward/out.
    shoulderRest.copy(elbow.position).normalize();
    targetWorld.set(s * 0.15, -0.82, 0.35).normalize();
    idle.set(
      shoulder,
      new THREE.Quaternion().setFromUnitVectors(shoulderRest, targetWorld)
    );
    const shoulderQ = idle.get(shoulder)!;

    // Elbow: forearm continues down and angles a little inward/forward.
    wristRest.copy(wrist.position).normalize();
    targetWorld.set(s * 0.2, -0.88, 0.15).normalize();
    targetLocal
      .copy(targetWorld)
      .applyQuaternion(qTemp.copy(shoulderQ).invert())
      .normalize();
    idle.set(
      elbow,
      new THREE.Quaternion().setFromUnitVectors(wristRest, targetLocal)
    );
  };
  setShoulderIdle('left');
  setShoulderIdle('right');
  let gestureBlend = 0;
  let lastFrameId = -1;
  const dtGesture = (frameId: number, dtSeconds = 1 / 60) => {
    const dt =
      lastFrameId < 0
        ? dtSeconds
        : Math.max(1 / 240, (frameId - lastFrameId) / 60, dtSeconds);
    lastFrameId = frameId;
    return dt;
  };
  const gAxis = new THREE.Vector3();
  const gQuat = new THREE.Quaternion();

  const token = claimNeckWriter();
  const euler = new THREE.Euler();
  const q = new THREE.Quaternion();
  const invAlign = gnm.alignRotation.clone();
  {
    // Orthonormalize (divide out the uniform scale), then invert = transpose.
    const e = invAlign.elements;
    // Matrix3.elements is a fixed 9-element array; the flag cannot see that
    // through the `number[]` type, and hoisting the first column is both the
    // fix and the clearest statement of what is being measured.
    const s = Math.hypot(e[0] as number, e[1] as number, e[2] as number);
    for (let i = 0; i < 9; ++i) e[i] = (e[i] as number) / s;
    invAlign.transpose();
  }
  const axis = new THREE.Vector3();

  /** Writes a body-space euler (pitch,yaw) to a GNM joint as axis-angle. */
  const driveGnmJoint = (jointIndex: number, pitch: number, yaw: number) => {
    q.setFromEuler(euler.set(pitch, yaw, 0));
    const angle = 2 * Math.acos(Math.min(1, Math.abs(q.w)));
    if (angle < 1e-6) {
      gnm.model.setJointRotation(jointIndex, 0, 0, 0);
      return;
    }
    const s = Math.sqrt(Math.max(1 - q.w * q.w, 1e-12));
    axis.set(q.x / s, q.y / s, q.z / s).applyMatrix3(invAlign);
    const sign = q.w < 0 ? -1 : 1;
    gnm.model.setJointRotation(
      jointIndex,
      axis.x * angle * sign,
      axis.y * angle * sign,
      axis.z * angle * sign
    );
  };

  const rig: BodyRig = {
    headBone: head,
    mountBone: mount,
    debugTurn: null,
    apply: (
      frame: IdleFrame,
      frameId: number,
      gesture?: GesturePose | null,
      dt = 1 / 60
    ): void => {
      claimNeckFrame(frameId, token);

      // §Phase-5 co-speech gesture: EMAGE upper-body axis-angle over the
      // deterministic relaxed idle pose. Crossfades in/out so gesture
      // onset/offset never pops. Idle keeps running: breath and sway are
      // additive on pelvis/spine2 below, never zeroed.
      const want = gesture ? 1 : 0;
      gestureBlend += (want - gestureBlend) * Math.min(1, dtGesture(frameId, dt) * 3);

      // Start every driven bone from the relaxed idle pose (arms down/forward
      // instead of the SMPL-X T-pose).
      for (const bone of gestureBones.values()) {
        bone.quaternion.copy(idle.get(bone)!);
      }

      if (gesture && gestureBlend > 0.001) {
        // A gesture track arrives over the wire from the inference gateway, so
        // its joints and pose array are the one input here that is genuinely
        // untrusted — a short or ragged track must be skipped per joint, not
        // asserted away.
        for (const [i, jointName] of gesture.joints.entries()) {
          const bone = gestureBones.get(jointName);
          if (!bone) continue;
          const o = i * 3;
          const x = gesture.pose[o];
          const y = gesture.pose[o + 1];
          const z = gesture.pose[o + 2];
          if (x === undefined || y === undefined || z === undefined) continue;
          const angle = Math.hypot(x, y, z);
          if (angle < 1e-6) continue;
          gAxis.set(x / angle, y / angle, z / angle);
          gQuat.setFromAxisAngle(gAxis, angle * gestureBlend);
          bone.quaternion.multiply(gQuat);
        }
      }

      // Breath pitch on the chest — composed ON TOP of whatever gesture left
      // on spine2 (§7: idle is never zeroed while gesture plays).
      q.setFromEuler(euler.set(frame.breathPitch, 0, 0));
      spine2.quaternion.multiply(q);

      // Postural sway + breath bob on the pelvis (meters).
      pelvis.position.set(
        rest.pelvisPos.x + frame.swayX,
        rest.pelvisPos.y + frame.swayY + frame.breathY,
        rest.pelvisPos.z
      );

      // Head orientation: drift + nod (+ dev turn), split neck/head.
      const pitch =
        frame.driftPitch + frame.nodPitch + (rig.debugTurn?.pitch ?? 0);
      const yaw = frame.driftYaw + (rig.debugTurn?.yaw ?? 0);
      q.setFromEuler(euler.set(pitch * NECK_SHARE, yaw * NECK_SHARE, 0));
      neck.quaternion.copy(rest.neck).multiply(q);
      q.setFromEuler(euler.set(pitch * HEAD_SHARE, yaw * HEAD_SHARE, 0));
      head.quaternion.copy(rest.head).multiply(q);

      // GNM internal FK mirrors the same split — the mesh twists through
      // GNM's own skinning weights (skull follows fully, skirt fades out).
      driveGnmJoint(gnm.neckIndex, pitch * NECK_SHARE, yaw * NECK_SHARE);
      driveGnmJoint(gnm.headIndex, pitch * HEAD_SHARE, yaw * HEAD_SHARE);
    },
  };
  return rig;
}

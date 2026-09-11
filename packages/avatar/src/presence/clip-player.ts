/**
 * Plays a retargeted clip onto the rig — compositor layer one, exclusively.
 *
 * EXCLUSIVE MEANS EXCLUSIVE. The pose-compositor rule is one writer per
 * joint, and `HumanoPresence` restores-and-writes every frame; a player
 * running beside it would be the whichever-runs-second-wins bug the skill
 * names. Until the blend layer exists, a stage runs the presence OR a clip,
 * never both — the ownership table makes a violation a build error, and this
 * module refuses to be constructed over bones a live presence owns by taking
 * the scene, not the presence.
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
 * SOT: .claude/skills/pose-compositor/SKILL.md · tools/retarget_staystill.mjs
 * SOT-KEYWORDS: clip player layer one retarget staystill exclusive twins slerp loop
 */
import * as THREE from 'three';
import { sanitizeNodeName } from './humano.ts';

export interface RetargetedClip {
  readonly fps: number;
  readonly frames: number;
  readonly source: string;
  readonly joints: Record<string, readonly [number, number, number, number][]>;
  readonly root: { readonly translation: readonly [number, number, number][] };
  readonly translations: Record<string, readonly [number, number, number][]>;
}

export interface ClipPlayer {
  /** Writes the pose for `timeS` onto the bones. Loops past the end. */
  apply(timeS: number): void;
  /** Puts every touched bone back exactly where the clip found it. */
  release(): void;
  readonly durationS: number;
  /** Joints named by the clip that the scene could not resolve. */
  readonly unresolved: readonly string[];
}

export function createClipPlayer(scene: THREE.Object3D, clip: RetargetedClip): ClipPlayer {
  const find = (name: string): THREE.Bone | null =>
    (scene.getObjectByName(name) ?? scene.getObjectByName(sanitizeNodeName(name))) as THREE.Bone | null;

  const unresolved: string[] = [];
  const rotation = Object.entries(clip.joints).flatMap(([name, frames]) => {
    const bone = find(name);
    if (!bone) {
      unresolved.push(name);
      return [];
    }
    return [{ bone, frames, rest: bone.quaternion.clone() }];
  });
  const translation = Object.entries(clip.translations).flatMap(([name, frames]) => {
    const bone = find(name);
    return bone ? [{ bone, frames, rest: bone.position.clone() }] : [];
  });
  const rootBone = find('DEF-spine');
  const rootRest = rootBone ? rootBone.position.clone() : null;

  const a = new THREE.Quaternion();
  const b = new THREE.Quaternion();

  const sample = (timeS: number): { i0: number; i1: number; t: number } => {
    const frame = ((timeS * clip.fps) % clip.frames + clip.frames) % clip.frames;
    const i0 = Math.floor(frame);
    return { i0, i1: (i0 + 1) % clip.frames, t: frame - i0 };
  };

  return {
    durationS: clip.frames / clip.fps,
    unresolved,
    apply(timeS) {
      const { i0, i1, t } = sample(timeS);
      for (const track of rotation) {
        a.fromArray(track.frames[i0]!);
        b.fromArray(track.frames[i1]!);
        track.bone.quaternion.copy(a.slerp(b, t));
      }
      for (const track of translation) {
        const p0 = track.frames[i0]!;
        const p1 = track.frames[i1]!;
        track.bone.position.set(
          p0[0] + (p1[0] - p0[0]) * t,
          p0[1] + (p1[1] - p0[1]) * t,
          p0[2] + (p1[2] - p0[2]) * t,
        );
      }
      if (rootBone && rootRest) {
        const p0 = clip.root.translation[i0]!;
        const p1 = clip.root.translation[i1]!;
        rootBone.position.set(
          rootRest.x + p0[0] + (p1[0] - p0[0]) * t,
          rootRest.y + p0[1] + (p1[1] - p0[1]) * t,
          rootRest.z + p0[2] + (p1[2] - p0[2]) * t,
        );
      }
    },
    release() {
      for (const track of rotation) track.bone.quaternion.copy(track.rest);
      for (const track of translation) track.bone.position.copy(track.rest);
      if (rootBone && rootRest) rootBone.position.copy(rootRest);
    },
  };
}

/**
 * The clip player on the REAL hierarchy, held to the same gates as the live
 * presence — a clip that detaches the eyes or skates the feet is not "motion
 * data", it is the two-chain bug with a corpus behind it.
 *
 * SOT: ./clip-player.ts · ./feet.test.ts (the gates) · tools/retarget_staystill.mjs
 * SOT-KEYWORDS: clip player test eyes attached toe skate knees release loop
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { createClipPlayer, type RetargetedClip } from './clip-player.ts';

// CLIP_PATH env var points the suite at another retargeted clip (the curated
// set from `--all-curated`); unset, it is the original wei_lr gate unchanged.
const CLIP_PATH = process.env.CLIP_PATH ?? '/tmp/staystill_wei_lr.clip.json';

function buildRealScene(): { root: THREE.Group; byName: Map<string, THREE.Bone> } {
  const gltf = JSON.parse(
    readFileSync(new URL('../../assets/natalie-phone/natalie.gltf', import.meta.url), 'utf8'),
  ) as { nodes: { name: string; children?: number[]; translation?: number[]; rotation?: number[] }[] };
  const bones = gltf.nodes.map((node) => {
    const bone = new THREE.Bone();
    bone.name = node.name;
    if (node.translation) bone.position.fromArray(node.translation);
    if (node.rotation) bone.quaternion.fromArray(node.rotation as [number, number, number, number]);
    return bone;
  });
  const root = new THREE.Group();
  const hasParent = new Set<number>();
  gltf.nodes.forEach((node, i) => {
    for (const child of node.children ?? []) {
      bones[i]!.add(bones[child]!);
      hasParent.add(child);
    }
  });
  bones.forEach((bone, i) => {
    if (!hasParent.has(i)) root.add(bone);
  });
  root.updateMatrixWorld(true);
  return { root, byName: new Map(bones.map((bone) => [bone.name, bone])) };
}

/*
  The clip is regenerated, not committed (286 KB of corpus derivative; the
  ledger's pipeline-source rule). When it is absent the suite SKIPS loudly
  rather than passing vacuously — `node tools/retarget_staystill.mjs`
  recreates it in seconds.
*/
describe('clip player on the shipped rig', { skip: !existsSync(CLIP_PATH) && 'run tools/retarget_staystill.mjs first' }, () => {
  const clip = existsSync(CLIP_PATH)
    ? (JSON.parse(readFileSync(CLIP_PATH, 'utf8')) as RetargetedClip)
    : null;

  it('resolves every joint the clip names', () => {
    const { root } = buildRealScene();
    const player = createClipPlayer(root, clip!);
    assert.deepEqual(player.unresolved, []);
  });

  // Green since the retargeter composes each emitted local top-down against
  // its real glTF parent chain and emits the root track as a delta from rest.
  it('keeps the eyes in the head and the arms on the chest through the whole take', () => {
    const { root, byName } = buildRealScene();
    const player = createClipPlayer(root, clip!);
    const head = byName.get('DEF-spine.006')!;
    const eye = byName.get('DEF-eye.L')!;
    const chest = byName.get('DEF-spine.003')!;
    const arm = byName.get('DEF-upper_arm.L')!;
    const inFrame = (frame: THREE.Bone, of: THREE.Bone) =>
      frame.worldToLocal(of.getWorldPosition(new THREE.Vector3()));
    root.updateMatrixWorld(true);
    const eyeRest = inFrame(head, eye);
    const armRest = inFrame(chest, arm);
    let worstEye = 0;
    let worstArm = 0;
    for (let f = 0; f < clip!.frames; f += 1) {
      player.apply(f / clip!.fps);
      root.updateMatrixWorld(true);
      worstEye = Math.max(worstEye, inFrame(head, eye).distanceTo(eyeRest));
      worstArm = Math.max(worstArm, inFrame(chest, arm).distanceTo(armRest));
    }
    // The two-chain bug measures in centimetres when present; these are noise.
    assert.ok(worstEye < 0.001, `eye drifted ${(worstEye * 1000).toFixed(2)} mm in the head frame`);
    assert.ok(worstArm < 0.001, `arm root drifted ${(worstArm * 1000).toFixed(2)} mm in the chest frame`);
  });

  /*
    NON-VACUOUS WITHOUT BEING WEI-SPECIFIC. This asserted hip travel > 0.3 m,
    "the take is 41.5" — true of the balance shifts and impossible for any
    calm idle, so all five curated idles were correctly excluded by a floor
    that was really about one clip. The principled check is internal
    consistency: the SCENE's hip travel must match the extent of the clip's
    own root track. That is the exact class the 913 mm bug was — player and
    data disagreeing about the root convention — and it is equally strict for
    a 42 cm shift and a 5 cm idle, while a zeroed or offset root still fails.
  */
  it('moves the hips exactly the clip distance without teleporting between frames', () => {
    const { root, byName } = buildRealScene();
    const player = createClipPlayer(root, clip!);
    const hip = byName.get('DEF-spine')!;
    const xs = clip!.root.translation.map((p) => p[0]);
    const expected = Math.max(...xs) - Math.min(...xs);
    let minX = Infinity;
    let maxX = -Infinity;
    let previous: number | null = null;
    let worstStep = 0;
    for (let f = 0; f < clip!.frames * 2; f += 1) {
      player.apply(f / (clip!.fps * 2));
      root.updateMatrixWorld(true);
      const x = hip.getWorldPosition(new THREE.Vector3()).x;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      if (previous !== null) worstStep = Math.max(worstStep, Math.abs(x - previous));
      previous = x;
    }
    const measured = maxX - minX;
    assert.ok(
      Math.abs(measured - expected) < 0.002,
      `scene hip travelled ${(measured * 100).toFixed(1)} cm, the clip's root track says ${(expected * 100).toFixed(1)} cm`,
    );
    assert.ok(worstStep < 0.05, `hip jumped ${(worstStep * 100).toFixed(1)} cm in one half-frame`);
  });

  /*
    THE FOOT-CONTACT GATE. The retargeter marks the frames it GUARANTEES
    planted (`contacts`: per-foot inclusive frame windows, the fully-locked
    interiors of the source-stationary phases — see the FOOT-CONTACT LOCKING
    header in tools/retarget_staystill.mjs). The player needs no change:
    contacts are data this test reads back through the real player. Two
    claims: inside a marked window the toe's world horizontal position holds
    its window-entry position to under 5 mm (skate is what the retarget ADDS
    — a pinned toe that still wanders means the lock solve and the player
    disagree about FK, the same class as the 913 mm root bug); and nowhere —
    locked, unlocked, ease ramps, or the loop seam — does a toe move 3 cm in
    a half frame (a lock that pops at its edges would fail exactly here).
  */
  it('keeps marked planted toes pinned and never pops a foot', () => {
    type Contacts = Record<'L' | 'R', readonly [number, number][]>;
    const contacts = (clip as RetargetedClip & { contacts?: Contacts }).contacts;
    assert.ok(contacts, 'clip carries no contact windows — regenerate with tools/retarget_staystill.mjs');
    const { root, byName } = buildRealScene();
    const player = createClipPlayer(root, clip!);
    const world = (bone: THREE.Bone) => {
      root.updateMatrixWorld(true);
      return bone.getWorldPosition(new THREE.Vector3());
    };
    for (const side of ['L', 'R'] as const) {
      const toe = byName.get(`DEF-toe.${side}`)!;
      for (const [start, end] of contacts[side]) {
        player.apply(start / clip!.fps);
        const entry = world(toe);
        for (let f = start; f <= end; f += 1) {
          player.apply(f / clip!.fps);
          const p = world(toe);
          const drift = Math.hypot(p.x - entry.x, p.z - entry.z);
          assert.ok(
            drift < 0.005,
            `${side} toe drifted ${(drift * 1000).toFixed(2)} mm at frame ${f} of contact window [${start}, ${end}]`,
          );
        }
      }
      let previous: THREE.Vector3 | null = null;
      let worstStep = 0;
      for (let f = 0; f < clip!.frames * 2; f += 1) {
        player.apply(f / (clip!.fps * 2));
        const p = world(toe);
        if (previous) worstStep = Math.max(worstStep, p.distanceTo(previous));
        previous = p;
      }
      assert.ok(worstStep < 0.03, `${side} toe stepped ${(worstStep * 100).toFixed(1)} cm in one half-frame`);
    }
  });

  it('release puts every bone back exactly', () => {
    const { root, byName } = buildRealScene();
    const before = new Map(
      [...byName.values()].map((bone) => [bone.name, bone.quaternion.toArray().join(',') + '|' + bone.position.toArray().join(',')]),
    );
    const player = createClipPlayer(root, clip!);
    player.apply(3.7);
    player.release();
    for (const bone of byName.values()) {
      assert.equal(
        bone.quaternion.toArray().join(',') + '|' + bone.position.toArray().join(','),
        before.get(bone.name),
        `${bone.name} did not come back to rest`,
      );
    }
  });
});

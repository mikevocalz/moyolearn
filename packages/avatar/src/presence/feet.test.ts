/**
 * The feet stay planted while the body moves — asserted on the REAL rig
 * hierarchy, because the synthetic flat scene cannot express the failure.
 *
 * The gate is the turn-4 rule "foot slide = 0", and it took three attempts to
 * hold, each caught by measuring: knee-only flexion slid the toes 106 mm; a
 * two-link solve preserving foot orientation left 27 mm because the ankle
 * correction arcs the toe; and the exact three-link solve still read 72 mm
 * while its maths was internally perfect, because parent-space child offsets
 * were being fed into a world-plane model. World rest deltas land at 0.46 mm,
 * which is skin-blend residual, not slide.
 *
 * Slide is measured at the CONTACT POINT. The ankle arcs backward and up when
 * a heel rises over a pinned toe — that is heel-rise geometry, and counting it
 * condemned a correct solve.
 *
 * SOT: ./humano.ts (the planted-foot solve) · rig-axes.test.ts (the builder)
 * SOT-KEYWORDS: feet planted foot slide toe contact three link solve stance real hierarchy
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { createHumanoPresence } from './humano.ts';

function buildRealScene(): { root: THREE.Group; byName: Map<string, THREE.Bone> } {
  const gltf = JSON.parse(
    readFileSync(new URL('../../assets/natalie-phone/natalie.gltf', import.meta.url), 'utf8'),
  ) as { nodes: { name: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[] };
  const bones = gltf.nodes.map((node) => {
    const bone = new THREE.Bone();
    bone.name = node.name;
    if (node.translation) bone.position.fromArray(node.translation);
    if (node.rotation) bone.quaternion.fromArray(node.rotation as [number, number, number, number]);
    if (node.scale) bone.scale.fromArray(node.scale);
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

const buildRealScene2 = (() => {
  const { root, byName } = buildRealScene();
  const ankles = [byName.get('DEF-foot.L')!, byName.get('DEF-foot.R')!];
  root.updateMatrixWorld(true);
  return { root, ankles, rest: ankles.map((a) => a.getWorldPosition(new THREE.Vector3()).y) };
})();

describe('planted feet on the shipped rig', () => {
  it('the toes never slide while the hips travel', () => {
    const { root, byName } = buildRealScene();
    const presence = createHumanoPresence(root, { seed: 7 });
    const toes = [byName.get('DEF-toe.L')!, byName.get('DEF-toe.R')!];
    const hip = byName.get('DEF-spine')!;
    root.updateMatrixWorld(true);
    const rest = toes.map((toe) => toe.getWorldPosition(new THREE.Vector3()));
    const hipRest = hip.getWorldPosition(new THREE.Vector3()).x;
    let worstSlide = 0;
    let hipTravel = 0;
    for (let i = 0; i < 60 * 60; i += 1) {
      presence.step(1 / 60, { speaking: false, mouth: 0, reducedMotion: false });
      root.updateMatrixWorld(true);
      toes.forEach((toe, k) => {
        const delta = toe.getWorldPosition(new THREE.Vector3()).sub(rest[k]!);
        worstSlide = Math.max(worstSlide, Math.hypot(delta.x, delta.z));
      });
      hipTravel = Math.max(hipTravel, Math.abs(hip.getWorldPosition(new THREE.Vector3()).x - hipRest));
    }
    // Heel rise: the unloaded ankle lifts while its toe stays pinned — the
    // observable that replaced asserting a foot-bone rotation.
    let heelRise = 0;
    const ankles = [byName.get('DEF-foot.L')!, byName.get('DEF-foot.R')!];
    const ankleRest = ankles.map((a) => a.getWorldPosition(new THREE.Vector3()).y);
    // (captured above the loop would be cleaner; a second short run keeps the
    // first loop's shape untouched)
    const presence2 = createHumanoPresence(buildRealScene2.root, { seed: 11 });
    for (let i = 0; i < 30 * 60; i += 1) {
      presence2.step(1 / 60, { speaking: false, mouth: 0, reducedMotion: false });
      buildRealScene2.root.updateMatrixWorld(true);
      buildRealScene2.ankles.forEach((ankle, k) => {
        heelRise = Math.max(heelRise, ankle.getWorldPosition(new THREE.Vector3()).y - buildRealScene2.rest[k]!);
      });
    }
    assert.ok(heelRise > 0.002, `no heel ever rose (max ${(heelRise * 1000).toFixed(2)} mm) — the unweight is decorative`);

    // The gate has to be non-vacuous: a run where nothing moved proves nothing.
    assert.ok(hipTravel > 0.02, `hips only travelled ${(hipTravel * 1000).toFixed(1)} mm — the shift never fired`);
    assert.ok(
      worstSlide < 0.002,
      `a toe slid ${(worstSlide * 1000).toFixed(2)} mm horizontally — the feet are not planted`,
    );
  });
});

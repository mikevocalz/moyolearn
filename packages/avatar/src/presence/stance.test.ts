/**
 * The legs answer the pelvis, and no pose is ever mirrored.
 *
 * SYMMETRY IS MEASURED ACROSS THE POSE, NOT PER JOINT, and that distinction was
 * forced by the data. Giving the knees a constant left-right offset does not
 * stop them crossing — the difference is an affine function of the load, so it
 * passes through zero wherever the constant cancels the split, just at a
 * different load than before. 873 frames in 7200 had identical knees; adding
 * the offset moved that to a different 873.
 *
 * What §9 forbids is a mirrored POSE. The elbow and shoulder asymmetries do not
 * depend on load at all, so the body is never a reflection of itself even in
 * the instant two knees agree. That is the quantity worth gating, and it is
 * what the symmetry index below sums.
 *
 * SOT: ./humano.ts · ../idle/config.ts `body.stance`
 * SOT-KEYWORDS: stance contrapposto legs knee ankle weight shift symmetry index reduced motion
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { idleConfig } from '../idle/config.ts';
import { HUMANO_BONES, TWINS, createHumanoPresence, sanitizeNodeName } from './humano.ts';

const DT = 1 / 60;
const DEG = 180 / Math.PI;

function makeScene(): THREE.Group {
  const scene = new THREE.Group();
  const names = [...new Set([...Object.values(HUMANO_BONES), ...Object.values(TWINS)])].filter(
    (n): n is string => typeof n === 'string',
  );
  const bones = names.map((name) => {
    const bone = new THREE.Bone();
    bone.name = sanitizeNodeName(name);
    bone.position.set(0, 1.5, 0);
    scene.add(bone);
    return bone;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  mesh.bind(new THREE.Skeleton(bones));
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  return scene;
}

const PAIRS: readonly (readonly [string, string])[] = [
  [HUMANO_BONES.shinL, HUMANO_BONES.shinR],
  [HUMANO_BONES.footL, HUMANO_BONES.footR],
  [HUMANO_BONES.foreArmL, HUMANO_BONES.foreArmR],
  [HUMANO_BONES.upperArmL, HUMANO_BONES.upperArmR],
  [HUMANO_BONES.shoulderL, HUMANO_BONES.shoulderR],
];

/** Run `seconds` of quiet idle and return a sample per frame. */
function run(seconds: number): { symmetry: number[]; kneeL: number[]; kneeR: number[]; footFlexed: number } {
  const scene = makeScene();
  const presence = createHumanoPresence(scene, { seed: 7 });
  const at = (name: string) => scene.getObjectByName(sanitizeNodeName(name)) as THREE.Bone;
  const pairs = PAIRS.map(([l, r]) => [at(l), at(r)] as const);
  const shinL = at(HUMANO_BONES.shinL);
  const shinR = at(HUMANO_BONES.shinR);
  const footL = at(HUMANO_BONES.footL);
  const footR = at(HUMANO_BONES.footR);
  const symmetry: number[] = [];
  const kneeL: number[] = [];
  const kneeR: number[] = [];
  let footFlexed = 0;
  for (let i = 0; i < seconds * 60; i += 1) {
    presence.step(DT, { speaking: false, mouth: 0, reducedMotion: false });
    let sum = 0;
    for (const [left, right] of pairs) {
      sum +=
        Math.abs(left.rotation.x - right.rotation.x) +
        Math.abs(left.rotation.y - right.rotation.y) +
        // z mirrors across the body, so magnitudes are what compare.
        Math.abs(Math.abs(left.rotation.z) - Math.abs(right.rotation.z));
    }
    symmetry.push(sum * DEG);
    kneeL.push(shinL.rotation.x * DEG);
    kneeR.push(shinR.rotation.x * DEG);
    if (Math.abs(footL.rotation.x) > 1e-6 || Math.abs(footR.rotation.x) > 1e-6) footFlexed += 1;
  }
  return { symmetry, kneeL, kneeR, footFlexed };
}

describe('contrapposto stance', () => {
  const sample = run(120);

  it('the knees answer the weight — they are not held at one angle', () => {
    const travel = Math.max(...sample.kneeL) - Math.min(...sample.kneeL);
    assert.ok(travel > 5, `the left knee moved ${travel.toFixed(2)}° over two minutes`);
    // Within the range a relaxed stance actually uses, not a crouch.
    assert.ok(Math.max(...sample.kneeL) < 25, `knee reached ${Math.max(...sample.kneeL).toFixed(1)}°`);
    assert.ok(Math.min(...sample.kneeL) > -1, `knee hyperextended to ${Math.min(...sample.kneeL).toFixed(1)}°`);
  });

  it('the free heel unweights — the feet are not decorative', () => {
    const fraction = sample.footFlexed / sample.kneeL.length;
    assert.ok(fraction > 0.5, `a foot was plantarflexed in only ${(fraction * 100).toFixed(0)}% of frames`);
  });

  it('the pose is never a mirror of itself', () => {
    const worst = Math.min(...sample.symmetry);
    assert.ok(worst > 1, `symmetry index fell to ${worst.toFixed(2)}° — that frame is a mirrored pose`);
  });

  it('reduced motion pins the transition and KEEPS the asymmetry', () => {
    /*
      Flattening to a symmetric stance under reduced motion would trade the
      anti-mannequin property for no vestibular benefit — a static pose is not
      motion. What is pinned is the travel.
    */
    const scene = makeScene();
    const presence = createHumanoPresence(scene, { seed: 7 });
    const at = (name: string) => scene.getObjectByName(sanitizeNodeName(name)) as THREE.Bone;
    const angles: number[] = [];
    for (let i = 0; i < 300; i += 1) {
      presence.step(DT, { speaking: false, mouth: 0, reducedMotion: true });
      angles.push(at(HUMANO_BONES.shinL).rotation.x * DEG);
    }
    const held = Math.max(...angles) - Math.min(...angles);
    assert.ok(held < 0.01, `the knee still travelled ${held.toFixed(3)}° under reduced motion`);
    const split =
      Math.abs(at(HUMANO_BONES.shinL).rotation.x - at(HUMANO_BONES.shinR).rotation.x) * DEG;
    assert.ok(
      Math.abs(split - 2 * idleConfig.body.stance.kneeBaseSplitDeg) < 0.01,
      `the knees flattened to ${split.toFixed(2)}° apart — the stance asymmetry was lost, not the motion`,
    );
  });
});

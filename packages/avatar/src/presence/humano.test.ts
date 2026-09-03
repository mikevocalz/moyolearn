/**
 * The presence driver's decisions, on a synthetic rig.
 *
 * The reason this is testable at all is that the module takes an openness
 * scalar and a scene, and produces bone rotations and morph weights — no
 * renderer, no audio clock, no frame source. So the checks worth having are the
 * ones that broke the web scene while it was being written: a mouth that is
 * only a jaw hinge, morphs that never decay, a gaze that ignores the camera,
 * and a bone lookup that misses every dotted Rigify name.
 *
 * SOT: ./humano.ts
 * SOT-KEYWORDS: humano presence test morph bone gaze lip idle reduced-motion
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { DEFAULT_GESTURE_LIMITS } from '../safety/gesture-gate.ts';
import {
  HUMANO_BONES,
  STANCE,
  createHumanoPresence,
  gazeMorphs,
  lipFromOpenness,
  sanitizeNodeName,
} from './humano.ts';

const MORPHS = [
  'jawOpen',
  'mouthClose',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthFunnel',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeWideLeft',
  'eyeWideRight',
  'eyeLookUpLeft',
  'eyeLookUpRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookOutLeft',
  'eyeLookInRight',
  'eyeLookOutRight',
  'browInnerUp',
];

/** A rig with the Rigify names as the LOADER leaves them: dots stripped. */
function makeScene(): { scene: THREE.Group; mesh: THREE.SkinnedMesh } {
  const scene = new THREE.Group();
  const bones: THREE.Bone[] = [];
  for (const name of Object.values(HUMANO_BONES)) {
    const bone = new THREE.Bone();
    bone.name = sanitizeNodeName(name);
    bone.position.set(0, 1.5, 0);
    scene.add(bone);
    bones.push(bone);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
  );
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  mesh.bind(new THREE.Skeleton(bones));
  mesh.morphTargetDictionary = Object.fromEntries(MORPHS.map((n, i) => [n, i]));
  mesh.morphTargetInfluences = new Array(MORPHS.length).fill(0);
  scene.add(mesh);
  scene.updateMatrixWorld(true);
  return { scene, mesh };
}

const weight = (mesh: THREE.SkinnedMesh, name: string): number =>
  mesh.morphTargetInfluences![mesh.morphTargetDictionary![name]!]!;

const QUIET = { speaking: false, mouth: 0, reducedMotion: false } as const;

describe('lipFromOpenness', () => {
  it('opens the lips, not just the jaw — a hinge alone reads as a mask', () => {
    const open = lipFromOpenness(1);
    assert.ok(open.jawOpen > 0.5);
    assert.ok(open.mouthLowerDownLeft > 0);
    assert.ok(open.mouthUpperUpLeft > 0);
  });

  it('is silent at zero and clamps past one', () => {
    assert.equal(lipFromOpenness(0).jawOpen, 0);
    assert.deepEqual(lipFromOpenness(4), lipFromOpenness(1));
    assert.deepEqual(lipFromOpenness(-1), lipFromOpenness(0));
  });
});

describe('gazeMorphs', () => {
  it('splits a direction into the one-sided ARKit pairs', () => {
    const right = gazeMorphs(1, 0);
    assert.equal(right.eyeLookInLeft, 0);
    assert.ok(right.eyeLookOutLeft! > 0);
    assert.equal(right.eyeLookUpLeft, 0);
    assert.equal(right.eyeLookDownLeft, 0);
  });

  it('saturates rather than overshooting a full weight', () => {
    assert.equal(gazeMorphs(Math.PI, 0).eyeLookOutLeft, 1);
    assert.equal(gazeMorphs(0, -Math.PI).eyeLookDownLeft, 1);
  });
});

describe('createHumanoPresence', () => {
  it('finds the dotted Rigify bones under the loader-sanitised names', () => {
    const { scene, mesh } = makeScene();
    const presence = createHumanoPresence(scene);
    const head = scene.getObjectByName(sanitizeNodeName(HUMANO_BONES.head))!;
    presence.step(1 / 60, { ...QUIET, speaking: true, mouth: 1 });
    // 30 frames is past the mouth's rise constant, so the mouth is open and
    // the head has dipped with it (there is no weighted jaw bone on this rig).
    for (let i = 0; i < 30; i++) presence.step(1 / 60, { ...QUIET, speaking: true, mouth: 1 });
    assert.ok(head.rotation.x > 0.015, `head did not dip with the open mouth: ${head.rotation.x}`);
    assert.ok(weight(mesh, 'jawOpen') > 0.3);
  });

  it('writes the A2F face when one is given, and keeps the blink from the engine', () => {
    const { scene, mesh } = makeScene();
    const presence = createHumanoPresence(scene);
    presence.step(1 / 60, {
      ...QUIET,
      speaking: true,
      mouth: 1,
      face: { browInnerUp: 0.7, jawOpen: 0.2, mouthSmileLeft: 0.4 },
    });
    assert.equal(weight(mesh, 'browInnerUp'), 0.7);
    assert.equal(weight(mesh, 'jawOpen'), 0.2);
    // The openness-derived lips are NOT layered on top of a real face.
    assert.equal(weight(mesh, 'mouthFunnel'), 0);
  });

  it('holds the emotion baseline under speech by per-channel max', () => {
    const { scene, mesh } = makeScene();
    const presence = createHumanoPresence(scene);
    for (let i = 0; i < 30; i++) {
      presence.step(1 / 60, { ...QUIET, speaking: true, mouth: 1, emotion: { mouthSmileLeft: 0.5, browInnerUp: 0.1 } });
    }
    assert.ok(weight(mesh, 'mouthSmileLeft') >= 0.5, 'the tone smile lost to the viseme smile');
    // A beat may add its brow accent on top; the baseline is a floor, not a value.
    assert.ok(weight(mesh, 'browInnerUp') >= 0.1);
  });

  it('never produces a forbidden read: lean and reach stay inside the firewall over ten minutes', () => {
    const { scene } = makeScene();
    const presence = createHumanoPresence(scene);
    let maxLean = 0;
    let maxReach = 0;
    for (let i = 0; i < 600 * 60; i++) {
      const t = i / 60;
      presence.step(1 / 60, {
        ...QUIET,
        speaking: t % 30 > 12,
        mouth: t % 30 > 12 ? 0.5 + 0.5 * Math.sin(t * 9) : 0,
        phase: t % 30 > 12 ? 'speaking' : t % 30 > 8 ? 'thinking' : 'listening',
        partnerPauseEvent: Math.abs((t % 30) - 8) < 1 / 120,
      });
      maxLean = Math.max(maxLean, presence.firewall.torsoLeanRad);
      maxReach = Math.max(maxReach, presence.firewall.shoulderFlexionRad);
    }
    assert.ok(maxLean <= DEFAULT_GESTURE_LIMITS.maxTorsoLeanRad, `torso leaned ${maxLean} rad`);
    assert.ok(maxReach <= DEFAULT_GESTURE_LIMITS.maxShoulderFlexionRad, `reached ${maxReach} rad`);
  });

  it('decays the mouth back to silence when the voice stops', () => {
    const { scene, mesh } = makeScene();
    const presence = createHumanoPresence(scene);
    for (let i = 0; i < 30; i++) presence.step(1 / 60, { ...QUIET, speaking: true, mouth: 1 });
    for (let i = 0; i < 120; i++) presence.step(1 / 60, QUIET);
    assert.ok(weight(mesh, 'jawOpen') < 0.02, `mouth hung open: ${weight(mesh, 'jawOpen')}`);
  });

  it('reduced motion writes no mouth and no arm lift', () => {
    const { scene, mesh } = makeScene();
    const presence = createHumanoPresence(scene);
    const arm = scene.getObjectByName(sanitizeNodeName(HUMANO_BONES.foreArmL))!;
    for (let i = 0; i < 60; i++) {
      presence.step(1 / 60, { speaking: true, mouth: 1, reducedMotion: true });
    }
    assert.equal(weight(mesh, 'jawOpen'), 0);
    // The STANCE stays — a pose is not motion, and reduced motion should not
    // put her back to the asset's arms-flat-to-the-thighs mannequin. What it
    // suppresses is the LIFT on top of it, which is the travel.
    assert.ok(Math.abs(arm.rotation.x - STANCE.elbowBend) < 1e-9, `${arm.rotation.x}`);
  });

  it('aims the eyes at the camera rather than past it', () => {
    const { scene, mesh } = makeScene();
    const presence = createHumanoPresence(scene);
    presence.step(1 / 60, {
      ...QUIET,
      cameraPosition: new THREE.Vector3(5, 1.5, 0.001),
    });
    // She faces +Z, so a camera at +X is off her LEFT shoulder: the left eye
    // rotates temporally (OUT) and the right eye nasally (IN).
    assert.ok(weight(mesh, 'eyeLookOutLeft') > 0.5);
    assert.ok(weight(mesh, 'eyeLookInRight') > 0.5);
    assert.equal(weight(mesh, 'eyeLookInLeft'), 0);
  });

  it('rest() puts every bone back and clears every morph', () => {
    const { scene, mesh } = makeScene();
    const presence = createHumanoPresence(scene);
    const head = scene.getObjectByName(sanitizeNodeName(HUMANO_BONES.head))!;
    for (let i = 0; i < 60; i++) presence.step(1 / 60, { ...QUIET, speaking: true, mouth: 0.8 });
    presence.rest();
    assert.equal(head.rotation.x, 0);
    assert.ok(mesh.morphTargetInfluences!.every((v) => v === 0));
  });
});

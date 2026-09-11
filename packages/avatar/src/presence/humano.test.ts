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
  stanceElbow,
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
    // Articulation and head pose are independent: opening the mouth must not
    // force the skull to bob on every vowel.
    for (let i = 0; i < 30; i++) presence.step(1 / 60, { ...QUIET, speaking: true, mouth: 1 });
    assert.ok(Number.isFinite(head.rotation.x));
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

  it('reduced motion preserves articulation while pinning the arms', () => {
    const { scene, mesh } = makeScene();
    const presence = createHumanoPresence(scene);
    const arm = scene.getObjectByName(sanitizeNodeName(HUMANO_BONES.foreArmL))!;
    for (let i = 0; i < 60; i++) {
      presence.step(1 / 60, { speaking: true, mouth: 1, reducedMotion: true });
    }
    assert.ok(weight(mesh, 'jawOpen') > 0.3);
    /*
      The STANCE stays — a pose is not motion, and reduced motion should not put
      her back to the asset's arms-flat-to-the-thighs mannequin. What it
      suppresses is the LIFT on top of it, which is the travel.

      Per SIDE, because the stance is no longer mirror-symmetric: the left arm
      carries `+asymmetry.elbow` and the right `-`. Asserting the bare
      `elbowBend` here would pass only while both elbows held the same angle,
      which is the thing that read as robotic.
    */
    const left = stanceElbow('L');
    assert.ok(Math.abs(arm.rotation.x - left) < 1e-9, `${arm.rotation.x} vs ${left}`);
    const right = scene.getObjectByName(sanitizeNodeName(HUMANO_BONES.foreArmR))!;
    assert.ok(
      Math.abs(right.rotation.x - stanceElbow('R')) < 1e-9,
      `right forearm ${right.rotation.x}`,
    );
    assert.notEqual(arm.rotation.x, right.rotation.x, 'both elbows at one angle is the mannequin');
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

  it('does not schedule repeated arm beats during continuous phonation', () => {
    const { scene } = makeScene();
    const presence = createHumanoPresence(scene, { seed: 7 });
    for (let i = 0; i < 30 * 60; i++) {
      presence.step(1 / 60, { ...QUIET, speaking: true, mouth: 0.6 });
      if (i < 3 * 60) continue;
      for (const side of ['L', 'R'] as const) {
        const arm = scene.getObjectByName(
          sanitizeNodeName(side === 'L' ? HUMANO_BONES.foreArmL : HUMANO_BONES.foreArmR),
        )!;
        assert.ok(Math.abs(arm.rotation.x - stanceElbow(side)) < 0.002,
          `timer-driven beat at ${i / 60}s`);
      }
    }
  });

  it('a new phrase can gesture after a gap, without constant two-arm lift', () => {
    const { scene } = makeScene();
    const presence = createHumanoPresence(scene, { seed: 7 });
    let peak = 0;
    for (let i = 0; i < 8 * 60; i++) {
      const t = i / 60;
      presence.step(1 / 60, { ...QUIET, speaking: true, mouth: t >= 6 && t < 6.5 ? 0 : 0.6 });
      const l = scene.getObjectByName(sanitizeNodeName(HUMANO_BONES.foreArmL))!.rotation.x - stanceElbow('L');
      const r = scene.getObjectByName(sanitizeNodeName(HUMANO_BONES.foreArmR))!.rotation.x - stanceElbow('R');
      assert.ok(Math.min(Math.abs(l), Math.abs(r)) < 0.002, 'both arms lifted together');
      if (t > 6.5) peak = Math.max(peak, l, r);
    }
    assert.ok(peak > 0.015, 'fresh phrase did not produce a gesture');
  });

  it('mouth opening does not rotate the head', () => {
    const a = makeScene();
    const b = makeScene();
    const pa = createHumanoPresence(a.scene, { seed: 7 });
    const pb = createHumanoPresence(b.scene, { seed: 7 });
    for (let i = 0; i < 240; i++) {
      pa.step(1 / 60, { ...QUIET, speaking: true, mouth: 0 });
      pb.step(1 / 60, { ...QUIET, speaking: true, mouth: 1 });
      const name = sanitizeNodeName(HUMANO_BONES.head);
      assert.deepEqual(a.scene.getObjectByName(name)!.quaternion.toArray(), b.scene.getObjectByName(name)!.quaternion.toArray());
    }
  });

  it('interruptions settle the arms and do not replay an abandoned stroke', () => {
    const { scene } = makeScene();
    const presence = createHumanoPresence(scene);
    for (let i = 0; i < 24; i++) presence.step(1 / 60, { ...QUIET, speaking: true, mouth: 0.8 });
    for (let i = 0; i < 180; i++) presence.step(1 / 60, QUIET);
    for (const side of ['L', 'R'] as const) {
      const name = side === 'L' ? HUMANO_BONES.foreArmL : HUMANO_BONES.foreArmR;
      assert.ok(
        Math.abs(scene.getObjectByName(sanitizeNodeName(name))!.rotation.x - stanceElbow(side)) < 0.002,
      );
    }
  });

  it('reduced motion keeps blinks alive and ignores a previous body pose', () => {
    const { scene, mesh } = makeScene();
    const presence = createHumanoPresence(scene);
    for (let i = 0; i < 600; i++) presence.step(1 / 60, QUIET);
    let blinks = 0;
    for (let i = 0; i < 60 * 60; i++) {
      presence.step(1 / 60, { ...QUIET, reducedMotion: true });
      if (weight(mesh, 'eyeBlinkLeft') > 0.8) blinks++;
      assert.ok(Math.abs(scene.getObjectByName(sanitizeNodeName(HUMANO_BONES.head))!.rotation.x) < 1e-12);
    }
    assert.ok(blinks > 0, 'reduced motion froze the blink clock');
  });

  it('keeps wrist follow-through bounded at 20 fps and on resume', () => {
    const { scene } = makeScene();
    const presence = createHumanoPresence(scene);
    for (let i = 0; i < 1200; i++) {
      presence.step(i % 100 === 0 ? 8 : 0.05, { ...QUIET, speaking: true, mouth: i % 120 < 20 ? 0 : 0.8 });
      for (const name of [HUMANO_BONES.handL, HUMANO_BONES.handR]) {
        const x = scene.getObjectByName(sanitizeNodeName(name))!.rotation.x;
        assert.ok(Number.isFinite(x) && Math.abs(x) < 0.4, `unstable wrist: ${x}`);
      }
    }
  });
});

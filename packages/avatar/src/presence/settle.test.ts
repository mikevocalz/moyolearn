/**
 * How long the body takes to settle after a barge-in — `interruptSettleMs` in
 * the acceptance record, target 700 ms.
 *
 * MEASURED ON THE ENVELOPE, NOT ON THE POSE, and the difference is the whole
 * reason this file exists. The obvious method — run one presence that stops
 * speaking beside one that never spoke, both on the same seed, and time their
 * reconvergence — does not work here. Speech boosts the blink hazard and
 * shortens saccade intervals, so the two runs consume different draws from the
 * shared stream and never reconverge at all: 0.275° of divergence at the stop
 * against a 0.120° residual floor, and a curve that goes back UP to 130%
 * "recovered" a second later. A threshold crossing on that measures the random
 * stream wandering.
 *
 * This is the BODY half. The audio stopping is `interruptVoiceStopMs`, it lives
 * in `tutor-audio.ts`, and it needs a device.
 *
 * SOT: ./humano.ts · audit/motion/acceptance-record.json
 * SOT-KEYWORDS: settle interrupt barge-in speech envelope acceptance latency presence
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { HUMANO_BONES, TWINS, createHumanoPresence } from './humano.ts';

const DT = 1 / 60;
/** Below this the swell is a fraction of the idle noise it sits on. */
const SETTLED = 0.05;
const TARGET_MS = 700;

function makeScene(): THREE.Group {
  const scene = new THREE.Group();
  const names = [...new Set([...Object.values(HUMANO_BONES), ...Object.values(TWINS)])].filter(
    (n): n is string => typeof n === 'string',
  );
  const bones = names.map((name) => {
    const bone = new THREE.Bone();
    bone.name = name;
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

/** Speak for `speakS`, cut, and return the envelope's decay in milliseconds. */
function settleMs(speakS = 6): { ms: number; atCut: number } {
  const presence = createHumanoPresence(makeScene(), { seed: 7 });
  const speaking = { speaking: true, mouth: 0.4, reducedMotion: false };
  const quiet = { speaking: false, mouth: 0, reducedMotion: false };
  for (let i = 0; i < speakS * 60; i += 1) presence.step(DT, speaking);
  const atCut = presence.speechEnvelope;
  for (let i = 1; i <= 5 * 60; i += 1) {
    presence.step(DT, quiet);
    if (presence.speechEnvelope <= SETTLED) return { ms: i * DT * 1000, atCut };
  }
  return { ms: Infinity, atCut };
}

describe('settle after a barge-in', () => {
  it('the swell is actually up before the cut — otherwise the decay measures nothing', () => {
    const { atCut } = settleMs();
    assert.ok(atCut > 0.9, `envelope was ${atCut.toFixed(3)} at the cut, so there was nothing to settle`);
  });

  it(`settles inside the ${TARGET_MS} ms acceptance target`, () => {
    const { ms } = settleMs();
    assert.ok(ms <= TARGET_MS, `settled in ${ms.toFixed(0)} ms, target ${TARGET_MS} ms`);
  });

  it('does not depend on how long she spoke — a long turn must not settle slower', () => {
    const short = settleMs(2).ms;
    const long = settleMs(20).ms;
    assert.ok(
      Math.abs(short - long) < 50,
      `2 s turn settled in ${short.toFixed(0)} ms, 20 s turn in ${long.toFixed(0)} ms`,
    );
  });

  it('reduced motion is settled from the start — it has no swell to release', () => {
    const presence = createHumanoPresence(makeScene(), { seed: 7 });
    for (let i = 0; i < 120; i += 1) {
      presence.step(DT, { speaking: true, mouth: 0.4, reducedMotion: true });
    }
    assert.ok(presence.speechEnvelope <= SETTLED, `reduced motion built a swell of ${presence.speechEnvelope}`);
  });
});

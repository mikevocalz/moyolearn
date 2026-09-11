// headPitchJawOpenCorrelation: the puppet tell. A marionette's head bobs with
// its jaw because one string drives both; a person's does not. So the head's
// world pitch over 10 minutes of speech must be INDISTINGUISHABLE FROM CHANCE
// against the mouth signal driving the lips.
//
// Setup: the real natalie.gltf bone hierarchy (built the way feet.test.ts and
// artifacts-20min.mts build it), createHumanoPresence seed 7, 60 Hz,
// `speaking: true` throughout, mouth = band-limited value noise at syllable
// rate — random targets 0..1 held for jittered spans of 1/6..1/2 s (2–6 Hz)
// with smoothstep interpolation, seeded mulberry32(101) — a viseme-like
// signal, deliberately NOT a sine, because a sine's autocorrelation would make
// any r estimate a coin flip between ±peak.
//
// Head world pitch: the twist of (headWorldQuat · restWorldQuat⁻¹) about the
// head's REST world lateral (x) axis — pitch specifically, not total angular
// deviation, so yaw drift cannot launder the number.
//
// "Indistinguishable from chance" needs a null, not a small-looking r: the
// mouth series is shuffled in 1 s blocks (60 frames, preserving within-block
// autocorrelation, destroying alignment) 200 times against the SAME head
// series, and the real r is placed in that null two-sided:
// p = (1 + #{|r_null| ≥ |r|}) / 201. The first 2 s are dropped (speech-swell
// rise-in), leaving 35 880 frames = 598 whole blocks.
//
// ENGINE-SIDE: bones in Node, no renderer, no audio clock. A significant |r|
// is a FINDING (the head is bobbing with the jaw), recorded as the value.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createHumanoPresence } from '/Users/mikevocalz/MoyoLearn/packages/avatar/src/presence/humano.ts';
import { mulberry32 } from '/Users/mikevocalz/MoyoLearn/packages/avatar/src/idle/engine.ts';

const DT = 1 / 60;
const MINUTES = 10;
const STEPS = MINUTES * 60 * 60;
const SKIP = 120; // 2 s rise-in
const BLOCK = 60; // 1 s shuffle blocks
const SHUFFLES = 200;

function buildRealScene() {
  const gltf = JSON.parse(
    readFileSync('/Users/mikevocalz/MoyoLearn/packages/avatar/assets/natalie-phone/natalie.gltf', 'utf8'),
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

/** Band-limited value noise: 2–6 Hz jittered spans, smoothstep, clamped 0..1. */
function makeViseme(rand: () => number) {
  let t = 0;
  let span = 1 / 6 + rand() * (1 / 2 - 1 / 6);
  let from = rand();
  let to = rand();
  return (dt: number): number => {
    t += dt;
    while (t >= span) {
      t -= span;
      from = to;
      to = rand();
      span = 1 / 6 + rand() * (1 / 2 - 1 / 6);
    }
    const u = t / span;
    const s = u * u * (3 - 2 * u);
    return Math.min(1, Math.max(0, from + (to - from) * s));
  };
}

function pearson(a: Float64Array, b: Float64Array): number {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i += 1) { ma += a[i]!; mb += b[i]!; }
  ma /= n; mb /= n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i]! - ma, db = b[i]! - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  return cov / Math.sqrt(va * vb);
}

const { root, byName } = buildRealScene();
const presence = createHumanoPresence(root, { seed: 7 });
const head = byName.get('DEF-spine.006')!;
root.updateMatrixWorld(true);

const restWorldQ = head.getWorldQuaternion(new THREE.Quaternion());
const restWorldQInv = restWorldQ.clone().invert();
// The head's lateral axis at rest, in world — the axis pitch happens about.
const pitchAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(restWorldQ).normalize();

const viseme = makeViseme(mulberry32(101));
const q = new THREE.Quaternion();
const delta = new THREE.Quaternion();
const N = STEPS - SKIP;
const headPitch = new Float64Array(N);
const mouthSeries = new Float64Array(N);

for (let i = 0; i < STEPS; i += 1) {
  const mouth = viseme(DT);
  presence.step(DT, { speaking: true, mouth, reducedMotion: false });
  root.updateMatrixWorld(true);
  if (i < SKIP) continue;
  head.getWorldQuaternion(q);
  delta.copy(q).multiply(restWorldQInv);
  // Twist of the world delta about the rest lateral axis: signed pitch.
  const d = delta.x * pitchAxis.x + delta.y * pitchAxis.y + delta.z * pitchAxis.z;
  headPitch[i - SKIP] = 2 * Math.atan2(d, delta.w);
  mouthSeries[i - SKIP] = mouth;
}

const r = pearson(headPitch, mouthSeries);

// Null: shuffle the mouth series in 1 s blocks against the same head series.
const nBlocks = Math.floor(N / BLOCK); // N = 35 880 → 598 whole blocks
const used = nBlocks * BLOCK;
const headTrim = headPitch.subarray(0, used);
const shuffled = new Float64Array(used);
const order = Array.from({ length: nBlocks }, (_, k) => k);
const shufRand = mulberry32(9001);
let extreme = 0;
let nullMin = Infinity, nullMax = -Infinity;
for (let s = 0; s < SHUFFLES; s += 1) {
  for (let k = nBlocks - 1; k > 0; k -= 1) {
    const j = Math.floor(shufRand() * (k + 1));
    const tmp = order[k]!; order[k] = order[j]!; order[j] = tmp;
  }
  for (let k = 0; k < nBlocks; k += 1) {
    shuffled.set(mouthSeries.subarray(order[k]! * BLOCK, order[k]! * BLOCK + BLOCK), k * BLOCK);
  }
  const rs = pearson(headTrim, shuffled);
  if (Math.abs(rs) >= Math.abs(r)) extreme += 1;
  if (rs < nullMin) nullMin = rs;
  if (rs > nullMax) nullMax = rs;
}
const p = (1 + extreme) / (SHUFFLES + 1);

console.log(`${MINUTES} min of speech at 60 Hz, presence seed 7, real natalie.gltf hierarchy, first 2 s dropped`);
console.log(`mouth: band-limited value noise, 2–6 Hz jittered spans, clamped 0..1, mulberry32(101)`);
console.log(`Pearson r(head world pitch, mouth) = ${r.toFixed(4)} over ${used} frames`);
console.log(`null: ${SHUFFLES} shuffles of the mouth series in ${BLOCK}-frame blocks → r ∈ [${nullMin.toFixed(4)}, ${nullMax.toFixed(4)}]`);
console.log(`two-sided p = ${p.toFixed(3)} (${extreme}/${SHUFFLES} null |r| ≥ observed)`);
console.log(
  p > 0.05
    ? `PASS: indistinguishable from chance against the block-shuffle null`
    : `FINDING: the head pitch tracks the jaw beyond chance — the puppet tell`,
);

// torsoEnergyCorrelation: a talking body moves more when the voice carries
// more energy. Target r ≥ 0.5 between torso/shoulder rotational speed and
// speech RMS, at the envelope timescale.
//
// Setup: the real natalie.gltf bone hierarchy (as artifacts-20min.mts builds
// it), createHumanoPresence seed 7, 60 Hz, 10 minutes of scripted speech with
// realistic phrase structure from mulberry32(202): phrases of 2–6 s separated
// by gaps of 0.5–1.5 s, per-phrase amplitude 0.6–1.0, envelope eased with an
// 80 ms attack and a 150 ms release — the RMS-like curve a real utterance
// carries. During a phrase `speaking` is true and the mouth is the 2–6 Hz
// viseme noise (mulberry32(101), the head-jaw script's generator) scaled by
// the envelope; in gaps both are zero. The recorded "speech RMS" is that
// scripted envelope — engine-side there is no audio to measure, and the
// envelope IS what the audio path would hand the body.
//
// Motion: per-frame rotational speed (angle between consecutive WORLD
// quaternions / dt), summed over the torso chain (DEF-spine.001–.004) and the
// shoulder girdle (DEF-shoulder.L/R, DEF-upper_arm.L/R) — the bones the
// speech swell and the beats write to, plus the torso they ride on.
//
// r is taken at the ENVELOPE timescale: both series are smoothed with a
// centered 31-frame (~0.52 s) boxcar before Pearson, so per-syllable jitter
// does not launder a phrase-scale coupling (or its absence). First 2 s
// dropped (rise-in and the frame-0 finger snap). A 200× 5 s-block-shuffle
// null of the smoothed envelope is reported for context: smoothed slow
// signals correlate by accident, and the null says how much accident buys.
//
// ENGINE-SIDE: bones in Node; no renderer, no real audio RMS.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createHumanoPresence } from '/Users/mikevocalz/MoyoLearn/packages/avatar/src/presence/humano.ts';
import { mulberry32 } from '/Users/mikevocalz/MoyoLearn/packages/avatar/src/idle/engine.ts';

const DT = 1 / 60;
const MINUTES = 10;
const STEPS = MINUTES * 60 * 60;
const SKIP = 120;
const SMOOTH = 31; // frames, ~0.52 s, centered
const SHUFFLE_BLOCK = 300; // 5 s
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

/** Centered boxcar; the half-window at each end is trimmed by the caller. */
function boxcar(src: Float64Array, w: number): Float64Array {
  const half = (w - 1) / 2;
  const out = new Float64Array(src.length);
  let acc = 0;
  for (let i = 0; i < src.length; i += 1) {
    acc += src[i]!;
    if (i >= w) acc -= src[i - w]!;
    if (i >= w - 1) out[i - half] = acc / w;
  }
  return out;
}

const { root, byName } = buildRealScene();
const presence = createHumanoPresence(root, { seed: 7 });
// Grouped so the report can say WHERE any coupling (or its absence) lives.
const GROUPS = {
  torso: ['DEF-spine.001', 'DEF-spine.002', 'DEF-spine.003', 'DEF-spine.004'],
  shoulder: ['DEF-shoulder.L', 'DEF-shoulder.R'],
  upperArm: ['DEF-upper_arm.L', 'DEF-upper_arm.R'],
} as const;
type GroupName = keyof typeof GROUPS;
const tracked = (Object.entries(GROUPS) as [GroupName, readonly string[]][]).flatMap(
  ([group, names]) => names.map((name) => ({ group, bone: byName.get(name)! })),
);
root.updateMatrixWorld(true);

// -- phrase-structured envelope --
const phraseRand = mulberry32(202);
const viseme = makeViseme(mulberry32(101));
let inPhrase = false;
let segLeft = 0; // frames left in the current segment
let phraseAmp = 0;
let env = 0;

const prevQ = tracked.map((t) => t.bone.getWorldQuaternion(new THREE.Quaternion()));
const q = new THREE.Quaternion();
const N = STEPS - SKIP;
const speed = new Float64Array(N);
const rms = new Float64Array(N);
const byGroup: Record<GroupName, { phrase: number; phraseN: number; gap: number; gapN: number }> = {
  torso: { phrase: 0, phraseN: 0, gap: 0, gapN: 0 },
  shoulder: { phrase: 0, phraseN: 0, gap: 0, gapN: 0 },
  upperArm: { phrase: 0, phraseN: 0, gap: 0, gapN: 0 },
};

for (let i = 0; i < STEPS; i += 1) {
  if (segLeft <= 0) {
    inPhrase = !inPhrase;
    if (inPhrase) {
      segLeft = Math.round((2 + phraseRand() * 4) * 60); // 2–6 s
      phraseAmp = 0.6 + phraseRand() * 0.4;
    } else {
      segLeft = Math.round((0.5 + phraseRand() * 1.0) * 60); // 0.5–1.5 s
    }
  }
  segLeft -= 1;
  const target = inPhrase ? phraseAmp : 0;
  const tau = target > env ? 0.08 : 0.15; // attack / release
  env += (target - env) * (1 - Math.exp(-DT / tau));
  const mouth = Math.min(1, Math.max(0, viseme(DT) * env));

  presence.step(DT, { speaking: inPhrase, mouth, reducedMotion: false });
  root.updateMatrixWorld(true);

  let omega = 0;
  for (let k = 0; k < tracked.length; k += 1) {
    tracked[k]!.bone.getWorldQuaternion(q);
    const p = prevQ[k]!;
    const dot = Math.min(1, Math.abs(q.x * p.x + q.y * p.y + q.z * p.z + q.w * p.w));
    const w = (2 * Math.acos(dot)) / DT;
    omega += w;
    p.copy(q);
    if (i >= SKIP) {
      const g = byGroup[tracked[k]!.group];
      if (inPhrase) { g.phrase += w; g.phraseN += 1; } else { g.gap += w; g.gapN += 1; }
    }
  }
  if (i < SKIP) continue;
  speed[i - SKIP] = omega;
  rms[i - SKIP] = env;
}

const half = (SMOOTH - 1) / 2;
const speedS = boxcar(speed, SMOOTH).subarray(half, N - half);
const rmsS = boxcar(rms, SMOOTH).subarray(half, N - half);
const r = pearson(speedS, rmsS);

// -- 5 s block-shuffle null of the smoothed envelope, for context --
const nBlocks = Math.floor(rmsS.length / SHUFFLE_BLOCK);
const used = nBlocks * SHUFFLE_BLOCK;
const speedTrim = speedS.subarray(0, used) as Float64Array;
const shuffled = new Float64Array(used);
const order = Array.from({ length: nBlocks }, (_, k) => k);
const shufRand = mulberry32(9003);
let nullMin = Infinity, nullMax = -Infinity, nullAbsMax = 0;
for (let s = 0; s < SHUFFLES; s += 1) {
  for (let k = nBlocks - 1; k > 0; k -= 1) {
    const j = Math.floor(shufRand() * (k + 1));
    const tmp = order[k]!; order[k] = order[j]!; order[j] = tmp;
  }
  for (let k = 0; k < nBlocks; k += 1) {
    shuffled.set(rmsS.subarray(order[k]! * SHUFFLE_BLOCK, (order[k]! + 1) * SHUFFLE_BLOCK), k * SHUFFLE_BLOCK);
  }
  const rs = pearson(speedTrim, shuffled);
  if (rs < nullMin) nullMin = rs;
  if (rs > nullMax) nullMax = rs;
  if (Math.abs(rs) > nullAbsMax) nullAbsMax = Math.abs(rs);
}

console.log(`${MINUTES} min scripted speech at 60 Hz, presence seed 7, real natalie.gltf hierarchy, first 2 s dropped`);
console.log(`phrases 2–6 s, gaps 0.5–1.5 s, amp 0.6–1.0, attack 80 ms / release 150 ms (mulberry32(202)); mouth = 2–6 Hz viseme noise × envelope`);
console.log(`motion: Σ world rotational speed over DEF-spine.001–.004 + DEF-shoulder.L/R + DEF-upper_arm.L/R`);
console.log(`both series smoothed with a centered ${SMOOTH}-frame (~${(SMOOTH / 60).toFixed(2)} s) boxcar before Pearson`);
console.log(`r = ${r.toFixed(4)} over ${speedS.length} frames · target ≥ 0.5`);
for (const [group, g] of Object.entries(byGroup)) {
  console.log(`  ${group}: mean ang speed in-phrase ${(g.phrase / g.phraseN).toFixed(4)} rad/s · in-gap ${(g.gap / g.gapN).toFixed(4)} rad/s`);
}
console.log(`null: ${SHUFFLES} shuffles of the smoothed envelope in 5 s blocks → r ∈ [${nullMin.toFixed(4)}, ${nullMax.toFixed(4)}], max|r| ${nullAbsMax.toFixed(4)}`);
console.log(r >= 0.5 ? `PASS: at or above the 0.5 target` : `FINDING: below the 0.5 target — the body does not carry the voice's energy at the phrase scale`);

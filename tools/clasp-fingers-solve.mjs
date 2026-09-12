// Per-finger clasp solve: land every fingertip on the surface it rests on.
// Bottom (R) fingertips -> the shirt/belly grid; top (L) fingertips -> a plane
// fit through the posed bottom hand's bones (its "back"), offset by skin.
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
const dir = new URL('../packages/avatar/assets/natalie-phone/', import.meta.url);
const gltf = JSON.parse(readFileSync(new URL('natalie.gltf', dir), 'utf8'));
const bin = readFileSync(new URL('natalie.bin', dir));

// ---- shirt surface grid (max z per xy cell over the torso band) ------------
const prim = gltf.meshes[0].primitives[0];
const acc = gltf.accessors[prim.attributes.POSITION];
const bv = gltf.bufferViews[acc.bufferView];
const stride = bv.byteStride || 12;
const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
const CELL = 0.015; const grid = new Map();
const key = (x, y) => `${Math.round(x / CELL)}|${Math.round(y / CELL)}`;
for (let i = 0; i < acc.count; i++) {
  const o = base + i * stride;
  const x = bin.readFloatLE(o), y = bin.readFloatLE(o + 4), z = bin.readFloatLE(o + 8);
  if (y < 0.78 || y > 1.5 || Math.abs(x) > 0.30) continue;
  const k = key(x, y); const cur = grid.get(k);
  if (cur === undefined || z > cur) grid.set(k, z);
}
const surface = (x, y) => { let best = -Infinity;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const v = grid.get(key(x + dx * CELL, y + dy * CELL)); if (v !== undefined && v > best) best = v; }
  return best; };

// ---- the rig ---------------------------------------------------------------
const bones = gltf.nodes.map((n) => { const b = new THREE.Bone(); b.name = n.name;
  if (n.translation) b.position.fromArray(n.translation);
  if (n.rotation) b.quaternion.fromArray(n.rotation);
  if (n.scale) b.scale.fromArray(n.scale); return b; });
const root = new THREE.Group(); const hasParent = new Set();
gltf.nodes.forEach((n,i)=>{ for (const c of n.children ?? []) { bones[i].add(bones[c]); hasParent.add(c); } });
bones.forEach((b,i)=>{ if(!hasParent.has(i)) root.add(b); });
root.updateMatrixWorld(true);
const by = new Map(bones.map(b=>[b.name,b]));
const rest = new Map([...by].map(([n,b])=>[n, b.quaternion.clone()]));
const q = new THREE.Quaternion(), e = new THREE.Euler();
const pose = (nm, dx, dy, dz) => { const b = by.get(nm); if (!b) return;
  q.setFromEuler(e.set(dx, dy, dz, 'XYZ')); b.quaternion.copy(rest.get(nm)).multiply(q); };
const W = (nm) => by.get(nm).getWorldPosition(new THREE.Vector3());

// ---- the shipped clasp arm pose (writer at fold = 1) -----------------------
const FOLD = {
  L: { forward: 0.6, rot: 1.262, abduct: 0.1, elbow: 0.306, hand: -0.125, handYaw: 0.8 },
  R: { forward: 0.473, rot: 1.248, abduct: 0.1, elbow: 0.301, hand: -0.047, handYaw: -0.5 },
};
const ADDUCT = { thumb: 0.32, f_index: 0.14, f_middle: 0.05, f_ring: 0.17, f_pinky: 0.28 };
const FINGERS = ['thumb', 'f_index', 'f_middle', 'f_ring', 'f_pinky'];
for (const side of ['L', 'R']) {
  const s = side === 'L' ? 1 : -1; const v = FOLD[side];
  pose(`DEF-upper_arm.${side}`, v.forward, s * v.rot, s * v.abduct);
  pose(`DEF-forearm.${side}`, v.elbow, 0, 0);
  pose(`DEF-hand.${side}`, v.hand, v.handYaw, 0);
  // clasp adduction as the writer applies it (thumb spared, x2.2 for the rest)
  for (const f of FINGERS) {
    const mult = f === 'thumb' ? 1 : 2.2;
    pose(`DEF-${f}.01.${side}`, 0, 0, -(side === 'L' ? 1 : -1) * ADDUCT[f] * mult);
  }
}
root.updateMatrixWorld(true);

// ---- per-finger curl solve -------------------------------------------------
// Unknown: knuckle curl k; 02 = 0.8k, 03 = 0.5k on top of the base pose.
// distFn(tip) -> signed distance to the surface the tip should rest on
// (positive = above it). Bisect k until |dist| < 0.5 mm.
const RATIO = { '01': 1, '02': 0.8, '03': 0.5 };
function setCurl(side, f, k) {
  const zAdd = (ph) => (ph === '01' ? -(side === 'L' ? 1 : -1) * ADDUCT[f] * (f === 'thumb' ? 1 : 2.2) : 0);
  for (const ph of ['01', '02', '03']) pose(`DEF-${f}.${ph}.${side}`, k * RATIO[ph], 0, zAdd(ph));
  root.updateMatrixWorld(true);
}
function solveFinger(side, f, distFn, kMax = 1.15) {
  let lo = 0, hi = kMax;
  setCurl(side, f, lo);
  const dLo = distFn(W(`DEF-${f}.03.${side}`));
  setCurl(side, f, hi);
  const dHi = distFn(W(`DEF-${f}.03.${side}`));
  if (dLo <= 0) return { k: 0, d: dLo };            // already touching at rest
  if (dHi > 0) return { k: kMax, d: dHi };          // cannot reach: fullest curl
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    setCurl(side, f, mid);
    const d = distFn(W(`DEF-${f}.03.${side}`));
    if (d > 0) lo = mid; else hi = mid;
  }
  const k = (lo + hi) / 2;
  setCurl(side, f, k);
  return { k, d: distFn(W(`DEF-${f}.03.${side}`)) };
}

/*
  CONTACT MODEL, SECOND ATTEMPT — the first two were both wrong, informatively:
  the bottom hand HOVERS in front of the belly (its tips cannot descend 100 mm
  to the shirt), and a plane fit through its bones showed the top fingers
  already 50-120 mm PAST it at zero extra curl. The fingers were not splayed;
  they were passing THROUGH the bottom hand. So: bottom fingers get a fixed
  soft resting curl, and each TOP fingertip solves for clearance to the
  nearest point on the bottom hand's bone SEGMENTS — allowing NEGATIVE curl,
  because the correction direction here is extension: lifting the finger to
  lie on the hand rather than curling deeper into it.
*/
const out = { L: {}, R: {} };
for (const f of FINGERS) {
  const kR = f === 'thumb' ? 0.25 : 0.35;
  setCurl('R', f, kR);
  out.R[f] = kR;
}
root.updateMatrixWorld(true);
// The bottom hand's bone segments, posed.
/*
  RADIUS-AWARE SURFACES. The fingers do not all land on the hand: in this
  diagonal stack the ring, pinky and thumb rest on the right WRIST and
  FOREARM — which are much fatter than a finger bone. Each segment carries
  its own radius; the signed clearance is min over segments of
  (distance − radius), and contact is clearance == margin.
*/
const segs = [];
const addSegsOf = (nm, radius) => {
  const b = by.get(nm);
  if (!b) return;
  const head = b.getWorldPosition(new THREE.Vector3());
  for (const c of b.children) {
    const tail = c.getWorldPosition(new THREE.Vector3());
    // Twist bones stack at the same origin; a zero-length segment NaNs the
    // point-to-segment projection.
    if (tail.distanceToSquared(head) > 1e-8) segs.push([head, tail, radius]);
  }
  if (b.children.length === 0) {
    const parentHead = b.parent.getWorldPosition(new THREE.Vector3());
    const delta = head.clone().sub(parentHead);
    if (delta.lengthSq() > 1e-8) {
      const dir = delta.normalize().multiplyScalar(0.02);
      segs.push([head, head.clone().add(dir), radius]);
    }
  }
};
addSegsOf('DEF-forearm.R', 0.036);
addSegsOf('DEF-hand.R', 0.014);
for (const f of FINGERS) for (const p2 of ['01', '02', '03']) addSegsOf(`DEF-${f}.${p2}.R`, 0.008);
const CONTACT = 0.003; // margin above the segment's own skin radius
const distToHand = (p) => {
  let best = Infinity;
  const ab = new THREE.Vector3(), ap = new THREE.Vector3(), c = new THREE.Vector3();
  for (const [a2, b2, r] of segs) {
    ab.copy(b2).sub(a2); ap.copy(p).sub(a2);
    const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.lengthSq()));
    c.copy(a2).addScaledVector(ab, t);
    best = Math.min(best, p.distanceTo(c) - r);
  }
  return best;
};
/*
  ARM MICRO-ADJUST FIRST. With the bottom fingers softly curled, the top
  fingertips hang 17-65 mm ABOVE the bottom hand at any curl — the wrists'
  77 mm diagonal is just too tall for finger-to-hand contact. Search a small
  neighbourhood of the L arm (forward, elbow, hand pitch) for the pose where
  a mid-curled index/middle pair sits AT contact, keeping the arm clear of
  the shirt; then solve each finger inside that pose.
*/
console.log('twist bone exists:', by.has('DEF-forearm.L.001'));
let bestAdj = { dF: 0, dE: 0, dH: 0, dP: 0, score: Infinity };
for (let dF = -0.14; dF <= 0.04; dF += 0.02) {
  for (let dE = -0.16; dE <= 0.12; dE += 0.04) {
    for (const dH of [-0.15, 0, 0.15]) {
      for (const dP of [-0.9, -0.6, -0.3, 0, 0.3, 0.6, 0.9]) {
      pose('DEF-upper_arm.L', FOLD.L.forward + dF, FOLD.L.rot, FOLD.L.abduct);
      pose('DEF-forearm.L', FOLD.L.elbow + dE, 0, 0);
      // PRONATION: the forearm twist bone rotates the hand about the arm's
      // long axis — the DOF that turns the palm to FACE the hand below it,
      // without which the ulnar fingers overhang into open space.
      pose('DEF-forearm.L.001', 0, dP, 0);
      pose('DEF-hand.L', FOLD.L.hand + dH, FOLD.L.handYaw, 0);
      setCurl('L', 'f_index', 0.3);
      setCurl('L', 'f_middle', 0.3);
      setCurl('L', 'f_ring', 0.35);
      const dI = distToHand(W('DEF-f_index.03.L')) - CONTACT;
      const dM = distToHand(W('DEF-f_middle.03.L')) - CONTACT;
      const dR = distToHand(W('DEF-f_ring.03.L')) - CONTACT;
      // the forearm must stay off the shirt
      const elbow = W('DEF-forearm.L'), wrist = W('DEF-hand.L');
      let minGap = Infinity;
      for (let t = 0; t <= 1.0001; t += 0.2) {
        const pt = elbow.clone().lerp(wrist, t);
        const sz = surface(pt.x, pt.y);
        if (sz > -Infinity) minGap = Math.min(minGap, pt.z - sz);
      }
      if (minGap < 0.03) continue;
      const score = Math.abs(dI) + Math.abs(dM) + Math.abs(dR);
      if (score < bestAdj.score) bestAdj = { dF, dE, dH, dP, score };
      }
    }
  }
}
console.log('arm adjust:', JSON.stringify(bestAdj));
FOLD.L.forward += bestAdj.dF;
FOLD.L.elbow += bestAdj.dE;
FOLD.L.hand += bestAdj.dH;
FOLD.L.pron = bestAdj.dP;
pose('DEF-upper_arm.L', FOLD.L.forward, FOLD.L.rot, FOLD.L.abduct);
pose('DEF-forearm.L', FOLD.L.elbow, 0, 0);
pose('DEF-forearm.L.001', 0, FOLD.L.pron, 0);
pose('DEF-hand.L', FOLD.L.hand, FOLD.L.handYaw, 0);
root.updateMatrixWorld(true);

/*
  SMALLEST CURL AT CLOSEST APPROACH. Bisection's fallback for "cannot quite
  touch" was full curl — a fist, for a finger that hovers 4 mm off the
  surface somewhere in its arc. Scan the arc instead and take the curl that
  minimises |clearance|, with a mild preference for shallower curls so a
  4 mm hover at k 0.4 beats a 3 mm hover at k 1.0 — resting fingers are
  nearly straight, and a millimetre of air does not render.
*/
for (const f of FINGERS) {
  let bestK = 0, bestScore = Infinity, bestD = Infinity;
  for (let k = 0; k <= 1.05; k += 0.025) {
    setCurl('L', f, k);
    const d = distToHand(W(`DEF-${f}.03.L`)) - CONTACT;
    const score = Math.abs(d) + k * 0.006;
    if (score < bestScore) { bestScore = score; bestK = k; bestD = d; }
  }
  setCurl('L', f, bestK);
  out.L[f] = +bestK.toFixed(3);
  console.log(`L ${f.padEnd(9)} k ${bestK.toFixed(3)}  clearance ${(bestD * 1000).toFixed(1)}mm`);
}
console.log('\nadjusted L arm:', JSON.stringify({ forward: +FOLD.L.forward.toFixed(3), elbow: +FOLD.L.elbow.toFixed(3), hand: +FOLD.L.hand.toFixed(3), pron: +(FOLD.L.pron ?? 0).toFixed(3) }));
console.log('fingerCurl:', JSON.stringify(out));

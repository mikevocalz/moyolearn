import { readFileSync } from 'node:fs';
import * as THREE from 'three';
const dir = new URL('../packages/avatar/assets/natalie-phone/', import.meta.url);
const gltf = JSON.parse(readFileSync(new URL('natalie.gltf', dir), 'utf8'));
const bin = readFileSync(new URL('natalie.bin', dir));

// --- rest-pose skin: the torso's front surface, as a max-z grid ------------
const prim = gltf.meshes[0].primitives[0];
const acc = gltf.accessors[prim.attributes.POSITION];
const bv = gltf.bufferViews[acc.bufferView];
const stride = bv.byteStride || 12;
const base = (bv.byteOffset || 0) + (acc.byteOffset || 0);
const CELL = 0.015;
const grid = new Map();
const key = (x, y) => `${Math.round(x / CELL)}|${Math.round(y / CELL)}`;
let n = 0;
for (let i = 0; i < acc.count; i++) {
  const o = base + i * stride;
  const x = bin.readFloatLE(o), y = bin.readFloatLE(o + 4), z = bin.readFloatLE(o + 8);
  if (y < 0.85 || y > 1.5 || Math.abs(x) > 0.30) continue;   // torso band only
  const k = key(x, y);
  const cur = grid.get(k);
  if (cur === undefined || z > cur) grid.set(k, z);
  n++;
}
const surface = (x, y) => {
  let best = -Infinity;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const v = grid.get(key(x + dx * CELL, y + dy * CELL));
    if (v !== undefined && v > best) best = v;
  }
  return best;
};
console.log('torso samples', n, ' front z at chest (0,1.15):', surface(0, 1.15).toFixed(3),
            ' at belly (0,1.05):', surface(0, 1.05).toFixed(3));

// --- the rig ---------------------------------------------------------------
const bones = gltf.nodes.map((nd) => { const b = new THREE.Bone(); b.name = nd.name;
  if (nd.translation) b.position.fromArray(nd.translation);
  if (nd.rotation) b.quaternion.fromArray(nd.rotation);
  if (nd.scale) b.scale.fromArray(nd.scale); return b; });
const root = new THREE.Group(); const hasParent = new Set();
gltf.nodes.forEach((nd, i) => { for (const c of nd.children ?? []) { bones[i].add(bones[c]); hasParent.add(c); } });
bones.forEach((b, i) => { if (!hasParent.has(i)) root.add(b); });
root.updateMatrixWorld(true);
const by = new Map(bones.map((b) => [b.name, b]));
const rest = new Map([...by].map(([nm, b]) => [nm, b.quaternion.clone()]));
const q = new THREE.Quaternion(), e = new THREE.Euler();
const pose = (nm, dx, dy, dz) => { const b = by.get(nm); q.setFromEuler(e.set(dx, dy, dz, 'XYZ'));
  b.quaternion.copy(rest.get(nm)).multiply(q); };
const W = (nm) => by.get(nm).getWorldPosition(new THREE.Vector3());

const CLEAR = 0.028;          // shirt + arm radius: how far off the skin the bones must sit
function apply(p) {
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    pose(`DEF-upper_arm.${side}`, p[side].fwd, s * p[side].rot, s * p[side].abd);
    pose(`DEF-forearm.${side}`, p[side].elbow, 0, 0);
    pose(`DEF-hand.${side}`, p[side].hand, 0, 0);
  }
  root.updateMatrixWorld(true);
}
function cost(p) {
  apply(p);
  let c = 0;
  const arms = {};
  for (const side of ['L', 'R']) {
    const elbow = W(`DEF-forearm.${side}`), wrist = W(`DEF-hand.${side}`);
    arms[side] = [elbow, wrist];
    // 1. the forearm must clear the skin along its whole length
    for (let t = 0; t <= 1.0001; t += 0.1) {
      const pt = elbow.clone().lerp(wrist, t);
      const sz = surface(pt.x, pt.y);
      if (sz > -Infinity) {
        const gap = pt.z - (sz + CLEAR);
        if (gap < 0) c += 60 * gap * gap;          // inside the shirt: heavily penalised
        if (gap > 0.02) c += 90 * (gap - 0.02) ** 2; // floating in front of her: also wrong
      }
    }
    // 2. folded arms sit ACROSS THE CHEST, not resting on the belly
    c += 6 * (wrist.y - (side === 'L' ? 1.165 : 1.125)) ** 2;
    // 3. each hand ends UNDER THE OPPOSITE ARM — that is what folded means.
    //    Crossing all the way past the midline leaves the hands dangling in
    //    front of her, which is what the first surface-aware solve produced.
    const want = side === 'L' ? -0.105 : 0.105;
    c += 6 * (wrist.x - want) ** 2;
    // 4. elbows stay out at the sides rather than tucking behind the ribs
    c += 1.2 * (elbow.x - (side === 'L' ? 0.19 : -0.19)) ** 2;
    c += 1.2 * (elbow.y - 1.08) ** 2;
  }
  // 5. one forearm rides above the other — a fold has to resolve somehow
  c += 5 * Math.max(0, 0.035 - Math.abs(arms.L[1].y - arms.R[1].y)) ** 2 * 20;
  return c;
}
let best = { L: { fwd: 0.5, rot: 0.9, abd: -0.2, elbow: 0.8, hand: 0 },
             R: { fwd: 0.5, rot: 0.9, abd: -0.2, elbow: 0.8, hand: 0 } };
let bc = cost(best);
const rnd = (a) => (Math.random() * 2 - 1) * a;
for (let iter = 0, step = 0.6; iter < 120000; iter++) {
  if (iter % 20000 === 0 && iter) step *= 0.6;
  const cand = { L: { ...best.L }, R: { ...best.R } };
  for (const side of ['L', 'R']) {
    const c2 = cand[side];
    c2.fwd += rnd(step * 0.5); c2.rot += rnd(step); c2.abd += rnd(step * 0.4);
    c2.elbow += rnd(step); c2.hand += rnd(step * 0.3);
    c2.fwd = Math.min(0.70, Math.max(-0.1, c2.fwd));
    c2.rot = Math.min(1.6, Math.max(0, c2.rot));
    c2.abd = Math.min(0.15, Math.max(-0.5, c2.abd));
    c2.elbow = Math.min(2.2, Math.max(0.3, c2.elbow));
    c2.hand = Math.min(0.35, Math.max(-0.25, c2.hand));
  }
  const c = cost(cand);
  if (c < bc) { bc = c; best = cand; }
}
apply(best);
console.log('cost', bc.toFixed(5));
for (const side of ['L', 'R']) {
  console.log(side, Object.entries(best[side]).map(([k, v]) => `${k}: ${v.toFixed(3)}`).join(', '));
  const el = W(`DEF-forearm.${side}`), wr = W(`DEF-hand.${side}`);
  const mid = el.clone().lerp(wr, 0.5);
  console.log(`   elbow ${el.toArray().map(v=>v.toFixed(3)).join(' ')}  wrist ${wr.toArray().map(v=>v.toFixed(3)).join(' ')}`);
  console.log(`   clearance: elbow ${(el.z - surface(el.x, el.y)).toFixed(3)}  mid ${(mid.z - surface(mid.x, mid.y)).toFixed(3)}  wrist ${(wr.z - surface(wr.x, wr.y)).toFixed(3)}`);
}

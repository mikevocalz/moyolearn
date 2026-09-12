import { readFileSync } from 'node:fs';
import * as THREE from 'three';
const dir = new URL('./assets/natalie-phone/', import.meta.url);
const gltf = JSON.parse(readFileSync(new URL('natalie.gltf', dir), 'utf8'));
const bin = readFileSync(new URL('natalie.bin', dir));
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
console.log('shirt z at (0,0.99):', surface(0,0.99).toFixed(3), ' (0,1.05):', surface(0,1.05).toFixed(3));
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
const pose = (nm, dx, dy, dz) => { const b = by.get(nm); q.setFromEuler(e.set(dx, dy, dz, 'XYZ'));
  b.quaternion.copy(rest.get(nm)).multiply(q); };
const W = (nm) => by.get(nm).getWorldPosition(new THREE.Vector3());
const ARM_R = 0.04;   // forearm+sleeve radius off the SHIRT surface
function apply(p) {
  for (const side of ['L','R']) {
    const s = side === 'L' ? 1 : -1; const v = p[side];
    pose(`DEF-upper_arm.${side}`, v.fwd, s*v.rot, s*v.abd);
    pose(`DEF-forearm.${side}`, v.elbow, 0, 0);
    pose(`DEF-hand.${side}`, v.hand, 0, 0);
  }
  root.updateMatrixWorld(true);
}
function cost(p) {
  apply(p);
  let c = 0; const wr = {};
  for (const side of ['L','R']) {
    const elbow = W(`DEF-forearm.${side}`), wrist = W(`DEF-hand.${side}`);
    wr[side] = wrist;
    for (let t = 0; t <= 1.6; t += 0.1) {
      const pt = elbow.clone().lerp(wrist, t);
      const sz = surface(pt.x, pt.y);
      if (sz > -Infinity) {
        const gap = pt.z - (sz + ARM_R);
        if (gap < 0) c += 120 * gap * gap;
        if (gap > 0.05) c += 20 * (gap - 0.05) ** 2;
      }
    }
    // hands meet just in front of the lower belly
    const want = side === 'L' ? 0.035 : -0.035;
    c += 8 * (wrist.x - want) ** 2 + 8 * (wrist.y - 0.995) ** 2;
  }
  // the two wrists actually MEET (fingers overlap between them)
  c += 10 * Math.max(0, wr.L.distanceTo(wr.R) - 0.075) ** 2;
  return c;
}
let best = { L: { fwd: 0.3, rot: 0.5, abd: -0.05, elbow: 0.55, hand: 0.1 },
             R: { fwd: 0.3, rot: 0.5, abd: -0.05, elbow: 0.55, hand: 0.1 } };
let bc = cost(best);
const rnd = (a)=> (Math.random()*2-1)*a;
for (let iter=0, step=0.4; iter<80000; iter++) {
  if (iter % 16000 === 0 && iter) step *= 0.6;
  const cand = { L:{...best.L}, R:{...best.R} };
  for (const side of ['L','R']) {
    const c2 = cand[side];
    c2.fwd += rnd(step*0.4); c2.rot += rnd(step*0.6); c2.abd += rnd(step*0.3);
    c2.elbow += rnd(step*0.6); c2.hand += rnd(step*0.3);
    c2.fwd = Math.min(0.6, Math.max(0.05, c2.fwd));
    c2.rot = Math.min(1.2, Math.max(0, c2.rot));
    c2.abd = Math.min(0.1, Math.max(-0.3, c2.abd));
    c2.elbow = Math.min(1.3, Math.max(0.3, c2.elbow));
    c2.hand = Math.min(0.45, Math.max(-0.2, c2.hand));
  }
  const c = cost(cand);
  if (c < bc) { bc = c; best = cand; }
}
apply(best);
console.log('cost', bc.toFixed(5));
for (const side of ['L','R']) {
  console.log(side, JSON.stringify(best[side], (k,v)=>typeof v==='number'?+v.toFixed(3):v));
  const el = W(`DEF-forearm.${side}`), w = W(`DEF-hand.${side}`);
  let minGap=Infinity;
  for (let t=0;t<=1.6;t+=0.1){const pt=el.clone().lerp(w,t);const sz=surface(pt.x,pt.y);if(sz>-Infinity)minGap=Math.min(minGap,pt.z-sz);}
  console.log(`   wrist ${w.toArray().map(v=>v.toFixed(3)).join(' ')}  min skin/shirt gap along arm+hand ${(minGap*1000).toFixed(0)}mm`);
}
console.log('wrist separation', (W('DEF-hand.L').distanceTo(W('DEF-hand.R'))*1000).toFixed(0), 'mm');

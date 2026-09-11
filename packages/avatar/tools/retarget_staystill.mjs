#!/usr/bin/env node
/*
  Retarget ONE StayStill LaFAN balance-shift clip onto the shipped Rigify rig.

    node tools/retarget_staystill.mjs [zipPath] [gltfPath]

  Picks the `lafan/actions/wei_lr_*` take with the largest horizontal hip
  travel (printed), maps it onto the DEF bones of
  `assets/natalie-phone/natalie.gltf`, and writes a JSON clip to
  /tmp/staystill_wei_lr.clip.json. Verification numbers (knee flexion range,
  hip lateral travel, quaternion norms) print on every run.

  ── MAPPING TABLE (LaFAN joint → Rigify DEF bone → control twin) ────────────
  World-delta transfer: for every frame the SOURCE joint's world rotation
  delta from the clip's frame 0 (the actor standing neutral) is applied about
  the TARGET bone's own rest world orientation, after a yaw that aligns the
  two skeletons' facing. A raw Euler copy is wrong twice over: the LaFAN zero
  pose lies with every bone along local +X (not standing), and the Rigify
  rest locals are nowhere near identity. Frame 0 is the source's "own rest".

    Hips        → DEF-spine       (+ root translation × height ratio) → ORG-spine
    Spine       → DEF-spine.001                                       → MCH-spine.002
    Spine1      → DEF-spine.002                                       → spine_fk.002
    Spine2      → DEF-spine.003 (chest)                               → spine_fk.003
    ½(Spine2→Neck) → DEF-spine.004  (slerp fraction 0.5)              → ORG-spine.004
    Neck        → DEF-spine.005 (neck)                                → ORG-spine.005
    Neck        → DEF-spine.006 (head — see Head below)               → ORG-spine.006
    LeftUpLeg   → DEF-thigh.L      RightUpLeg  → DEF-thigh.R
    LeftLeg     → DEF-shin.L       RightLeg    → DEF-shin.R
    LeftFoot    → DEF-foot.L       RightFoot   → DEF-foot.R
    LeftArm     → DEF-upper_arm.L  RightArm    → DEF-upper_arm.R
    LeftForeArm → DEF-forearm.L    RightForeArm→ DEF-forearm.R
    LeftHand    → DEF-hand.L       RightHand   → DEF-hand.R

  Spine distribution, stated as fractions of the source chain: the six DEF
  segments .001–.006 carry Spine×1, Spine1×1, Spine2×1, Spine2^0.5·Neck^0.5,
  Neck×1, Neck×1. Because each target bone is assigned a WORLD orientation,
  the chest's total world rotation equals Spine·Spine1·Spine2 exactly and the
  head's equals Neck exactly — the fractions only shape the curve in between.

  UNMAPPED source joints, and why:
    Head — FROZEN in this retarget (constant to ~1e-6°; StayStill baked head
      motion into Neck — see tools/staystill_stats.mjs). DEF-spine.006 and
      ORG-spine.006 therefore carry Neck's delta so the head rides the neck.
    LeftToe / RightToe — DEF-toe.L/R exist, but toe articulation in a balance
      shift is noise-level and an unwritten toe keeps the soles flat.
    LeftShoulder / RightShoulder — the clavicles. DEF-shoulder.* deforms the
      shoulder skin but the arm chain's real parent is ORG-shoulder.* on the
      CONTROL chain; the shipped writer has no shoulder twin, so writing
      DEF-shoulder alone tears the shoulder skin off the arm root. The
      clavicle's contribution is not lost: LeftArm's WORLD delta already
      contains it, so DEF-upper_arm lands where the source arm points.
  Also intentionally unwritten: the Rigify twist segments (DEF-thigh.L.001,
  DEF-shin.L.001, DEF-upper_arm.L.001, DEF-forearm.L.001 and .R twins). Left
  at rest local they ride their parent segment rigidly, which is correct to
  first order; the child segment's own world orientation is still exact
  because its local is solved against the actual current parent world.

  ── TWO CHAINS, ONE BODY (why the control twins are in the output) ──────────
  Per the humano.ts header: the torso skin hangs off the DEF chain, but the
  eyes, teeth, BOTH ARMS (via ORG-shoulder.*) and — measured here from the
  glTF — BOTH LEGS (DEF-thigh.* parents to ORG-spine under `torso`) hang off
  the control chain, and the Blender constraints that locked the two chains
  together did not export. So every spine-chain rotation is emitted twice:
  once on the DEF bone and once, as the SAME WORLD rotation, on its control
  twin (humano.ts TWINS plus ORG-spine for the hip root, which the presence
  writer never rotates but a clip must). Twin pivots differ from their DEF
  counterparts (the hip twin sits away from DEF-spine), so twins also get a
  per-frame local TRANSLATION that keeps their pivot riding the DEF bone —
  the same Δp = Δworld·(Ptwin−Pdef)−(Ptwin−Pdef) correction poseBoth makes.

  ── OUTPUT FORMAT ───────────────────────────────────────────────────────────
    {
      fps, frames, source,
      joints:       { name: [[x,y,z,w] per frame] }   // ABSOLUTE local quats
      root:         { translation: [[x,y,z] per frame] } // DEF-spine local, m
      translations: { name: [[x,y,z] per frame] }     // twins' local pos, m
    }
  A player sets node.quaternion / node.position from these directly — no
  deltas to compose, no rest capture needed at play time.

  SOT: packages/avatar/src/presence/humano.ts (TWO CHAINS, ONE BODY) ·
       tools/staystill_stats.mjs · docs/decisions/adr-113-body-motion-layer.md
  SOT-KEYWORDS: retarget staystill lafan rigify def twin wei balance shift bvh clip
*/
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const ZIP = process.argv[2] ?? path.join(here, '../assets/motion/staystill/staystill.zip');
const GLTF = process.argv[3] ?? path.join(here, '../assets/natalie-phone/natalie.gltf');
const OUT = '/tmp/staystill_wei_lr.clip.json';

/* ── quaternion / vector helpers ([x,y,z,w], column-vector convention) ───── */
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => {
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
};
const qaxis = (ax, deg) => {
  const h = (deg * Math.PI) / 360;
  const s = Math.sin(h);
  return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(h)];
};
const qrot = (q, v) => {
  // v' = q v q*
  const [x, y, z, w] = q;
  const [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
};
const qslerp = (a, b, t) => {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) {
    d = -d;
    bb = [-b[0], -b[1], -b[2], -b[3]];
  }
  if (d > 0.9995) return qnorm(a.map((v, i) => v + (bb[i] - v) * t));
  const th = Math.acos(Math.min(1, d));
  const sa = Math.sin((1 - t) * th) / Math.sin(th);
  const sb = Math.sin(t * th) / Math.sin(th);
  return [a[0] * sa + bb[0] * sb, a[1] * sa + bb[1] * sb, a[2] * sa + bb[2] * sb, a[3] * sa + bb[3] * sb];
};
const qangleDeg = (a, b) => {
  const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI;
};
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const QID = [0, 0, 0, 1];

/* ── BVH ─────────────────────────────────────────────────────────────────── */
function parseBvh(text) {
  const tok = text.split(/\s+/).filter(Boolean);
  let i = 0;
  const joints = []; // { name, parent, offset, channels, chBase }
  let chTotal = 0;
  const need = (t) => {
    if (tok[i] !== t) throw new Error(`BVH: expected ${t}, got ${tok[i]} @${i}`);
    i++;
  };
  need('HIERARCHY');
  const readJoint = (parent) => {
    const kind = tok[i++]; // ROOT | JOINT
    const name = tok[i++];
    need('{');
    need('OFFSET');
    const offset = [+tok[i++], +tok[i++], +tok[i++]];
    need('CHANNELS');
    const n = +tok[i++];
    const channels = tok.slice(i, i + n);
    i += n;
    const j = { name, parent, offset, channels, chBase: chTotal, kind };
    chTotal += n;
    joints.push(j);
    const idx = joints.length - 1;
    while (tok[i] === 'JOINT') readJoint(idx);
    if (tok[i] === 'End') {
      i += 2; // End Site
      need('{');
      need('OFFSET');
      i += 3;
      need('}');
    }
    need('}');
    return idx;
  };
  readJoint(-1);
  need('MOTION');
  need('Frames:');
  const frameCount = +tok[i++];
  need('Frame');
  need('Time:');
  const frameTime = +tok[i++];
  const frames = [];
  for (let f = 0; f < frameCount; f++) {
    const row = new Float64Array(chTotal);
    for (let c = 0; c < chTotal; c++) row[c] = +tok[i++];
    frames.push(row);
  }
  return { joints, frames, frameTime, chTotal };
}

/** Local quaternion of joint j at frame row, composing channels in listed order. */
function bvhLocalQuat(j, row) {
  let q = QID;
  for (let c = 0; c < j.channels.length; c++) {
    const ch = j.channels[c];
    if (!ch.endsWith('rotation')) continue;
    const deg = row[j.chBase + c];
    const ax = ch[0] === 'X' ? [1, 0, 0] : ch[0] === 'Y' ? [0, 1, 0] : [0, 0, 1];
    q = qmul(q, qaxis(ax, deg));
  }
  return q;
}
function bvhRootPos(j, row) {
  const p = [0, 0, 0];
  for (let c = 0; c < j.channels.length; c++) {
    const ch = j.channels[c];
    if (ch === 'Xposition') p[0] = row[j.chBase + c];
    else if (ch === 'Yposition') p[1] = row[j.chBase + c];
    else if (ch === 'Zposition') p[2] = row[j.chBase + c];
  }
  return p;
}
/** World rotations + positions for one frame. */
function bvhWorld(bvh, row) {
  const rot = [];
  const pos = [];
  bvh.joints.forEach((j, idx) => {
    const lq = bvhLocalQuat(j, row);
    if (j.parent < 0) {
      rot[idx] = lq;
      pos[idx] = bvhRootPos(j, row);
    } else {
      rot[idx] = qmul(rot[j.parent], lq);
      pos[idx] = vadd(pos[j.parent], qrot(rot[j.parent], j.offset));
    }
  });
  return { rot, pos };
}

/* ── pick the wei_lr take with the largest horizontal hip travel ─────────── */
const names = execFileSync('unzip', ['-l', ZIP], { maxBuffer: 1 << 26 })
  .toString('utf8')
  .split('\n')
  .map((l) => l.trim().split(/\s+/).pop())
  .filter((n) => n && /^lafan\/actions\/wei_lr_\d+\.bvh$/.test(n));
if (names.length === 0) throw new Error('no lafan/actions/wei_lr_*.bvh in zip');

const pcaExtent = (xs, zs) => {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const mz = zs.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxz = 0;
  let szz = 0;
  for (let k = 0; k < n; k++) {
    const dx = xs[k] - mx;
    const dz = zs[k] - mz;
    sxx += dx * dx;
    sxz += dx * dz;
    szz += dz * dz;
  }
  const th = 0.5 * Math.atan2(2 * sxz, sxx - szz); // first principal axis
  const ax = [Math.cos(th), Math.sin(th)];
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < n; k++) {
    const p = (xs[k] - mx) * ax[0] + (zs[k] - mz) * ax[1];
    if (p < lo) lo = p;
    if (p > hi) hi = p;
  }
  return hi - lo;
};

let best = null;
for (const name of names) {
  const text = execFileSync('unzip', ['-p', ZIP, name], { maxBuffer: 1 << 26 }).toString('utf8');
  const m = text.indexOf('MOTION');
  const lines = text.slice(m).split('\n').slice(3).filter((l) => l.trim());
  const xs = [];
  const zs = [];
  for (const l of lines) {
    const s = l.trim().split(/\s+/);
    xs.push(+s[0]);
    zs.push(+s[2]);
  }
  const travel = pcaExtent(xs, zs);
  if (!best || travel > best.travel) best = { name, travel, text };
}
console.log(`clip: ${best.name}  (largest horizontal hip travel of ${names.length} wei_lr takes: ${best.travel.toFixed(2)} cm)`);

const bvh = parseBvh(best.text);
const jIdx = new Map(bvh.joints.map((j, idx) => [j.name, idx]));
const fps = Math.round(1 / bvh.frameTime);

// Confirm the Head freeze this mapping relies on.
{
  const h = bvh.joints[jIdx.get('Head')];
  let spread = 0;
  for (const ch of [0, 1, 2]) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of bvh.frames) {
      const v = row[h.chBase + ch];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    spread = Math.max(spread, hi - lo);
  }
  console.log(`head channel spread: ${spread.toExponential(2)} deg (frozen — baked into Neck, as documented)`);
}

/* ── glTF rest pose ──────────────────────────────────────────────────────── */
const gltf = JSON.parse(readFileSync(GLTF, 'utf8'));
const nodes = gltf.nodes;
const nParent = new Array(nodes.length).fill(-1);
nodes.forEach((n, idx) => (n.children ?? []).forEach((c) => (nParent[c] = idx)));
const nByName = new Map(nodes.map((n, idx) => [n.name, idx]));
const localPos = nodes.map((n) => n.translation ?? [0, 0, 0]);
const localRot = nodes.map((n) => (n.rotation ? qnorm(n.rotation) : QID));
nodes.forEach((n, idx) => {
  if (n.matrix) throw new Error(`node ${n.name} uses a matrix — decompose first`);
  if (n.scale && n.scale.some((s) => Math.abs(s - 1) > 1e-4)) throw new Error(`node ${n.name} has non-unit scale`);
});
// topological order (parents first)
const order = [];
{
  const roots = [];
  nodes.forEach((_, idx) => nParent[idx] === -1 && roots.push(idx));
  const stack = [...roots];
  while (stack.length) {
    const idx = stack.pop();
    order.push(idx);
    for (const c of nodes[idx].children ?? []) stack.push(c);
  }
}
const restWRot = new Array(nodes.length);
const restWPos = new Array(nodes.length);
for (const idx of order) {
  const p = nParent[idx];
  if (p === -1) {
    restWRot[idx] = localRot[idx];
    restWPos[idx] = localPos[idx];
  } else {
    restWRot[idx] = qmul(restWRot[p], localRot[idx]);
    restWPos[idx] = vadd(restWPos[p], qrot(restWRot[p], localPos[idx]));
  }
}
const N = (name) => {
  const idx = nByName.get(name);
  if (idx === undefined) throw new Error(`gltf: no node ${name}`);
  return idx;
};

/* ── world alignment (yaw) and scale ─────────────────────────────────────── */
const ref = bvhWorld(bvh, bvh.frames[0]);
const horiz = (v) => {
  const h = [v[0], 0, v[2]];
  const n = Math.hypot(h[0], h[2]);
  return [h[0] / n, 0, h[2] / n];
};
// forward = up × (P_right − P_left), same formula on both skeletons
const fwdSrc = horiz(
  ((r) => [r[2] * 1 - 0, 0, -r[0]])(vsub(ref.pos[jIdx.get('RightUpLeg')], ref.pos[jIdx.get('LeftUpLeg')])),
);
const fwdTgt = horiz(
  ((r) => [r[2] * 1 - 0, 0, -r[0]])(vsub(restWPos[N('DEF-thigh.R')], restWPos[N('DEF-thigh.L')])),
);
const yaw = Math.atan2(
  fwdSrc[0] * fwdTgt[2] - fwdSrc[2] * fwdTgt[0],
  fwdSrc[0] * fwdTgt[0] + fwdSrc[2] * fwdTgt[2],
);
// rotation about +Y (sign resolved by the check below) maps src forward onto tgt forward
const alignErr = (g) => {
  const c = qrot(g, fwdSrc);
  return Math.hypot(c[0] - fwdTgt[0], c[2] - fwdTgt[2]);
};
let G = qaxis([0, 1, 0], (-yaw * 180) / Math.PI);
if (alignErr(G) > 1e-6) G = qaxis([0, 1, 0], (yaw * 180) / Math.PI);
if (alignErr(G) > 1e-6) throw new Error(`yaw alignment failed (err ${alignErr(G)})`);
const Ginv = qconj(G);
const srcHipY = ref.pos[jIdx.get('Hips')][1]; // cm
const tgtHipY = restWPos[N('DEF-spine')][1]; // m
const ratio = tgtHipY / (srcHipY / 100);
console.log(`hip heights: source ${srcHipY.toFixed(1)} cm, target ${(tgtHipY * 100).toFixed(1)} cm → height ratio ${ratio.toFixed(3)}`);

/* ── per-frame source world deltas, conjugated into the target world ─────── */
const S = (name) => jIdx.get(name); // source joint index
const deltaOf = (frameWorld, srcIdx) => qmul(G, qmul(qmul(frameWorld.rot[srcIdx], qconj(ref.rot[srcIdx])), Ginv));

// target bone → function(frameWorld) → world rotation delta in target space
const assign = new Map();
const direct = (tgt, src) => assign.set(N(tgt), (fw) => deltaOf(fw, S(src)));
direct('DEF-spine', 'Hips');
direct('DEF-spine.001', 'Spine');
direct('DEF-spine.002', 'Spine1');
direct('DEF-spine.003', 'Spine2');
assign.set(N('DEF-spine.004'), (fw) => qslerp(deltaOf(fw, S('Spine2')), deltaOf(fw, S('Neck')), 0.5));
direct('DEF-spine.005', 'Neck');
direct('DEF-spine.006', 'Neck'); // Head frozen in source — baked into Neck
for (const [l, r] of [
  ['LeftUpLeg', 'DEF-thigh.L'],
  ['RightUpLeg', 'DEF-thigh.R'],
  ['LeftLeg', 'DEF-shin.L'],
  ['RightLeg', 'DEF-shin.R'],
  ['LeftFoot', 'DEF-foot.L'],
  ['RightFoot', 'DEF-foot.R'],
  ['LeftArm', 'DEF-upper_arm.L'],
  ['RightArm', 'DEF-upper_arm.R'],
  ['LeftForeArm', 'DEF-forearm.L'],
  ['RightForeArm', 'DEF-forearm.R'],
  ['LeftHand', 'DEF-hand.L'],
  ['RightHand', 'DEF-hand.R'],
])
  direct(r, l);

// control twin → its DEF counterpart (same world delta + pivot-riding translation)
const TWIN_OF = {
  'ORG-spine': 'DEF-spine',
  'MCH-spine.002': 'DEF-spine.001',
  'spine_fk.002': 'DEF-spine.002',
  'spine_fk.003': 'DEF-spine.003',
  'ORG-spine.004': 'DEF-spine.004',
  'ORG-spine.005': 'DEF-spine.005',
  'ORG-spine.006': 'DEF-spine.006',
};
const twinIdx = new Map(Object.entries(TWIN_OF).map(([t, d]) => [N(t), N(d)]));
const spineChain = ['DEF-spine', 'DEF-spine.001', 'DEF-spine.002', 'DEF-spine.003', 'DEF-spine.004', 'DEF-spine.005', 'DEF-spine.006'].map(N);

/* ── per-frame solve ─────────────────────────────────────────────────────── */
const outJoints = {};
const outTrans = {};
const rootTrans = [];
const emitQ = new Map(); // node idx → frames array (for hemisphere continuity)
const emitFor = (idx) => {
  const name = nodes[idx].name;
  if (!emitQ.has(idx)) {
    emitQ.set(idx, []);
    outJoints[name] = emitQ.get(idx);
  }
  return emitQ.get(idx);
};
let maxNormDev = 0;
const round = (v) => Math.round(v * 1e6) / 1e6;

const hipsWorldOut = []; // target DEF-spine world positions, for the travel print
for (const row of bvh.frames) {
  const fw = bvhWorld(bvh, row);

  // desired world ROTATION per assigned DEF bone
  const desiredRot = new Map();
  for (const [idx, fn] of assign) desiredRot.set(idx, qnorm(qmul(fn(fw), restWRot[idx])));

  // DEF spine chain world POSITIONS: root translation, then FK down the chain
  const dHip = vsub(fw.pos[S('Hips')], ref.pos[S('Hips')]); // cm
  const dHipT = qrot(G, dHip).map((v) => (v / 100) * ratio); // m, aligned, scaled
  const desiredPos = new Map();
  desiredPos.set(spineChain[0], vadd(restWPos[spineChain[0]], dHipT));
  for (let k = 1; k < spineChain.length; k++) {
    const c = spineChain[k];
    const p = spineChain[k - 1];
    desiredPos.set(c, vadd(desiredPos.get(p), qrot(desiredRot.get(p), localPos[c])));
  }
  hipsWorldOut.push(desiredPos.get(spineChain[0]));

  // twins: same world delta, pivot rides the DEF counterpart
  for (const [tw, def] of twinIdx) {
    const delta = qmul(desiredRot.get(def), qconj(restWRot[def]));
    desiredRot.set(tw, qnorm(qmul(delta, restWRot[tw])));
    const offset = vsub(restWPos[tw], restWPos[def]);
    desiredPos.set(tw, vadd(desiredPos.get(def), qrot(delta, offset)));
  }

  // full-tree FK: mapped nodes take their desired world, everything else rest
  const curWRot = new Array(nodes.length);
  const curWPos = new Array(nodes.length);
  for (const idx of order) {
    const p = nParent[idx];
    const pRot = p === -1 ? QID : curWRot[p];
    const pPos = p === -1 ? [0, 0, 0] : curWPos[p];
    let lq = localRot[idx];
    let lp = localPos[idx];
    if (desiredRot.has(idx)) {
      lq = qnorm(qmul(qconj(pRot), desiredRot.get(idx)));
      if (desiredPos.has(idx)) lp = qrot(qconj(pRot), vsub(desiredPos.get(idx), pPos));
      const frames = emitFor(idx);
      const prev = frames[frames.length - 1];
      if (prev && prev[0] * lq[0] + prev[1] * lq[1] + prev[2] * lq[2] + prev[3] * lq[3] < 0)
        lq = [-lq[0], -lq[1], -lq[2], -lq[3]];
      maxNormDev = Math.max(maxNormDev, Math.abs(1 - Math.hypot(...lq)));
      frames.push(lq.map(round));
      if (desiredPos.has(idx)) {
        const name = nodes[idx].name;
        if (idx === spineChain[0]) rootTrans.push(lp.map(round));
        else (outTrans[name] ??= []).push(lp.map(round));
      }
    }
    curWRot[idx] = qmul(pRot, lq);
    curWPos[idx] = vadd(pPos, qrot(pRot, lp));
  }
}

/* ── sanity numbers ──────────────────────────────────────────────────────── */
for (const side of ['L', 'R']) {
  const idx = N(`DEF-shin.${side}`);
  const rest = localRot[idx];
  let lo = Infinity;
  let hi = -Infinity;
  for (const q of outJoints[`DEF-shin.${side}`]) {
    const a = qangleDeg(q, rest);
    if (a < lo) lo = a;
    if (a > hi) hi = a;
  }
  console.log(`knee flexion delta, DEF-shin.${side}: ${lo.toFixed(2)}° … ${hi.toFixed(2)}°  (range ${(hi - lo).toFixed(2)}°)`);
}
{
  const xs = hipsWorldOut.map((p) => p[0]);
  const zs = hipsWorldOut.map((p) => p[2]);
  const travel = pcaExtent(xs, zs) * 100;
  console.log(
    `hip lateral travel (output): ${travel.toFixed(2)} cm  (source ${best.travel.toFixed(2)} cm × ratio ${ratio.toFixed(3)} = ${(best.travel * ratio).toFixed(2)} cm)`,
  );
}
console.log(`max quaternion norm deviation: ${maxNormDev.toExponential(2)}  (${maxNormDev <= 1e-3 ? 'OK' : 'FAIL'} vs 1e-3)`);

const clip = { fps, frames: bvh.frames.length, source: best.name, joints: outJoints, root: { translation: rootTrans }, translations: outTrans };
writeFileSync(OUT, JSON.stringify(clip));
console.log(`wrote ${OUT}: ${bvh.frames.length} frames @ ${fps} fps, ${Object.keys(outJoints).length} joints (${Object.keys(TWIN_OF).length} control twins), ${Object.keys(outTrans).length} twin translation tracks`);

#!/usr/bin/env node
/*
  Retarget StayStill LaFAN clips onto the shipped Rigify rig.

    node tools/retarget_staystill.mjs [--all-curated] [zipPath] [gltfPath]

  Default (no flag): the original single-clip behaviour — pick the
  `lafan/actions/wei_lr_*` take with the largest horizontal hip travel
  (printed), retarget with frame 0 as the source reference, write
  /tmp/staystill_wei_lr.clip.json. Take selection and reference-frame policy
  are unchanged from the original tool; the output now also carries the
  foot-contact lock and its `contacts` windows (below), so it is no longer
  byte-identical to the pre-curation version.

  --all-curated: retarget a curated set of ten takes, each to
  /tmp/staystill_<take>.clip.json:
    · 5 balance shifts — wei_lr and wei_rl takes ranked by horizontal hip
      extent
      (the wei_lr_45 selection logic), kept only if the hips end within
      5 cm of where they started (in-place, no walk-off).
    · 5 idles — lafan/idle/idle_*.bvh with the LEAST total horizontal hip
      path length (calm subjects suit a tutor).
  Curated takes may start mid-motion, so the source reference frame is not
  frame 0: it is the frame of lowest hip speed inside the calmest 1 s window
  (printed per clip). Per-clip SOURCE ankle horizontal travel is printed so
  foot skating risk stays visible even with the contact lock below.
  Verification numbers (knee flexion range, hip travel, quaternion norms,
  contact coverage) print for every clip.

  ── FOOT-CONTACT LOCKING (planted phases must not skate) ────────────────────
  Source foot REPOSITIONS are real motion and survive untouched; skate is
  the movement this retarget ADDS (segment proportions differ, so exact
  world rotations land the toe elsewhere) plus drift during phases where the
  SOURCE foot was stationary. So:

  DETECT in the SOURCE: per foot, horizontal ankle speed (5-frame centered
  mean) below 3 cm/s sustained ≥ 0.25 s is a contact window. The threshold
  is calibrated on the ten curated takes, whose speed distribution is
  bimodal: planted-phase wobble sits at p95 ≤ 4 cm/s on the idles and the
  wei planted phases, repositioning swings at ≥ 15 cm/s — 3 cm/s sits in
  the valley, and at that speed a "stationary" foot moves under 7.5 mm over
  the 0.25 s minimum window.

  PIN on the TARGET: during a window, the TOE's world horizontal position
  is held at its window-entry position by the three-link Newton proven in
  src/presence/humano.ts (planted-feet block), adapted to the clip's
  per-frame world FK: with the knee given, hip→ankle is one rigid link
  (Rigify's twist segments ride inside it) measured from the frame's own
  world positions; the two unknowns are chain rotations about the two
  horizontal axes (the humano error plane's (thigh, ankle) pair is
  singular at full knee extension — see the solve comment for the
  measured blow-up); the ankle takes the exact counter-rotation so the
  foot's world orientation is preserved and the correction cannot arc the
  toe; the knee's LOCAL rotation is untouched (so the knee-range gate is
  unaffected); same Newton discipline — rotated-vector derivatives, exact
  residual, 3 iterations. The toe's vertical rides the rigid leg length
  (second-order small, micrometres at these error magnitudes).

  EASE at the edges: the lock weight smoothsteps 0→1 over 0.15 s inside
  each window's start and 1→0 over its last 0.15 s, so entry/exit cannot
  pop. Only the fully-locked interior frames are emitted as `contacts` —
  those are the frames the clip GUARANTEES planted (clip-player.test.ts
  gates them at < 5 mm horizontal drift); windows shorter than twice the
  ramp still get a partial, pop-free correction but emit nothing.

  ── MAPPING TABLE (LaFAN joint → Rigify DEF bone → control twin) ────────────
  World-delta transfer: for every frame the SOURCE joint's world rotation
  delta from the clip's reference frame (the actor standing neutral) is
  applied about the TARGET bone's own rest world orientation, after a yaw
  that aligns the two skeletons' facing. A raw Euler copy is wrong twice
  over: the LaFAN zero pose lies with every bone along local +X (not
  standing), and the Rigify rest locals are nowhere near identity. The
  reference frame is the source's "own rest".

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
    Head — FROZEN in the StayStill corpus (checked and printed per clip;
      StayStill baked head motion into Neck — see tools/staystill_stats.mjs).
      DEF-spine.006 and ORG-spine.006 therefore carry Neck's delta so the
      head rides the neck.
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
      root:         { translation: [[x,y,z] per frame] } // DEF-spine local DELTA from rest, m
      translations: { name: [[x,y,z] per frame] }     // twins' local pos, m
      contacts:     { L: [[startFrame, endFrame], …], R: … } // fully-locked frames, inclusive
    }
  A player sets node.quaternion / node.position from these directly — no
  deltas to compose, no rest capture needed at play time.

  SOT: packages/avatar/src/presence/humano.ts (TWO CHAINS, ONE BODY) ·
       tools/staystill_stats.mjs · docs/decisions/adr-113-body-motion-layer.md
  SOT-KEYWORDS: retarget staystill lafan rigify def twin wei balance shift idle curated bvh clip
*/
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const ALL_CURATED = argv.includes('--all-curated');
const positional = argv.filter((a) => a !== '--all-curated');
const ZIP = positional[0] ?? path.join(here, '../assets/motion/staystill/staystill.zip');
const GLTF = positional[1] ?? path.join(here, '../assets/natalie-phone/natalie.gltf');

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

/* ── take listing + cheap hip pre-scan (root channels only) ──────────────── */
const listTakes = (re) =>
  execFileSync('unzip', ['-l', ZIP], { maxBuffer: 1 << 26 })
    .toString('utf8')
    .split('\n')
    .map((l) => l.trim().split(/\s+/).pop())
    .filter((n) => n && re.test(n));
const readTake = (name) => execFileSync('unzip', ['-p', ZIP, name], { maxBuffer: 1 << 26 }).toString('utf8');

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

/** Hip XZ stats from the raw MOTION rows: extent, end-vs-start distance, path length (cm). */
const hipScan = (text) => {
  const m = text.indexOf('MOTION');
  const lines = text.slice(m).split('\n').slice(3).filter((l) => l.trim());
  const xs = [];
  const zs = [];
  for (const l of lines) {
    const s = l.trim().split(/\s+/);
    xs.push(+s[0]);
    zs.push(+s[2]);
  }
  const n = xs.length;
  let pathLen = 0;
  for (let k = 1; k < n; k++) pathLen += Math.hypot(xs[k] - xs[k - 1], zs[k] - zs[k - 1]);
  return {
    extent: pcaExtent(xs, zs),
    returnDist: Math.hypot(xs[n - 1] - xs[0], zs[n - 1] - zs[0]),
    pathLen,
  };
};

/* ── glTF rest pose (clip-independent) ───────────────────────────────────── */
const gltf = JSON.parse(readFileSync(GLTF, 'utf8'));
const nodes = gltf.nodes;
const nParent = new Array(nodes.length).fill(-1);
nodes.forEach((n, idx) => (n.children ?? []).forEach((c) => (nParent[c] = idx)));
const nByName = new Map(nodes.map((n, idx) => [n.name, idx]));
const localPos = nodes.map((n) => n.translation ?? [0, 0, 0]);
const localRot = nodes.map((n) => (n.rotation ? qnorm(n.rotation) : QID));
nodes.forEach((n) => {
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

/* ── neutral rest frame: lowest hip speed inside the calmest 1 s window ──── */
function findRestFrame(bvh) {
  const root = bvh.joints[0];
  const pos = bvh.frames.map((row) => bvhRootPos(root, row));
  const n = pos.length;
  const speed = new Float64Array(n); // cm per frame
  for (let f = 1; f < n; f++) speed[f] = Math.hypot(...vsub(pos[f], pos[f - 1]));
  speed[0] = n > 1 ? speed[1] : 0;
  const W = Math.min(n, Math.max(1, Math.round(1 / bvh.frameTime)));
  let acc = 0;
  for (let f = 0; f < W; f++) acc += speed[f];
  let bestStart = 0;
  let bestMean = acc / W;
  for (let s = 1; s + W <= n; s++) {
    acc += speed[s + W - 1] - speed[s - 1];
    if (acc / W < bestMean) {
      bestMean = acc / W;
      bestStart = s;
    }
  }
  let frame = bestStart;
  for (let f = bestStart; f < bestStart + W; f++) if (speed[f] < speed[frame]) frame = f;
  return { frame, windowStart: bestStart, meanSpeedCmPerS: bestMean / bvh.frameTime };
}

/* ── foot-contact detection (SOURCE space — see header) ──────────────────── */
const CONTACT_SPEED_CMS = 3; // calibrated on the ten curated takes (header)
const CONTACT_MIN_S = 0.25;
const LOCK_EASE_S = 0.15;

/** Windows (inclusive frame ranges) where one source ankle's horizontal speed
 *  stays below CONTACT_SPEED_CMS for at least CONTACT_MIN_S. */
function detectContactWindows(worlds, ankleIdx, frameTime) {
  const n = worlds.length;
  const raw = new Float64Array(n);
  for (let f = 1; f < n; f++) {
    const a = worlds[f - 1].pos[ankleIdx];
    const b = worlds[f].pos[ankleIdx];
    raw[f] = Math.hypot(b[0] - a[0], b[2] - a[2]) / frameTime; // cm/s
  }
  if (n > 1) raw[0] = raw[1];
  const minFrames = Math.max(1, Math.round(CONTACT_MIN_S / frameTime));
  const windows = [];
  let runStart = -1;
  for (let f = 0; f <= n; f++) {
    let below = false;
    if (f < n) {
      // 5-frame centered mean: a single noisy sample must not split a window.
      let acc = 0;
      let count = 0;
      for (let k = -2; k <= 2; k++) {
        const g = f + k;
        if (g >= 0 && g < n) {
          acc += raw[g];
          count++;
        }
      }
      below = acc / count < CONTACT_SPEED_CMS;
    }
    if (below) {
      if (runStart < 0) runStart = f;
    } else if (runStart >= 0) {
      if (f - runStart >= minFrames) windows.push({ start: runStart, end: f - 1, pin: null });
      runStart = -1;
    }
  }
  return windows;
}

const smoothstep = (x) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/* ── retarget one take ───────────────────────────────────────────────────── */
function retargetClip({ name, text, srcTravel, out, detectRest }) {
  const bvh = parseBvh(text);
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
    console.log(
      spread < 1e-3
        ? `head channel spread: ${spread.toExponential(2)} deg (frozen — baked into Neck, as documented)`
        : `head channel spread: ${spread.toExponential(2)} deg (NOT frozen — this take carries head motion the Neck mapping will drop)`,
    );
  }

  // Reference frame = the source's "own rest". Curated takes may start
  // mid-motion, so detect the calmest moment instead of trusting frame 0.
  let refFrame = 0;
  if (detectRest) {
    const rest = findRestFrame(bvh);
    refFrame = rest.frame;
    console.log(
      `rest frame: ${refFrame} of ${bvh.frames.length} (lowest hip speed in the calmest 1 s window @${rest.windowStart}, mean ${rest.meanSpeedCmPerS.toFixed(2)} cm/s) — used instead of frame 0`,
    );
  }

  /* world alignment (yaw) and scale */
  const ref = bvhWorld(bvh, bvh.frames[refFrame]);
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

  /* per-frame source world deltas, conjugated into the target world */
  const S = (n) => jIdx.get(n); // source joint index
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

  /* per-frame solve */
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
  const ankleSrc = { L: [], R: [] }; // SOURCE ankle world positions (skate-risk report)

  // Source world FK for every frame, up front: contact detection needs the
  // ankle trajectory before the per-frame solve starts consuming it.
  const worlds = bvh.frames.map((row) => bvhWorld(bvh, row));
  const contactWindows = {
    L: detectContactWindows(worlds, S('LeftFoot'), bvh.frameTime),
    R: detectContactWindows(worlds, S('RightFoot'), bvh.frameTime),
  };
  const RAMP = Math.max(1, Math.round(LOCK_EASE_S / bvh.frameTime));
  const lockWeight = (win, f) =>
    f < win.start || f > win.end ? 0 : smoothstep((f - win.start) / RAMP) * smoothstep((win.end - f) / RAMP);
  const legIdx = {
    L: { thigh: N('DEF-thigh.L'), shin: N('DEF-shin.L'), foot: N('DEF-foot.L'), toe: N('DEF-toe.L') },
    R: { thigh: N('DEF-thigh.R'), shin: N('DEF-shin.R'), foot: N('DEF-foot.R'), toe: N('DEF-toe.R') },
  };

  /*
    The humano.ts planted-feet Newton, on the clip's per-frame world FK.

    Two adaptations, both forced by measurement:

    LINK VECTORS from the pass-1 world POSITIONS, not from local offsets:
    Rigify's twist segments (DEF-thigh.*.001, DEF-shin.*.001) sit inside
    the chain as rest-local children, so per-bone local offsets are not
    the hip→toe geometry (measured: 684 mm of "drift" from a solve whose
    maths was internally exact — the humano header's own lesson). With
    the knee given, everything from hip to ankle is one rigid lump.

    UNKNOWNS on the chain's two horizontal axes, not (thigh, ankle) in the
    error plane. The literal transliteration — humano's (a, t) planar pair
    with the plane spanned by the toe error and world up — is SINGULAR at
    full knee extension: in that plane both link derivatives go horizontal
    and parallel (humano is conditioned by the foot's forward component,
    which the error plane of a lateral drift does not contain), and Newton
    blew up to a = −7374° on idle_19 frame 1188. So the two unknowns are
    chain rotations about u (horizontal error direction) and ŷ × u, the
    constraints are the toe's two horizontal coordinates, and the ankle
    takes the exact counter-rotation — the foot's world orientation is
    preserved, so the ankle correction cannot arc the toe (humano's toe
    lesson, applied by making the toe itself the constraint). Same Newton
    discipline: rotated-vector derivatives (∂(Qv)/∂θ = axis × Qv), exact
    residual, 3 iterations. The toe's vertical rides the rigid leg length
    — second-order in the solved angles (θ ≈ error/leg ≈ 0.01 rad, so
    micrometres) — which is also the direction a straight leg cannot
    control, the same geometry that made the planar pair singular.

    The knee's LOCAL rotation is untouched (thigh and shin premultiply by
    the same delta), so the knee-range gate is unaffected.
  */
  const lockToe = (side, weight, pin, fk, desiredRot) => {
    const leg = legIdx[side];
    const hip = fk.curWPos[leg.thigh];
    const toe = fk.curWPos[leg.toe];
    const goal = [toe[0] + (pin[0] - toe[0]) * weight, toe[2] + (pin[2] - toe[2]) * weight];
    const errH = Math.hypot(goal[0] - toe[0], goal[1] - toe[2]);
    if (errH < 1e-7) return;
    const u = [(goal[0] - toe[0]) / errH, 0, (goal[1] - toe[2]) / errH];
    const w1 = [u[2], 0, -u[0]]; // ŷ × u
    const vA = vsub(fk.curWPos[leg.foot], hip); // hip→ankle rigid lump
    const v3 = vsub(toe, fk.curWPos[leg.foot]); // ankle→toe, orientation preserved
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    let q = QID;
    for (let iteration = 0; iteration < 3; iteration += 1) {
      const r = qrot(q, vA);
      const fx = hip[0] + r[0] + v3[0] - goal[0];
      const fz = hip[2] + r[2] + v3[2] - goal[1];
      const d1 = cross(u, r);
      const d2 = cross(w1, r);
      const det = d1[0] * d2[2] - d2[0] * d1[2];
      if (Math.abs(det) < 1e-9) break;
      const da1 = -(fx * d2[2] - fz * d2[0]) / det;
      const da2 = -(d1[0] * fz - d1[2] * fx) / det;
      q = qmul(qaxis(u, (da1 * 180) / Math.PI), qmul(qaxis(w1, (da2 * 180) / Math.PI), q));
    }
    desiredRot.set(leg.thigh, qnorm(qmul(q, fk.curWRot[leg.thigh])));
    desiredRot.set(leg.shin, qnorm(qmul(q, fk.curWRot[leg.shin])));
    // DEF-foot is intentionally NOT premultiplied: keeping its world
    // orientation is the ankle's counter-rotation, resolved by the FK local
    // recompute against the rotated shin.
  };

  const contactPtr = { L: 0, R: 0 };
  for (let fIdx = 0; fIdx < bvh.frames.length; fIdx += 1) {
    const fw = worlds[fIdx];
    ankleSrc.L.push(fw.pos[S('LeftFoot')]);
    ankleSrc.R.push(fw.pos[S('RightFoot')]);

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
    const runFk = (emit) => {
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
          if (emit) {
            const frames = emitFor(idx);
            const prev = frames[frames.length - 1];
            if (prev && prev[0] * lq[0] + prev[1] * lq[1] + prev[2] * lq[2] + prev[3] * lq[3] < 0)
              lq = [-lq[0], -lq[1], -lq[2], -lq[3]];
            maxNormDev = Math.max(maxNormDev, Math.abs(1 - Math.hypot(...lq)));
            frames.push(lq.map(round));
            if (desiredPos.has(idx)) {
              const name = nodes[idx].name;
              // Root track is a DELTA from rest local: the player adds it to the
              // bone's rest position (rootRest + p), unlike the twin tracks which
              // it sets absolutely. Emitting the absolute local here shifted the
              // whole DEF chain up by the hip's rest height on playback.
              if (idx === spineChain[0]) rootTrans.push(vsub(lp, localPos[idx]).map(round));
              else (outTrans[name] ??= []).push(lp.map(round));
            }
          }
        }
        curWRot[idx] = qmul(pRot, lq);
        curWPos[idx] = vadd(pPos, qrot(pRot, lp));
      }
      return { curWRot, curWPos };
    };

    // Pass 1 (no emission) gives the unlocked hip and toe world positions the
    // lock solves against; pass 2 emits with the locked leg rotations in place.
    const pass1 = runFk(false);
    for (const side of ['L', 'R']) {
      const wins = contactWindows[side];
      while (contactPtr[side] < wins.length && fIdx > wins[contactPtr[side]].end) contactPtr[side] += 1;
      const win = wins[contactPtr[side]];
      if (!win || fIdx < win.start) continue;
      // Window-entry pin: the UNLOCKED toe position at the window's first
      // frame (lock weight is 0 there, so entry is seamless by definition).
      if (win.pin === null) win.pin = [...pass1.curWPos[legIdx[side].toe]];
      const weight = lockWeight(win, fIdx);
      if (weight > 0) lockToe(side, weight, win.pin, pass1, desiredRot);
    }
    runFk(true);
  }

  /* contacts: only the fully-locked interior frames — the planted guarantee */
  const contacts = { L: [], R: [] };
  for (const side of ['L', 'R']) {
    for (const win of contactWindows[side]) {
      const s = win.start + RAMP;
      const e = win.end - RAMP;
      if (e >= s) contacts[side].push([s, e]);
    }
  }

  /* sanity numbers */
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
      `hip lateral travel (output): ${travel.toFixed(2)} cm  (source ${srcTravel.toFixed(2)} cm × ratio ${ratio.toFixed(3)} = ${(srcTravel * ratio).toFixed(2)} cm)`,
    );
  }
  {
    // Source-space repositioning: how far each ankle travels horizontally.
    // Repositions are real motion and pass through unlocked; only the drift
    // inside detected contact windows is pinned away.
    const ext = (pts) => pcaExtent(pts.map((p) => p[0]), pts.map((p) => p[2]));
    console.log(
      `source ankle travel (horizontal extent): L ${ext(ankleSrc.L).toFixed(2)} cm, R ${ext(ankleSrc.R).toFixed(2)} cm  (repositions survive; in-contact drift is pinned)`,
    );
  }
  console.log(`max quaternion norm deviation: ${maxNormDev.toExponential(2)}  (${maxNormDev <= 1e-3 ? 'OK' : 'FAIL'} vs 1e-3)`);
  for (const side of ['L', 'R']) {
    const covered = contacts[side].reduce((acc, [s, e]) => acc + (e - s + 1), 0);
    console.log(
      `foot contacts ${side}: ${contactWindows[side].length} source windows (< ${CONTACT_SPEED_CMS} cm/s sustained ≥ ${CONTACT_MIN_S} s), ` +
        `${contacts[side].length} locked interiors → ${((100 * covered) / bvh.frames.length).toFixed(1)}% of frames pinned`,
    );
  }

  const clip = { fps, frames: bvh.frames.length, source: name, joints: outJoints, root: { translation: rootTrans }, translations: outTrans, contacts };
  writeFileSync(out, JSON.stringify(clip));
  console.log(`wrote ${out}: ${bvh.frames.length} frames @ ${fps} fps, ${Object.keys(outJoints).length} joints (${Object.keys(TWIN_OF).length} control twins), ${Object.keys(outTrans).length} twin translation tracks`);
}

/* ── entry points ────────────────────────────────────────────────────────── */
if (!ALL_CURATED) {
  // Original single-clip behaviour: byte-identical /tmp/staystill_wei_lr.clip.json.
  const names = listTakes(/^lafan\/actions\/wei_lr_\d+\.bvh$/);
  if (names.length === 0) throw new Error('no lafan/actions/wei_lr_*.bvh in zip');
  let best = null;
  for (const name of names) {
    const text = readTake(name);
    const travel = hipScan(text).extent;
    if (!best || travel > best.travel) best = { name, travel, text };
  }
  console.log(`clip: ${best.name}  (largest horizontal hip travel of ${names.length} wei_lr takes: ${best.travel.toFixed(2)} cm)`);
  retargetClip({ name: best.name, text: best.text, srcTravel: best.travel, out: '/tmp/staystill_wei_lr.clip.json', detectRest: false });
} else {
  // Curated ten: 5 balance shifts + 5 calm idles.
  const RETURN_MAX_CM = 5; // "hips returning near start" — end-vs-start hip distance
  const scanned = (re) =>
    listTakes(re).map((name) => {
      const text = readTake(name);
      return { name, text, ...hipScan(text) };
    });

  const balance = scanned(/^lafan\/actions\/wei_(lr|rl)_\d+\.bvh$/)
    .filter((t) => t.returnDist <= RETURN_MAX_CM)
    .sort((a, b) => b.extent - a.extent)
    .slice(0, 5);
  /*
    Idles need the RETURN criterion too — the player loops, so a take that
    ends away from its start teleports on the wrap. idle_47 measured a 9.1 cm
    half-frame jump exactly there, caught by the gate after this curation had
    already blessed it: least-total-path selects a calm subject, but calm and
    loop-closed are different properties and only one of them was filtered.
  */
  const idles = scanned(/^lafan\/idle\/idle_\d+\.bvh$/)
    .filter((t) => t.returnDist <= RETURN_MAX_CM)
    .sort((a, b) => a.pathLen - b.pathLen)
    .slice(0, 5);

  console.log(`curated balance shifts (largest hip extent, hips ending ≤ ${RETURN_MAX_CM} cm from start):`);
  for (const t of balance) console.log(`  ${t.name}  extent ${t.extent.toFixed(2)} cm, return ${t.returnDist.toFixed(2)} cm`);
  console.log('curated idles (least total horizontal hip path):');
  for (const t of idles) console.log(`  ${t.name}  path ${t.pathLen.toFixed(0)} cm, extent ${t.extent.toFixed(2)} cm, return ${t.returnDist.toFixed(2)} cm`);

  for (const t of [...balance, ...idles]) {
    const base = path.basename(t.name, '.bvh');
    console.log(`\n── ${t.name} ──`);
    retargetClip({ name: t.name, text: t.text, srcTravel: t.extent, out: `/tmp/staystill_${base}.clip.json`, detectRest: true });
  }
}

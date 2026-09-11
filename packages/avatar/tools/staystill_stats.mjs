#!/usr/bin/env node
/*
  Timing distributions measured from the StayStill corpus, to replace guessed
  constants in `idle/config.ts`. Regenerable: numbers that cannot be re-derived
  are numbers nobody can check.

    node tools/staystill_stats.mjs [zipPath]

  THE LATERAL AXIS IS FOUND, NOT ASSUMED. Freemocap subjects face wherever they
  faced, so "lateral = X" is a guess about a coordinate frame. Each clip's
  horizontal hip track (x, z) is projected onto its own first principal
  component — the axis the hips actually travel along, which for a balance
  shift IS the lateral axis, whatever the room thought.

  THE IDLE THRESHOLDS ARE CALIBRATED FROM THE ACTION CLIPS. wei_lr/wei_rl are
  isolated, labelled balance shifts, so their travel and peak velocity are
  ground truth for what a shift looks like; the idle detector then asks for a
  sustained velocity above a fraction of that, with a minimum net travel that
  rejects sway. A threshold with no provenance is just another guess wearing
  instrumentation.

  THE LOOK-AROUND RATE COMES FROM HEAD YAW IN THE BODY FRAME. The plan was to
  read the Head joint's local channels, but in this retarget the Head channels
  are FROZEN — constant to 1e-6 degrees in every clip checked (the retarget
  baked head motion into Neck). And no single Euler channel is "yaw" either:
  Neck Xrotation carries variance ~1000 deg^2 in l_aro (look around) AND in
  l_up/l_dow (pitch actions), because the LAFAN skeleton runs bones along
  local +X and the X/Y/Z Euler composition smears one anatomical motion across
  channels. So yaw is computed by forward kinematics: compose Spine..Head
  local rotations (Hips EXCLUDED, so the result is head-relative-to-body and a
  whole-body turn is not a gaze break), take the head's local +Y axis — its
  world image is horizontal, (-0.12, -0.11, -0.97) mean in idle_00, while
  local X is the bone/up axis at (-0.12, 0.99, -0.09) — and measure its
  azimuth in the hips frame (up = hips-local +X), unwrapped. Validation: the
  labelled l_aro clips sweep 122-144 deg of this yaw while l_pho (look at
  phone, no head turn) stays inside 13 deg.

  SOT: packages/avatar/src/idle/config.ts · .claude/skills/life-layer/SKILL.md
  SOT-KEYWORDS: staystill stats weight shift interval duration sway bvh lafan distributions look around gaze head yaw rate
*/
import { execFileSync, spawnSync } from 'node:child_process';

const zip = process.argv[2] ?? 'assets/motion/staystill/staystill.zip';

const list = execFileSync('unzip', ['-l', zip], { maxBuffer: 1 << 24 })
  .toString('utf8')
  .split('\n')
  .map((line) => line.trim().split(/\s+/).pop())
  .filter((name) => name && name.startsWith('lafan/') && name.endsWith('.bvh'));

/** Hips (x, z) per frame plus the frame time, streamed from the archive. */
function hipsTrack(name) {
  const text = spawnSync('unzip', ['-p', zip, name], { maxBuffer: 1 << 28 }).stdout.toString('utf8');
  const motion = text.indexOf('MOTION');
  const frameTime = Number(/Frame Time:\s*([\d.]+)/.exec(text)?.[1] ?? 0.033333);
  const rows = text
    .slice(motion)
    .split('\n')
    .slice(3)
    .filter((line) => line.trim().length > 0);
  const x = new Float64Array(rows.length);
  const z = new Float64Array(rows.length);
  rows.forEach((row, i) => {
    // Only the root's first columns are needed; avoid splitting all 66.
    const a = row.trim();
    const s1 = a.indexOf(' ');
    const s2 = a.indexOf(' ', s1 + 1);
    const s3 = a.indexOf(' ', s2 + 1);
    x[i] = Number(a.slice(0, s1));
    z[i] = Number(a.slice(s2 + 1, s3));
  });
  return { x, z, dt: frameTime };
}

/** Projection onto the track's own dominant horizontal axis, centimetres. */
function lateral({ x, z }) {
  const n = x.length;
  let mx = 0;
  let mz = 0;
  for (let i = 0; i < n; i += 1) {
    mx += x[i];
    mz += z[i];
  }
  mx /= n;
  mz /= n;
  let sxx = 0;
  let sxz = 0;
  let szz = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - mx;
    const dz = z[i] - mz;
    sxx += dx * dx;
    sxz += dx * dz;
    szz += dz * dz;
  }
  const theta = 0.5 * Math.atan2(2 * sxz, sxx - szz);
  const ax = Math.cos(theta);
  const az = Math.sin(theta);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) out[i] = (x[i] - mx) * ax + (z[i] - mz) * az;
  return out;
}

const smooth = (s, half) => {
  const out = new Float64Array(s.length);
  for (let i = 0; i < s.length; i += 1) {
    const from = Math.max(0, i - half);
    const to = Math.min(s.length - 1, i + half);
    let sum = 0;
    for (let j = from; j <= to; j += 1) sum += s[j];
    out[i] = sum / (to - from + 1);
  }
  return out;
};

const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const sd = Math.sqrt(sorted.reduce((a, v) => a + (v - mean) ** 2, 0) / sorted.length);
  const q = (f) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))];
  return { n: sorted.length, mean, sd, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
};
const fmt = (s, unit) =>
  `n=${s.n}  mean ${s.mean.toFixed(2)}${unit}  sd ${s.sd.toFixed(2)}  p10 ${s.p10.toFixed(2)}  p50 ${s.p50.toFixed(2)}  p90 ${s.p90.toFixed(2)}`;

// ---- 1. the labelled shifts: travel and duration ---------------------------
const weiFiles = list.filter((f) => /\/wei_(lr|rl)/.test(f));
const travels = [];
const durations = [];
const peakVelocities = [];
for (const file of weiFiles) {
  const track = hipsTrack(file);
  /*
    LIGHT smoothing for the duration measure — 0.1 s, not 0.5. A box filter of
    width W turns a step into a W-long ramp, so a 0.5 s smooth puts a hard
    floor of ~0.4 s under every rise time and the first run of this script
    reported p50 = 0.40 s: the filter measuring itself, dressed as a result.
    0.1 s suppresses marker jitter while costing at most 0.08 s of bias.
  */
  const s = smooth(lateral(track), Math.round(0.05 / track.dt));
  const n = s.length;
  const startLevel = s.slice(0, Math.round(0.5 / track.dt)).reduce((a, b) => a + b, 0) / Math.round(0.5 / track.dt);
  const endLevel = s.slice(-Math.round(0.5 / track.dt)).reduce((a, b) => a + b, 0) / Math.round(0.5 / track.dt);
  const travel = Math.abs(endLevel - startLevel);
  if (travel < 0.5) continue; // a clip with no shift in it cannot calibrate one
  travels.push(travel);
  /*
    Rise time, 10% to 90% of the level change — the standard measure, and robust
    to the slow tails a settle has. Onset-to-silence would count the subject
    standing still at both ends of the clip.
  */
  const direction = Math.sign(endLevel - startLevel);
  const at = (fraction) => startLevel + direction * travel * fraction;
  let t10 = -1;
  let t90 = -1;
  for (let i = 0; i < n; i += 1) {
    if (t10 < 0 && direction * (s[i] - at(0.1)) >= 0) t10 = i;
    if (direction * (s[i] - at(0.9)) >= 0) {
      t90 = i;
      break;
    }
  }
  if (t10 >= 0 && t90 > t10) durations.push((t90 - t10) * track.dt);
  let peak = 0;
  for (let i = 1; i < n; i += 1) peak = Math.max(peak, Math.abs(s[i] - s[i - 1]) / track.dt);
  peakVelocities.push(peak);
}
const travelStats = stats(travels);
const durationStats = stats(durations);
const vThreshold = stats(peakVelocities).p50 * 0.25;
const travelFloor = travelStats.p50 * 0.4;

// ---- 2. the idle clips: inter-shift intervals and sway ---------------------
const idleFiles = list.filter((f) => /\/idle\/idle_\d+\.bvh$/.test(f));
const intervals = [];
const swaySds = [];
const shiftsPerClip = [];
for (const file of idleFiles) {
  const track = hipsTrack(file);
  const s = smooth(lateral(track), Math.round(0.25 / track.dt));
  const n = s.length;
  const velocity = new Float64Array(n);
  for (let i = 1; i < n; i += 1) velocity[i] = (s[i] - s[i - 1]) / track.dt;
  const sustain = Math.round(0.3 / track.dt);
  const onsets = [];
  let run = 0;
  let inEvent = false;
  let eventStart = 0;
  for (let i = 0; i < n; i += 1) {
    if (Math.abs(velocity[i]) > vThreshold) {
      run += 1;
      if (!inEvent && run >= sustain) {
        inEvent = true;
        eventStart = i - run + 1;
      }
    } else {
      if (inEvent) {
        // Only a real change of level counts; sway comes back, a shift stays.
        const travel = Math.abs(s[Math.min(n - 1, i + sustain)] - s[Math.max(0, eventStart - sustain)]);
        if (travel >= travelFloor) onsets.push(eventStart * track.dt);
      }
      inEvent = false;
      run = 0;
    }
  }
  const merged = onsets.filter((t, i) => i === 0 || t - onsets[i - 1] > 2);
  shiftsPerClip.push(merged.length);
  for (let i = 1; i < merged.length; i += 1) intervals.push(merged[i] - merged[i - 1]);
  /*
    Sway is the FAST residual, not everything between shifts. Subtracting a 2 s
    running mean first: postural sway lives around 0.1-0.5 Hz, while slow
    repositioning drift — a subject settling a hip over twenty seconds — is
    posture, not sway, and leaving it in reported 5.8 cm of "sway" on people
    who were mostly standing still.
  */
  const slow = smooth(s, Math.round(1.0 / track.dt));
  const still = [];
  for (let i = 0; i < n; i += 1) {
    if (!merged.some((t) => Math.abs(i * track.dt - t) < durationStats.p50 + 1)) still.push(s[i] - slow[i]);
  }
  if (still.length > n / 4) {
    const mean = still.reduce((a, b) => a + b, 0) / still.length;
    swaySds.push(Math.sqrt(still.reduce((a, v) => a + (v - mean) ** 2, 0) / still.length));
  }
}

// ---- 3. look-arounds: head-yaw excursion events ----------------------------
/*
  Verified against the HIERARCHY of lafan/idle/idle_00.bvh: every joint is
  `CHANNELS 3 Xrotation Yrotation Zrotation` after the root's
  `CHANNELS 6 Xposition Yposition Zposition Xrotation Yrotation Zrotation`,
  and the joint order puts the spine chain's rotation triples at 0-based
  columns 30 (Spine), 33 (Spine1), 36 (Spine2), 39 (Neck), 42 (Head).
  BVH composes the listed channels in order: R = Rx * Ry * Rz.
*/
const DEG = Math.PI / 180;
const rotMat = (ex, ey, ez) => {
  const cx = Math.cos(ex * DEG);
  const sx = Math.sin(ex * DEG);
  const cy = Math.cos(ey * DEG);
  const sy = Math.sin(ey * DEG);
  const cz = Math.cos(ez * DEG);
  const sz = Math.sin(ez * DEG);
  // Rx * Ry * Rz, row-major
  return [
    cy * cz, -cy * sz, sy,
    cz * sx * sy + cx * sz, cx * cz - sx * sy * sz, -cy * sx,
    -cx * cz * sy + sx * sz, cz * sx + cx * sy * sz, cx * cy,
  ];
};
const matMul = (a, b) => {
  const o = new Array(9);
  for (let r = 0; r < 3; r += 1)
    for (let c = 0; c < 3; c += 1)
      o[3 * r + c] = a[3 * r] * b[c] + a[3 * r + 1] * b[3 + c] + a[3 * r + 2] * b[6 + c];
  return o;
};

/** Unwrapped head yaw (deg) in the BODY frame per frame, plus frame time. */
function headYawTrack(name) {
  const text = spawnSync('unzip', ['-p', zip, name], { maxBuffer: 1 << 28 }).stdout.toString('utf8');
  const motion = text.indexOf('MOTION');
  const frameTime = Number(/Frame Time:\s*([\d.]+)/.exec(text)?.[1] ?? 0.033333);
  const rows = text
    .slice(motion)
    .split('\n')
    .slice(3)
    .filter((line) => line.trim().length > 0);
  const yaw = new Float64Array(rows.length);
  let prev = 0;
  let offset = 0;
  rows.forEach((row, i) => {
    const f = row.trim().split(/\s+/).map(Number);
    // Hips excluded: yaw relative to the body, not the room.
    let M = rotMat(f[30], f[31], f[32]);
    for (const o of [33, 36, 39, 42]) M = matMul(M, rotMat(f[o], f[o + 1], f[o + 2]));
    // Head local +Y (matrix column 1) is horizontal; azimuth about hips-local
    // +X (the up/bone axis), unwrapped so a sweep through ±180° stays smooth.
    const a = Math.atan2(M[7], M[4]) / DEG;
    if (i > 0) {
      const d = a - prev;
      if (d > 180) offset -= 360;
      else if (d < -180) offset += 360;
    }
    prev = a;
    yaw[i] = a + offset;
  });
  return { yaw, dt: frameTime };
}

/** Running median — robust baseline the look excursions themselves can't drag. */
function runningMedian(s, half) {
  const n = s.length;
  const out = new Float64Array(n);
  const win = [];
  const lowerBound = (v) => {
    let lo = 0;
    let hi = win.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (win[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  for (let i = 0; i < Math.min(n, half); i += 1) win.splice(lowerBound(s[i]), 0, s[i]);
  for (let i = 0; i < n; i += 1) {
    if (i + half < n) win.splice(lowerBound(s[i + half]), 0, s[i + half]);
    if (i - half - 1 >= 0) win.splice(lowerBound(s[i - half - 1]), 1);
    out[i] = win[win.length >> 1];
  }
  return out;
}

// Calibration: 20 labelled l_aro clips give the shape of a look-around.
const aroFiles = list.filter((f) => /\/l_aro_/.test(f)).sort().slice(0, 20);
const aroTracks = aroFiles.map((f) => {
  const { yaw, dt } = headYawTrack(f);
  const s = smooth(yaw, Math.round(0.05 / dt));
  const sorted = [...s].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1];
  let peak = 0;
  for (let i = 0; i < s.length; i += 1) peak = Math.max(peak, Math.abs(s[i] - median));
  return { s, dt, median, peak };
});
const peakYawStats = stats(aroTracks.map((t) => t.peak));
/*
  0.25 of the labelled median peak, the same fraction the shift detector uses
  of its labelled peak velocity: an idle glance is smaller than a staged full
  look-around, but a quarter of one is still far above sway (l_pho, a clip
  with no head turn at all, stays inside ±7° of its median).
*/
const yawThreshold = peakYawStats.p50 * 0.25;
const lookDurations = [];
for (const { s, dt, median } of aroTracks) {
  const sustain = Math.round(0.3 / dt);
  let run = 0;
  for (let i = 0; i <= s.length; i += 1) {
    if (i < s.length && Math.abs(s[i] - median) > yawThreshold) run += 1;
    else {
      if (run >= sustain) lookDurations.push(run * dt);
      run = 0;
    }
  }
}
const lookDurationStats = stats(lookDurations);

// The rate: excursion events in the 50 two-minute idle clips.
const lookIntervals = [];
const looksPerMinute = [];
for (const file of idleFiles) {
  const { yaw, dt } = headYawTrack(file);
  const s = smooth(yaw, Math.round(0.05 / dt));
  // 10 s median window: long against a look (p50 ≈ 1-2 s) so the baseline is
  // the habitual facing, short enough to follow a genuine settling-in turn.
  const base = runningMedian(s, Math.round(5 / dt));
  const sustain = Math.round(0.3 / dt);
  const onsets = [];
  let run = 0;
  for (let i = 0; i <= s.length; i += 1) {
    if (i < s.length && Math.abs(s[i] - base[i]) > yawThreshold) run += 1;
    else {
      if (run >= sustain) onsets.push((i - run) * dt);
      run = 0;
    }
  }
  const merged = onsets.filter((t, i) => i === 0 || t - onsets[i - 1] > 2);
  looksPerMinute.push(merged.length / ((s.length * dt) / 60));
  for (let i = 1; i < merged.length; i += 1) lookIntervals.push(merged[i] - merged[i - 1]);
}

const report = {
  calibration: {
    vThresholdCmPerS: vThreshold,
    travelFloorCm: travelFloor,
    from: `${weiFiles.length} labelled wei clips`,
  },
  shiftTravelCm: travelStats,
  shiftDurationS: durationStats,
  interShiftIntervalS: stats(intervals),
  shiftsPerTwoMinuteClip: stats(shiftsPerClip),
  swaySdCm: stats(swaySds),
  lookCalibration: {
    yawThresholdDeg: yawThreshold,
    from: `${aroFiles.length} labelled l_aro clips`,
  },
  lookPeakYawDeg: peakYawStats,
  lookDurationS: lookDurationStats,
  looksPerMinute: stats(looksPerMinute),
  interLookIntervalS: stats(lookIntervals),
};
console.log(JSON.stringify(report, null, 2));
console.error(`\nshift travel      ${fmt(travelStats, ' cm')}`);
console.error(`shift duration    ${fmt(durationStats, ' s')}`);
console.error(`inter-shift gap   ${fmt(report.interShiftIntervalS, ' s')}`);
console.error(`shifts / 2 min    ${fmt(report.shiftsPerTwoMinuteClip, '')}`);
console.error(`sway sd           ${fmt(report.swaySdCm, ' cm')}`);
console.error(`look peak yaw     ${fmt(peakYawStats, ' deg')}`);
console.error(`look duration     ${fmt(lookDurationStats, ' s')}`);
console.error(`looks / minute    ${fmt(report.looksPerMinute, '')}`);
console.error(`inter-look gap    ${fmt(report.interLookIntervalS, ' s')}`);

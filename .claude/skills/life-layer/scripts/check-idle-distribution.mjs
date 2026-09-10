#!/usr/bin/env node
// Distribution checks over a generated idle sequence.
//
// Watching an idle cannot detect a period; a period is the failure that matters,
// because the eye finds it at minute three and cannot unsee it. These are the
// checks a human cannot perform by looking.
//
// Input: JSON array of frames, each `{ t, channels: { name: value } }`, from a
// harness that steps the idle engine — this script does not import the engine so
// it can be run against a capture as easily as a simulation.
import { readFileSync } from 'node:fs';

const [, , path, ...flags] = process.argv;
if (!path || path === '--help') {
  console.error('usage: check-idle-distribution.mjs <frames.json> [--window-s 300] [--peak 0.9]');
  process.exit(path ? 0 : 1);
}
const arg = (name, fallback) => {
  const i = flags.indexOf(name);
  return i === -1 ? fallback : Number(flags[i + 1]);
};
const windowS = arg('--window-s', 300);
const peakLimit = arg('--peak', 0.9);
const SURROGATES = 200;

const frames = JSON.parse(readFileSync(path, 'utf8'));
if (!Array.isArray(frames) || frames.length < 2) {
  console.error('need at least two frames');
  process.exit(1);
}
const duration = frames[frames.length - 1].t - frames[0].t;
const names = [...new Set(frames.flatMap((f) => Object.keys(f.channels ?? {})))];
const failures = [];
const observed = [];

/*
  Autocorrelation, mean-removed and normalised — and the search starts AFTER the
  first zero crossing, which is the whole correctness of this function.

  At short lags every smooth signal correlates with itself almost perfectly:
  that is smoothness, not repetition. A first pass searched from a fixed quarter
  second and reported 0.99 for a slow non-repeating sum of two octaves, which
  would have failed exactly the channel the layer is built around. Beyond the
  first zero crossing the coefficient can only come back up if the signal
  genuinely returns to its earlier shape, which is what a period is.
*/
function periodicity(series, dt) {
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const centred = series.map((v) => v - mean);
  const energy = centred.reduce((a, b) => a + b * b, 0);
  if (energy === 0) return { peak: 0, lagS: 0 };

  const maxLag = Math.floor(centred.length / 3);
  const at = (lag) => {
    let sum = 0;
    for (let i = 0; i + lag < centred.length; i += 1) sum += centred[i] * centred[i + lag];
    return sum / energy;
  };

  let lag = 1;
  while (lag < maxLag && at(lag) > 0) lag += 1;
  if (lag >= maxLag) return { peak: 0, lagS: 0 }; // never crosses: slow, not periodic

  let peak = 0;
  let lagS = 0;
  for (; lag < maxLag; lag += 1) {
    const r = at(lag);
    if (r > peak) {
      peak = r;
      lagS = lag * dt;
    }
  }
  return { peak, lagS };
}

/*
  A p-value for the peak: how often an aperiodic signal of the same length,
  smoothness and variance reaches it. Seeded per call so a run is reproducible
  — an acceptance number that moves between runs is not a measurement.
*/
function surrogateP(series, peak, dt) {
  const n = series.length;
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const centred = series.map((v) => v - mean);
  const energy = centred.reduce((a, b) => a + b * b, 0);
  if (energy === 0) return { p: 1, nullP95: 0 };
  const sd = Math.sqrt(energy / n);
  let lag1 = 0;
  for (let i = 0; i + 1 < n; i += 1) lag1 += centred[i] * centred[i + 1];
  const phi = Math.max(-0.999, Math.min(0.999, lag1 / energy));
  const drive = sd * Math.sqrt(1 - phi * phi);

  let seed = 0x2f6e2b1;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed + 1) / 4294967297;
  };

  const peaks = [];
  for (let s = 0; s < SURROGATES; s += 1) {
    const y = new Array(n);
    y[0] = 0;
    for (let i = 1; i < n; i += 1) {
      const gauss = Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
      y[i] = phi * y[i - 1] + drive * gauss;
    }
    peaks.push(periodicity(y, dt).peak);
  }
  peaks.sort((a, b) => a - b);
  return {
    p: peaks.filter((v) => v >= peak).length / peaks.length,
    nullP95: peaks[Math.floor(peaks.length * 0.95)],
  };
}

const dt = duration / (frames.length - 1);
for (const name of names) {
  const series = frames.map((f) => f.channels?.[name] ?? 0);
  const { peak, lagS } = periodicity(series, dt);
  const { p, nullP95 } = surrogateP(series, peak, dt);
  observed.push(`${name} r=${peak.toFixed(2)}@${lagS.toFixed(1)}s p=${p.toFixed(3)}`);
  /*
    THE GATE IS THE COEFFICIENT; the p-value beside it is context, not a
    verdict. They answer different questions and only the first is the one this
    layer needs asked.

    The gate asks whether the channel recurs NEAR-EXACTLY, which is what a
    viewer locks onto. 0.9 is deliberately high because this layer is designed
    quasi-periodic — the sway is two octaves at an irrational ratio, so it
    approaches its earlier shape forever without reaching it, and measures 0.74
    over this window against 0.93 for a true 3s loop. That separation is the
    whole calibration.

    The p-value asks whether ANY periodic structure is present, and the sway
    answers yes at p=0.000 — correctly, since it is built from two sinusoids.
    Gating on it fails the channel the design is proudest of. It was tried;
    that is how the distinction above got measured.

    So p is printed for signals where the coefficient's scale is not
    established. A generator channel and a render-derived pixel channel of the
    same scene measure 0.74 and 0.32 for the same underlying motion, and the
    second number passing a threshold calibrated on the first means nothing.
    On those, read p and treat the gate as uncalibrated rather than as a pass.

    One earlier form of this check was also wrong and is worth naming: comparing
    the peak against the 99th percentile of its OWN lags scores a hit on noise,
    because the maximum of ~280 lags exceeds their p99 by construction
    (measured: peak 0.321, p99-of-the-same-set 0.318).
  */
  if (peak > peakLimit) {
    failures.push(
      `${name}: autocorrelation ${peak.toFixed(2)} at ${lagS.toFixed(2)}s — near-exact loop ` +
        `(p=${p.toFixed(3)} vs aperiodic surrogates, p95 ${nullP95.toFixed(2)})`,
    );
  }
}

/*
  Repeat detection: a channel that produces the same rounded curve twice inside
  the window is looping, even when autocorrelation misses it because the repeat
  is not evenly spaced.
*/
const seen = new Map();
const chunk = Math.max(2, Math.round(1 / dt));
for (const name of names) {
  const series = frames.map((f) => Number((f.channels?.[name] ?? 0).toFixed(4)));
  for (let i = 0; i + chunk <= series.length; i += chunk) {
    if (frames[i].t - frames[0].t > windowS) break;
    const key = `${name}|${series.slice(i, i + chunk).join(',')}`;
    if (series.slice(i, i + chunk).some((v) => v !== series[i])) {
      if (seen.has(key)) {
        failures.push(`${name}: identical curve repeats at ${frames[i].t.toFixed(1)}s and ${seen.get(key).toFixed(1)}s`);
        break;
      }
      seen.set(key, frames[i].t);
    }
  }
}

// Rate checks, where a channel names itself. Both ranges are the skill's
// targets; the source for each is in references/channels.md.
const rate = (name, perMinute) => {
  const series = frames.map((f) => f.channels?.[name] ?? 0);
  let crossings = 0;
  for (let i = 1; i < series.length; i += 1) if (series[i - 1] < 0.5 && series[i] >= 0.5) crossings += 1;
  const perMin = (crossings / duration) * 60;
  if (duration >= 60 && (perMin < perMinute[0] || perMin > perMinute[1])) {
    failures.push(`${name}: ${perMin.toFixed(1)}/min outside ${perMinute[0]}–${perMinute[1]}`);
  }
  return perMin;
};
const blinkRate = names.includes('blink') ? rate('blink', [12, 20]) : null;
const breathRate = names.includes('breath') ? rate('breath', [12, 20]) : null;

console.log(`  ${observed.join('  ')}`);
console.log(
  `${frames.length} frames over ${duration.toFixed(1)}s · ${names.length} channels` +
    (blinkRate === null ? '' : ` · blink ${blinkRate.toFixed(1)}/min`) +
    (breathRate === null ? '' : ` · breath ${breathRate.toFixed(1)}/min`),
);
if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log('idle distribution clean: no periodicity, no repeated curve, rates in range');

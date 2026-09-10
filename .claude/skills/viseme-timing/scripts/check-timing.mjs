#!/usr/bin/env node
// The gate. Scores an emitted viseme schedule against MFA phoneme onsets and
// exits non-zero when it fails.
//
// Usage:
//   node check-timing.mjs <schedule.json> <reference.json> [--fps 60]
//
// <schedule.json>  a Track: [ [timeSeconds, {channel: weight}], ... ]
// <reference.json> MFA ground truth for the SAME render:
//   { "lang": "en",
//     "phonemes": [ { "p": "P", "start": 0.021, "end": 0.058 }, ... ] }
//
// Convert an MFA TextGrid to that shape with the aligner's own export; do not
// hand-transcribe one, and do not reuse a TextGrid across renders -- a change
// to model_id, voice_settings or output_format changes the audio it describes.
//
// Gate (references/test-set.md):
//   median |viseme onset - phoneme onset| <= 40 ms
//   p95    |viseme onset - phoneme onset| <= 80 ms
//   max visual-late                       <= 45 ms   (ITU-R BT.1359-1)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const TABLE = JSON.parse(
  readFileSync(join(here, '..', 'references', 'viseme-classes.json'), 'utf8'),
);

export const GATE = Object.freeze({
  medianMs: 40,
  p95Ms: 80,
  // Positive = the mouth is behind the sound. ITU-R BT.1359-1 detectability
  // for sound advanced. https://www.itu.int/rec/R-REC-BT.1359
  maxVisualLateMs: 45,
});

/**
 * The moment a class becomes visible in the schedule: the first frame where
 * the class's own dominant channel crosses a fraction of its own peak.
 *
 * Onset, not peak, because the gate is about when the mouth STARTS doing the
 * thing. A peak-based measure hides a slow attack completely.
 */
function classOnset(track, cls, searchFrom, searchTo, threshold = 0.3) {
  const shape = TABLE.classes[cls]?.shape;
  if (shape === undefined) return null;
  const channels = Object.keys(shape);
  if (channels.length === 0) return null;

  const dominant = channels.reduce((a, b) => (shape[b] > shape[a] ? b : a));

  const window = track.filter(([t]) => t >= searchFrom && t <= searchTo);
  if (window.length === 0) return null;

  // Peak nearest the phoneme's own span, then walk BACK to the last frame
  // below threshold. Scanning forward from the window edge instead would
  // return the previous phoneme's onset whenever two spans share a class --
  // "pop", "bubble" and every other repeated bilabial.
  let peakIdx = 0;
  for (let i = 1; i < window.length; i++) {
    if ((window[i][1][dominant] ?? 0) > (window[peakIdx][1][dominant] ?? 0)) peakIdx = i;
  }
  const peak = window[peakIdx][1][dominant] ?? 0;
  if (peak <= 1e-3) return null;

  let i = peakIdx;
  while (i > 0 && (window[i - 1][1][dominant] ?? 0) >= peak * threshold) i--;
  return window[i][0];
}

export function score(track, reference, windowS = 0.15) {
  const lang = reference.lang ?? 'en';
  const map = lang === 'es' ? TABLE.ipaEs : TABLE.arpabet;

  const deltas = [];
  const unmatched = [];

  const phonemes = reference.phonemes;
  for (let i = 0; i < phonemes.length; i++) {
    const ph = phonemes[i];
    const entry = map[ph.p];
    if (entry === undefined || entry.class === null || entry.class === undefined) continue;

    // Clip the search to the neighbours' midpoints. Without this, a repeated
    // class -- "pop", "bubble", any sentence with two /p/ in it -- matches the
    // PREVIOUS occurrence's onset and reports a fixed negative delta that looks
    // like a systematic lead and is actually a matching bug.
    const previous = phonemes[i - 1];
    const next = phonemes[i + 1];
    const from = Math.max(
      ph.start - windowS,
      previous === undefined ? -Infinity : (previous.start + previous.end) / 2,
    );
    const to = Math.min(
      ph.end + windowS,
      next === undefined ? Infinity : (next.start + next.end) / 2,
    );

    const onset = classOnset(track, entry.class, from, to);
    if (onset === null) {
      unmatched.push(ph.p);
      continue;
    }
    // Positive delta = the viseme is LATE relative to the phoneme.
    deltas.push({ p: ph.p, deltaMs: (onset - ph.start) * 1000 });
  }

  if (deltas.length === 0) {
    return { ok: false, reason: 'no phoneme matched a viseme onset', unmatched, deltas };
  }

  const abs = deltas.map((d) => Math.abs(d.deltaMs)).sort((a, b) => a - b);
  const median = abs[Math.floor(abs.length * 0.5)];
  const p95 = abs[Math.min(abs.length - 1, Math.floor(abs.length * 0.95))];
  const maxLate = deltas.reduce((m, d) => Math.max(m, d.deltaMs), -Infinity);

  const ok =
    median <= GATE.medianMs && p95 <= GATE.p95Ms && maxLate <= GATE.maxVisualLateMs;

  return {
    ok,
    count: deltas.length,
    medianMs: median,
    p95Ms: p95,
    maxVisualLateMs: maxLate,
    worst: [...deltas].sort((a, b) => Math.abs(b.deltaMs) - Math.abs(a.deltaMs)).slice(0, 8),
    unmatched,
    deltas,
  };
}

function main(argv) {
  const [schedulePath, referencePath] = argv.slice(2).filter((a) => !a.startsWith('--'));
  if (schedulePath === undefined || referencePath === undefined) {
    process.stderr.write('usage: check-timing.mjs <schedule.json> <reference.json>\n');
    process.exit(2);
  }

  const track = JSON.parse(readFileSync(schedulePath, 'utf8'));
  const reference = JSON.parse(readFileSync(referencePath, 'utf8'));
  const result = score(track, reference);

  const line = (label, value, limit) =>
    `${label.padEnd(20)} ${value.toFixed(1).padStart(7)} ms   limit ${limit} ms   ${value <= limit ? 'pass' : 'FAIL'}`;

  if (result.reason !== undefined) {
    process.stderr.write(`${result.reason}\n`);
    process.exit(1);
  }

  process.stdout.write(`phonemes scored: ${result.count}\n`);
  process.stdout.write(line('median |delta|', result.medianMs, GATE.medianMs) + '\n');
  process.stdout.write(line('p95 |delta|', result.p95Ms, GATE.p95Ms) + '\n');
  process.stdout.write(
    line('max visual-late', result.maxVisualLateMs, GATE.maxVisualLateMs) + '\n',
  );

  if (result.unmatched.length > 0) {
    process.stdout.write(
      `unmatched phonemes (${result.unmatched.length}): ${[...new Set(result.unmatched)].join(' ')}\n`,
    );
  }
  if (!result.ok) {
    process.stdout.write('\nworst offenders:\n');
    for (const w of result.worst) {
      process.stdout.write(`  ${w.p.padEnd(5)} ${w.deltaMs >= 0 ? '+' : ''}${w.deltaMs.toFixed(1)} ms\n`);
    }
  }

  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv);

#!/usr/bin/env node
// The impossible-face detector. Reads a frame stream of named channel weights
// and fails on any frame where mutually exclusive controls are both active.
//
// Conflicting AUs are a class of bug, not a list of incidents, so this runs in
// CI over every generated performance rather than being checked by eye once.
//
// Usage:
//   node impossible-face.mjs <frames.json> [--max-report 20]
//   node impossible-face.mjs --self-test
//
// <frames.json> is either:
//   a Track            [ [timeSeconds, {channel: weight}], ... ]
//   or an A2F response { fps, names: [...], frames: [[...], ...] }
//                      -- the shape packages/voice/src/a2f.ts:31 returns
//
// Exits 0 when clean, 1 on any conflict, 2 on bad input.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const CONTRACT = JSON.parse(
  readFileSync(join(here, '..', 'references', 'contract.json'), 'utf8'),
);

/** A2F frames or a Track, both to [time, shape] pairs. */
export function toFrames(payload) {
  if (Array.isArray(payload)) {
    return payload.map(([t, shape]) => [t, shape]);
  }
  if (payload !== null && typeof payload === 'object' && Array.isArray(payload.names)) {
    const { fps, names, frames } = payload;
    if (!(fps > 0)) throw new Error('A2F payload has no positive fps');
    return frames.map((row, k) => {
      const shape = Object.create(null);
      for (let i = 0; i < names.length; i++) if (row[i] > 1e-4) shape[names[i]] = row[i];
      return [k / fps, shape];
    });
  }
  throw new Error('expected a Track array or an A2F { fps, names, frames } object');
}

const peak = (shape, channels) =>
  channels.reduce((m, c) => Math.max(m, shape[c] ?? 0), 0);

export function detect(frames) {
  const violations = [];

  for (const [t, shape] of frames) {
    for (const rule of CONTRACT.conflicts) {
      const a = peak(shape, rule.a);
      const b = peak(shape, rule.b);
      if (a >= rule.thresholdA && b >= rule.thresholdB) {
        violations.push({
          t,
          id: rule.id,
          a: Number(a.toFixed(4)),
          b: Number(b.toFixed(4)),
          why: rule.why,
        });
      }
    }
  }

  return violations;
}

/**
 * Channels nobody in the contract owns. Not a conflict, but the other silent
 * failure: directEncoder drops unknown names and setMorph no-ops on a missing
 * morph, so an unowned channel writes nothing and reports nothing.
 */
export function unownedChannels(frames) {
  const known = new Set(Object.keys(CONTRACT.channels));
  const seen = new Set();
  for (const [, shape] of frames) {
    for (const name of Object.keys(shape)) if (!known.has(name)) seen.add(name);
  }
  return [...seen];
}

/* ------------------------------------------------------------------ self-test */

function selfTest() {
  let failures = 0;
  const check = (name, condition) => {
    if (!condition) {
      failures++;
      process.stderr.write(`self-test FAIL: ${name}\n`);
    }
  };

  // Every conflict rule must actually fire on a frame built to break it.
  // A detector nobody has seen catch anything is not evidence.
  for (const rule of CONTRACT.conflicts) {
    const shape = Object.create(null);
    for (const c of rule.a) shape[c] = rule.thresholdA;
    for (const c of rule.b) shape[c] = rule.thresholdB;
    const hits = detect([[0, shape]]);
    check(`${rule.id} fires at its thresholds`, hits.some((v) => v.id === rule.id));

    const under = Object.create(null);
    for (const c of rule.a) under[c] = rule.thresholdA;
    for (const c of rule.b) under[c] = rule.thresholdB * 0.5;
    check(
      `${rule.id} does not fire below threshold`,
      !detect([[0, under]]).some((v) => v.id === rule.id),
    );
  }

  // A plain articulating mouth must be clean: an open vowel with spread lips.
  check(
    'open vowel is clean',
    detect([[0, { jawOpen: 0.62, mouthLowerDownLeft: 0.38, mouthLowerDownRight: 0.38, mouthStretchLeft: 0.2 }]])
      .length === 0,
  );

  // A bilabial closure as the viseme table produces it must be clean.
  check(
    'bilabial closure is clean',
    detect([[0, { mouthClose: 0.85, mouthPressLeft: 0.6, mouthPressRight: 0.6, jawOpen: 0.06 }]])
      .length === 0,
  );

  // The two live examples from packages/avatar/src/emotion.ts.
  check(
    'happiness preset over an open vowel is clean under the cap',
    detect([[0, { jawOpen: 0.62, mouthSmileLeft: 0.45, mouthSmileRight: 0.45, cheekSquintLeft: 0.25 }]])
      .length === 0,
  );
  check(
    'surprise jawOpen floor against a bilabial is caught',
    detect([[0, { mouthClose: 0.85, jawOpen: 0.15 + 0.06 }]]).some(
      (v) => v.id === 'closed-and-jaw-open',
    ),
  );

  // A2F payload shape round-trips.
  const a2f = toFrames({ fps: 30, names: ['jawOpen', 'mouthClose'], frames: [[0.5, 0], [0, 0.9]] });
  check('A2F payload converts', a2f.length === 2 && a2f[1][0] === 1 / 30);

  check('unowned channel is reported', unownedChannels([[0, { eyesWide: 0.4 }]]).includes('eyesWide'));

  if (failures > 0) {
    process.stderr.write(`\n${failures} self-test failure(s)\n`);
    process.exit(1);
  }
  process.stdout.write(
    `self-test passed: ${CONTRACT.conflicts.length} conflict rules, each proven to fire and to stay quiet below threshold\n`,
  );
}

/* ----------------------------------------------------------------------- cli */

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--self-test')) return selfTest();

  const path = args.find((a) => !a.startsWith('--'));
  if (path === undefined) {
    process.stderr.write('usage: impossible-face.mjs <frames.json> | --self-test\n');
    process.exit(2);
  }

  const maxFlag = args.indexOf('--max-report');
  const maxReport = maxFlag === -1 ? 20 : Number(args[maxFlag + 1]);

  let frames;
  try {
    frames = toFrames(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(2);
  }

  const unowned = unownedChannels(frames);
  if (unowned.length > 0) {
    process.stdout.write(
      `channels with no owner in the contract (these write nothing and warn nothing): ${unowned.join(' ')}\n`,
    );
  }

  const violations = detect(frames);
  if (violations.length === 0) {
    process.stdout.write(`clean: ${frames.length} frames, ${CONTRACT.conflicts.length} rules\n`);
    process.exit(unowned.length > 0 ? 1 : 0);
  }

  const byId = new Map();
  for (const v of violations) byId.set(v.id, (byId.get(v.id) ?? 0) + 1);

  process.stdout.write(`impossible face: ${violations.length} frame-violations across ${frames.length} frames\n\n`);
  for (const [id, count] of byId) {
    const rule = CONTRACT.conflicts.find((r) => r.id === id);
    process.stdout.write(`  ${id}  x${count}\n    ${rule.why}\n`);
  }
  process.stdout.write('\nfirst occurrences:\n');
  for (const v of violations.slice(0, maxReport)) {
    process.stdout.write(`  t=${v.t.toFixed(3)}s  ${v.id}  a=${v.a} b=${v.b}\n`);
  }
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv);

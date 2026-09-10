#!/usr/bin/env node
// Keeps the performance table honest against the two things it derives from:
// the installed tone palette and the installed face contract.
//
// The palette is CLOSED. A performance table with a key the palette does not
// have is a tone nobody can select; a palette key with no performance row is a
// tone that renders as nothing. Both are silent, and both are exactly the drift
// this check exists to catch -- there is already one instance of it in the repo
// (see --repo-drift).
//
// Usage:
//   node check-tone-table.mjs [--repo <path-to-repo-root>]
//
// Exits 0 clean, 1 on any failure.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const TABLE = JSON.parse(
  readFileSync(join(here, '..', 'references', 'tone-performance.json'), 'utf8'),
);

const CONTRACT_PATH = join(here, '..', '..', 'face-adapter', 'references', 'contract.json');

/**
 * Tone keys as declared in packages/voice/src/tones.ts.
 *
 * Read from the source rather than a copy, because a copy is the failure. The
 * palette is a frozen object literal whose keys are quoted string literals at
 * one indent level inside `TONE_PALETTE`, which is a stable enough shape to
 * parse without a TypeScript compiler in this checker's dependency set.
 */
export function palettekeysFrom(source) {
  // `export const TONE_PALETTE_VERSION` is declared first and shares the
  // prefix, so anchor on the assignment rather than the name.
  const start = source.search(/export const TONE_PALETTE\s*=/);
  if (start === -1) throw new Error('TONE_PALETTE not found in tones.ts');
  const open = source.indexOf('{', start);
  if (open === -1) throw new Error('TONE_PALETTE has no object literal');

  let depth = 0;
  let end = -1;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) throw new Error('TONE_PALETTE object literal is unbalanced');

  const body = source.slice(open + 1, end);
  const keys = [];
  let nested = 0;
  for (const line of body.split('\n')) {
    const match = nested === 0 ? /^\s{2}'([a-z0-9-]+)':\s*\{/.exec(line) : null;
    if (match !== null) keys.push(match[1]);
    for (const ch of line) {
      if (ch === '{') nested++;
      else if (ch === '}') nested--;
    }
  }
  return keys;
}

export function paletteVersionFrom(source) {
  const match = /export const TONE_PALETTE_VERSION\s*=\s*(\d+)/.exec(source);
  if (match === null) throw new Error('TONE_PALETTE_VERSION not found');
  return Number(match[1]);
}

function main(argv) {
  const flag = argv.indexOf('--repo');
  const repo = flag === -1 ? resolve(here, '..', '..', '..', '..') : resolve(argv[flag + 1]);

  const failures = [];
  const fail = (message) => failures.push(message);

  /* -------------------------------------------------- palette keys match */

  const tonesPath = join(repo, 'packages', 'voice', 'src', 'tones.ts');
  if (!existsSync(tonesPath)) {
    process.stderr.write(`cannot find ${tonesPath} -- pass --repo <repo root>\n`);
    process.exit(2);
  }
  const source = readFileSync(tonesPath, 'utf8');
  const installed = palettekeysFrom(source);
  const version = paletteVersionFrom(source);
  const declared = Object.keys(TABLE.tones);

  for (const key of installed) {
    if (!declared.includes(key)) fail(`palette key "${key}" has no performance row`);
  }
  for (const key of declared) {
    if (!installed.includes(key)) fail(`performance row "${key}" is not in the palette`);
  }
  if (TABLE.paletteVersion !== version) {
    fail(
      `table says paletteVersion ${TABLE.paletteVersion}, tones.ts says ${version} -- the palette changed and the performances were not reviewed`,
    );
  }

  /* -------------------------------------------- moments match the palette */

  for (const key of installed) {
    const row = TABLE.tones[key];
    if (row === undefined) continue;
    const pattern = new RegExp(`'${key}':\\s*\\{[\\s\\S]*?moment:\\s*'([^']*)'`);
    const match = pattern.exec(source);
    if (match !== null && match[1] !== row.moment) {
      fail(`"${key}" moment drifted: table "${row.moment}" vs palette "${match[1]}"`);
    }
  }

  /* ------------------------------------------------ contract conformance */

  let contract = null;
  if (existsSync(CONTRACT_PATH)) {
    contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  } else {
    fail('face-adapter contract.json is missing; AU channels cannot be checked');
  }

  for (const [key, row] of Object.entries(TABLE.tones)) {
    for (const au of row.aus) {
      if (!(au.min >= 0 && au.max <= 1 && au.min <= au.max)) {
        fail(`${key}/${au.au}: range [${au.min}, ${au.max}] is not an ordered 0..1 pair`);
      }
      if (contract === null) continue;
      for (const channel of au.channels) {
        const spec = contract.channels[channel];
        if (spec === undefined) {
          fail(`${key}/${au.au}: channel "${channel}" is not in the face contract`);
          continue;
        }
        if (spec.owner !== 'expression') {
          fail(
            `${key}/${au.au}: channel "${channel}" is owned by "${spec.owner}", not expression -- a tone may not write it`,
          );
        }
        const ceiling = spec.expressionMax ?? spec.range[1];
        if (au.max > ceiling) {
          fail(
            `${key}/${au.au}: max ${au.max} exceeds the contract ceiling ${ceiling} on "${channel}"`,
          );
        }
      }
    }
  }

  /* ------------------------------------------------------ envelope rules */

  for (const [key, row] of Object.entries(TABLE.tones)) {
    const e = row.envelope;
    if (!(e.onsetMs > 0)) fail(`${key}: onsetMs must be positive -- an instant expression is a glitch`);
    // No permanent smile: every tone releases, sustained or not.
    if (!(e.releaseMs > 0)) fail(`${key}: releaseMs must be positive -- a tone that never releases is a mask`);
    if (e.sustained !== true && !(e.apexMs > 0)) {
      fail(`${key}: apexMs must be positive unless the tone is explicitly sustained`);
    }
  }

  /* ----------------------------------------- approval boundary, asserted */

  // Acknowledgment is not approval. A tone that fires on a wrong answer, a
  // named misconception, an off-topic redirect or a safety moment must not
  // raise the lip corners into something a child can read as "correct".
  const NO_APPROVAL = {
    'gentle-after-miss': 0.1,
    'naming-the-mistake': 0.1,
    'calm-refocus': 0.12,
    'safety-serious': 0.0,
  };
  for (const [key, ceiling] of Object.entries(NO_APPROVAL)) {
    const row = TABLE.tones[key];
    if (row === undefined) continue;
    const au12 = row.aus.find((a) => a.au === 'AU12');
    const max = au12 === undefined ? 0 : au12.max;
    if (max > ceiling) {
      fail(`${key}: AU12 max ${max} exceeds the no-approval ceiling ${ceiling} -- this smile reads as "that was right"`);
    }
  }

  /* -------------------------------------------------- gestures are gated */

  const gatePath = join(repo, 'packages', 'avatar', 'src', 'safety', 'gesture-gate.ts');
  if (existsSync(gatePath)) {
    const gate = readFileSync(gatePath, 'utf8');
    const permitted = new Set([...gate.matchAll(/\{\s*id:\s*'([a-z-]+)',\s*fn:/g)].map((m) => m[1]));
    for (const [key, row] of Object.entries(TABLE.tones)) {
      for (const id of row.gestures ?? []) {
        if (!permitted.has(id)) {
          fail(`${key}: gesture "${id}" is not in PERMITTED_GESTURES -- the vocabulary is closed and fails closed`);
        }
      }
    }
  } else {
    fail('gesture-gate.ts is missing; gesture ids cannot be checked');
  }

  /* --------------------------------------------------------- band cover */

  const bandPath = join(repo, 'packages', 'student-model', 'src', 'voice-band.ts');
  if (existsSync(bandPath)) {
    const bandSource = readFileSync(bandPath, 'utf8');
    const match = /export const VOICE_BANDS = \[([^\]]*)\]/.exec(bandSource);
    if (match !== null) {
      const bands = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
      for (const band of bands) {
        if (TABLE.bands[band] === undefined) fail(`band "${band}" has no modulation entry`);
      }
      for (const band of Object.keys(TABLE.bands)) {
        if (!bands.includes(band)) fail(`modulation entry "${band}" is not a VoiceBand`);
      }
    }
  } else {
    fail('voice-band.ts is missing; band coverage cannot be checked');
  }

  /* ------------------------------------------------------- repo drift note */

  const appTonePath = join(repo, 'packages', 'app', 'features', 'tutor', 'tutor-tone.ts');
  if (existsSync(appTonePath)) {
    const appSource = readFileSync(appTonePath, 'utf8');
    const appKeys = [...appSource.matchAll(/^\s{2}'([a-z0-9-]+)':\s*\{/gm)].map((m) => m[1]);
    const missing = installed.filter((k) => !appKeys.includes(k));
    if (missing.length > 0) {
      process.stdout.write(
        `\nREPO DRIFT (reported, not this table's fault): packages/app/features/tutor/tutor-tone.ts is missing ${missing.length} palette key(s): ${missing.join(' ')}\n` +
          `  toneRenderFor falls back to 'thinking-together' for an unknown key, so those tones render a NEUTRAL face while the voice renders their own recipe.\n`,
      );
    }
  }

  /* -------------------------------------------------------------- report */

  if (failures.length > 0) {
    process.stderr.write(`\n${failures.length} failure(s):\n`);
    for (const f of failures) process.stderr.write(`  ${f}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `tone table clean: ${installed.length} palette keys (v${version}), ` +
      `${Object.values(TABLE.tones).reduce((n, r) => n + r.aus.length, 0)} AU entries, ` +
      `${Object.keys(TABLE.bands).length} bands, all channels expression-owned and inside the contract ceiling\n`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv);

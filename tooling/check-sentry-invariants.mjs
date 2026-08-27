#!/usr/bin/env node
// Doc 35 §8 PR-136: the §7 verification checklist's grep-able rows as a build
// gate, because every one of them is a LAW (child privacy, quota survival) that
// a refactor can silently repeal. Rows enforced: 1 (sendDefaultPii false
// everywhere), 2 (no replay anywhere — §7.4 is not a sampling decision), 5
// (expected offline is breadcrumbs, never events), 6 (traces off), 9 (tag
// allowlist). Rows 7/8/12 live in Sentry's UI and are checklisted in
// `packages/app/core/telemetry-options.ts`.
//
// TEXTUAL, like every gate in this directory — the rules are "these files may
// not say these things", which is a property of the source. `pnpm lint`.
// SOT: docs/pack/35-sentry-free-tier.md §7 · packages/app/core/telemetry-options.ts
// SOT-KEYWORDS: sentry invariants check gate sendDefaultPii replay traces tag allowlist offline capture grep lint
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SCAN_ROOTS = ['apps', 'packages'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.expo', '.turbo']);
const SOURCE = /\.(ts|tsx|mts|mjs)$/;

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (SOURCE.test(entry)) files.push(path);
  }
};
for (const root of SCAN_ROOTS) walk(join(ROOT, root));

const failures = [];
const fail = (file, line, rule) => failures.push(`${relative(ROOT, file)}:${line} — ${rule}`);
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** Doc 35 §7.7 — the whole tag vocabulary. Anything else is a review, i.e. a failure here. */
const TAG_ALLOWLIST = new Set(['band', 'surface', 'release', 'runtime', 'queue', 'jobId']);

/**
 * Row 2/§7.4 — replay, by any of its names. No allowlist and no "sampled at 0"
 * escape hatch: doc 35 §4.3 ships v1 with the replay SDK absent from every
 * surface, because "no replay code a child's surface can reach" is checkable
 * and "the sample rate is zero" is one env var from not being true.
 */
const REPLAY = /replayIntegration|mobileReplayIntegration|@sentry\/replay|replay-canvas|replays(?:Session|OnError)SampleRate/;

/** Row 5 — doc 24's offline capture queue: transitions are breadcrumbs, never events. */
const OFFLINE_QUEUE = /packages\/app\/features\/media\/upload-queue[^/]*$/;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).replaceAll('\\', '/');

  // Row 1 — sendDefaultPii must be literally false at every occurrence.
  for (const match of text.matchAll(/sendDefaultPii\s*[:=]\s*([A-Za-z0-9_.]+)/g)) {
    if (match[1] !== 'false') {
      fail(file, lineOf(text, match.index), `sendDefaultPii must be false, found '${match[1]}' (doc 35 §7.1)`);
    }
  }

  // Row 6 — tracesSampleRate must be literally 0 at every occurrence. The
  // sanctioned Phase-1 tracesSampler exception (§2) would be a deliberate,
  // temporary edit to THIS check too — that is the point of the gate.
  // The value ends at whitespace, a delimiter, or a backtick — the backtick so
  // that prose in comments quoting `tracesSampleRate: 0` parses as '0' too.
  for (const match of text.matchAll(/tracesSampleRate\s*[:=]\s*([^,;\n\s`]+)/g)) {
    if (match[1].trim() !== '0') {
      fail(file, lineOf(text, match.index), `tracesSampleRate must be 0, found '${match[1].trim()}' (doc 35 §2)`);
    }
  }

  // Row 2 — no replay, anywhere in product code.
  {
    const match = REPLAY.exec(text);
    if (match) {
      fail(file, lineOf(text, match.index), `replay is law-forbidden on every surface ('${match[0]}', doc 35 §7.4)`);
    }
  }

  // Row 5 — the offline upload queue may not file events.
  if (OFFLINE_QUEUE.test(rel)) {
    const match = /captureException|captureMessage|captureEvent|@sentry\//.exec(text);
    if (match) {
      fail(file, lineOf(text, match.index), `expected-offline paths log breadcrumbs, never events ('${match[0]}', doc 35 §4.1)`);
    }
  }

  // Row 9 — tag/user/context discipline, scoped to files that talk to Sentry.
  if (/from\s+['"]@sentry\//.test(text)) {
    for (const match of text.matchAll(/\.setTag\(\s*(['"`]?)([^'"`,)]+)\1/g)) {
      const quoted = match[1] !== '';
      const key = match[2].trim();
      if (!quoted) {
        fail(file, lineOf(text, match.index), `setTag key must be a string literal, found '${key}' (doc 35 §7.7)`);
      } else if (!TAG_ALLOWLIST.has(key)) {
        fail(file, lineOf(text, match.index), `tag '${key}' is outside the §7.7 allowlist (band|surface|release|runtime|queue|jobId)`);
      }
    }
    for (const match of text.matchAll(/\.setUser\(\s*([^)]*)\)/g)) {
      const arg = match[1].trim();
      const idOnly = /^\{\s*id\s*:[^,}]+\}$/.test(arg);
      if (arg !== 'null' && !idOnly) {
        fail(file, lineOf(text, match.index), `setUser carries a pseudonymous id or null, nothing else (doc 35 §7.2)`);
      }
    }
    for (const match of text.matchAll(/\.setContext\(/g)) {
      fail(file, lineOf(text, match.index), `setContext is a review, not a default — the contexts allowlist lives in telemetry-scrub.ts (doc 35 §7.7)`);
    }
  }
}

if (failures.length > 0) {
  console.error(`check-sentry-invariants: ${failures.length} violation(s)\n`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log(`check-sentry-invariants: ${files.length} files clean (PII off, no replay, traces 0, tags lawful, offline silent)`);

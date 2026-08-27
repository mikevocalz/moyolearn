#!/usr/bin/env node
// Doc 12 §5: "Fail-closed rule: if any safety layer is unavailable, tutoring
// pauses — 'Natalie is taking a break' (never an error screen at a child)."
//
// The rule was VACUOUS for a while, and quietly: `coach.service.ts` caught
// everything into one retryable `unavailable` frame, justified by a comment
// saying the plane returns an outcome rather than throwing. That was true only
// because L3/L4/L5 are pure regex and cannot be unavailable. The first
// model-backed classifier (doc 18 §3 layer 5) would have inverted the rule
// without anyone touching the line — a retry into an UNSCREENED tutor.
//
// So the check is not "does a fail-closed branch exist" — a branch is easy to
// write and easy to delete. It is four structural facts that together make the
// branch load-bearing:
//
//   1. every `catch` on the coaching boundary classifies `SafetyLayerUnavailable`
//   2. every safety-layer call on that boundary sits inside the classified try
//   3. every classifier and firewall call in the plane goes through `safetyLayer`
//   4. the client turns `blocked` into `paused` and `unavailable` into `retry`
//
// Break any one and the rule stops holding, so breaking any one fails the build.
//
// It parses rather than greps because the questions are positional — "is this
// call inside that block" — and because the files it reads are full of regex
// literals and apostrophes that defeat a line-oriented scan. The lexer below is
// the smallest thing that answers them correctly; `typescript` would answer them
// better, but it is not a root dependency and adding it churned 300 lines of
// lockfile that belong to nobody's change.
// SOT: docs/pack/12-systems-design-prompt.md §5 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: fail closed check safety layer unavailable pause coach boundary lint gate vacuous
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

const BOUNDARY = 'packages/app/features/tutor/coach.service.ts';
const PLANE = 'packages/safety/src/plane.ts';
const STORE = 'packages/app/features/tutor/tutor.store.ts';
const CLASSIFIER = 'packages/safety/src/unavailable.ts';

/**
 * Server modules the coaching turn passes through. A `catch` in any of them
 * that does not rethrow converts a layer outage into an ordinary value before
 * the boundary can see it, which is the same fail-open by a quieter route.
 *
 * `unavailable.ts` is absent deliberately: it IS the wrapper, its catches exist
 * to translate, and what they translate into is held by `safety.test.ts`.
 */
const PATH_MODULES = [
  BOUNDARY,
  'packages/app/features/tutor/tutor-safety.ts',
  'packages/app/features/tutor/tutor-model.ts',
  'packages/app/features/tutor/pedagogy.ts',
  PLANE,
];

/**
 * Doc 07 §3 layer 1 — the server-injected grade band. Named here because it is
 * a layer that arrives as a plain function parameter rather than as an import,
 * so nothing else in this file could recognise it as one.
 */
const IDENTITY_LOOKUPS = ['loadGradeBand'];

/** The plane's ports. A call to one is a safety layer being consulted. */
const LAYER_CALLS = [/\bscreen\s*\(/g, /\bclassifyInput\s*\(/g, /\bclassifyOutput\s*\(/g];

/** The two wrappers that turn a layer failure into `SafetyLayerUnavailable`. */
const WRAPPERS = ['safetyLayer', 'safetyLayerSync'];

const KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
  'case', 'do', 'else', 'yield', 'await',
]);

const PREFIX = new Set([...'(,=:[!&|?{};+-*%^~<>']);

/**
 * Blanks out comments, literals, and regexes, preserving every offset so a
 * position found in one view means the same position in the source.
 *
 * Returns two views because the checks need both: `code` answers "is this
 * identifier really called here" (a mention in prose is not a call), and
 * `text` answers "does this branch say 'paused'" (a string is the answer, not
 * noise). Blanking regex literals is not fussiness — `/\bdon'?t\s+want/i` in
 * the coach classifier opens a string literal to any scanner that skips it.
 */
function views(source) {
  const code = source.split('');
  const text = source.split('');
  const blank = (from, to, alsoText) => {
    for (let i = from; i < to && i < source.length; i += 1) {
      if (source[i] !== '\n') code[i] = ' ';
      if (alsoText && source[i] !== '\n') text[i] = ' ';
    }
  };

  let i = 0;
  let prevChar = '';
  let prevWord = '';

  const closes = (open, from) => {
    let j = from;
    while (j < source.length) {
      if (source[j] === '\\') {
        j += 2;
        continue;
      }
      if (source[j] === open) return j + 1;
      if (source[j] === '\n' && open !== '`') return j;
      j += 1;
    }
    return source.length;
  };

  while (i < source.length) {
    const c = source[i];

    if (c === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      const stop = end < 0 ? source.length : end;
      blank(i, stop, true);
      i = stop;
      continue;
    }

    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      blank(i, stop, true);
      i = stop;
      continue;
    }

    if (c === '"' || c === "'") {
      const stop = closes(c, i + 1);
      blank(i + 1, stop - 1, false);
      prevChar = c;
      prevWord = '';
      i = stop;
      continue;
    }

    if (c === '`') {
      let j = i + 1;
      let depth = 0;
      while (j < source.length) {
        const ch = source[j];
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (depth === 0 && ch === '`') break;
        if (ch === '$' && source[j + 1] === '{') {
          depth += 1;
          j += 2;
          continue;
        }
        if (depth > 0 && ch === '}') {
          depth -= 1;
          j += 1;
          continue;
        }
        j += 1;
      }
      blank(i + 1, Math.min(j, source.length), false);
      prevChar = '`';
      prevWord = '';
      i = Math.min(j + 1, source.length);
      continue;
    }

    // A `/` is a regex only where a value may begin; anywhere else it divides.
    if (c === '/' && (prevChar === '' || PREFIX.has(prevChar) || KEYWORDS.has(prevWord))) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length) {
        const ch = source[j];
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) break;
        else if (ch === '\n') break;
        j += 1;
      }
      blank(i, Math.min(j + 1, source.length), true);
      prevChar = '/';
      prevWord = '';
      i = Math.min(j + 1, source.length);
      continue;
    }

    if (!/\s/.test(c)) {
      prevChar = c;
      prevWord = /[A-Za-z0-9_$]/.test(c) ? prevWord + c : '';
    }
    i += 1;
  }

  return { code: code.join(''), text: text.join('') };
}

/** The `{ … }` starting at or after `from`, as a half-open offset pair. */
function block(code, from) {
  const open = code.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}') {
      depth -= 1;
      if (depth === 0) return [open, i + 1];
    }
  }
  return null;
}

/** The `( … )` of the call whose name ends at `from`. */
function args(code, from) {
  const open = code.indexOf('(', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === '(') depth += 1;
    else if (code[i] === ')') {
      depth -= 1;
      if (depth === 0) return [open, i + 1];
    }
  }
  return null;
}

/** The `try { … }` immediately before the `catch` keyword at `at`. */
function guardedTry(code, at) {
  let i = at - 1;
  while (i >= 0 && /\s/.test(code[i])) i -= 1;
  if (code[i] !== '}') return null;
  let depth = 0;
  for (let j = i; j >= 0; j -= 1) {
    if (code[j] === '}') depth += 1;
    else if (code[j] === '{') {
      depth -= 1;
      if (depth === 0) {
        const before = code.slice(Math.max(0, j - 8), j).trim();
        return before.endsWith('try') ? [j, i + 1] : null;
      }
    }
  }
  return null;
}

const offsets = (haystack, pattern) => {
  const found = [];
  for (const match of haystack.matchAll(pattern)) found.push(match.index);
  return found;
};

const within = (ranges, at) => ranges.some(([from, to]) => at >= from && at < to);

const line = (source, at) => source.slice(0, at).split('\n').length;

const read = (rel) => {
  const source = readFileSync(join(ROOT, rel), 'utf8');
  return { rel, source, ...views(source) };
};

const failures = [];
const fail = (file, at, message) =>
  failures.push(`${file.rel}:${at === null ? '?' : line(file.source, at)} — ${message}`);

// ---------------------------------------------------------------------------

const classifier = read(CLASSIFIER);
if (!/export class SafetyLayerUnavailable extends Error/.test(classifier.code)) {
  fail(classifier, null, 'SafetyLayerUnavailable is gone; nothing below can mean anything');
}

const boundary = read(BOUNDARY);
const catches = offsets(boundary.code, /\bcatch\b/g);
const guarded = [];

if (catches.length === 0) {
  fail(boundary, null, 'the coaching boundary catches nothing, so a layer outage escapes as a 500');
}

for (const at of catches) {
  const body = block(boundary.code, at);
  if (body === null) {
    fail(boundary, at, 'could not read this catch block');
    continue;
  }

  const [from, to] = body;
  if (!boundary.code.slice(from, to).includes('SafetyLayerUnavailable')) {
    fail(
      boundary,
      at,
      'this catch does not tell a layer outage from a vendor blip — doc 12 §5 needs it to,\n' +
        '    because one pauses the tutor and the other offers a child a retry',
    );
    continue;
  }

  const handled = boundary.text.slice(from, to);
  if (!handled.includes("'blocked'")) {
    fail(boundary, at, "a SafetyLayerUnavailable must yield 'blocked' — that is what the store pauses on");
  }
  if (!handled.includes("'unavailable'")) {
    fail(boundary, at, "everything else must stay 'unavailable', or a missing API key pauses a child's tutor");
  }

  const region = guardedTry(boundary.code, at);
  if (region === null) fail(boundary, at, 'no try block belongs to this catch');
  else guarded.push(region);
}

// Every safety binding this file imports, so a newly imported layer is covered
// the day it is imported rather than the day someone remembers this check.
const imported = new Set(IDENTITY_LOOKUPS);
for (const match of boundary.code.matchAll(
  /import\s*\{([^}]*)\}\s*from\s*'(?:@acme\/safety|\.\/tutor-safety\.ts)'/g,
)) {
  for (const name of match[1].split(',')) {
    const clean = name.replace(/^\s*type\s+/, '').trim();
    if (clean) imported.add(clean);
  }
}

const wrapperRanges = [];
for (const wrapper of WRAPPERS) {
  for (const at of offsets(boundary.code, new RegExp(`\\b${wrapper}\\s*\\(`, 'g'))) {
    const range = args(boundary.code, at);
    if (range !== null) wrapperRanges.push(range);
  }
}

for (const name of imported) {
  // `SafetyLayerUnavailable` is tested against, never called; a type is never
  // called either. Only call sites can leave a failure unguarded.
  for (const at of offsets(boundary.code, new RegExp(`\\b${name}\\s*\\(`, 'g'))) {
    if (boundary.code.slice(0, at).trimEnd().endsWith('import')) continue;
    if (!within(guarded, at)) {
      fail(
        boundary,
        at,
        `${name}() is called outside the classified try — a failure here escapes as a rejected\n` +
          '    promise, which the route answers with a 500 and the client answers with a retry',
      );
    }
  }
}

for (const name of IDENTITY_LOOKUPS) {
  for (const at of offsets(boundary.code, new RegExp(`\\b${name}\\s*\\(`, 'g'))) {
    if (!within(wrapperRanges, at)) {
      fail(
        boundary,
        at,
        `${name}() is doc 07 §3 layer 1 and must run inside safetyLayer(): an unresolvable grade\n` +
          '    band is a layer that is down, not a band to guess at',
      );
    }
  }
}

// ---------------------------------------------------------------------------

const plane = read(PLANE);
const planeWrappers = [];
for (const wrapper of WRAPPERS) {
  for (const at of offsets(plane.code, new RegExp(`\\b${wrapper}\\s*\\(`, 'g'))) {
    const range = args(plane.code, at);
    if (range !== null) planeWrappers.push(range);
  }
}

let layerCalls = 0;
for (const pattern of LAYER_CALLS) {
  for (const at of offsets(plane.code, pattern)) {
    layerCalls += 1;
    if (!within(planeWrappers, at)) {
      fail(
        plane,
        at,
        'this layer is called raw. Wrap it in safetyLayer/safetyLayerSync, or the day it stops\n' +
          '    being a regex is the day its outage becomes an ordinary error and the tutor retries',
      );
    }
  }
}

if (layerCalls === 0) {
  fail(plane, null, 'no layer calls found in the plane — this check has stopped watching anything');
}

// ---------------------------------------------------------------------------

const store = read(STORE);
for (const [frame, state] of [
  ['blocked', 'paused'],
  ['unavailable', 'retry'],
]) {
  const at = store.text.indexOf(`event.kind === '${frame}'`);
  if (at < 0) {
    fail(store, null, `the client no longer handles the '${frame}' frame`);
    continue;
  }
  const body = block(store.code, at);
  if (body === null || !store.text.slice(body[0], body[1]).includes(`'${state}'`)) {
    fail(
      store,
      at,
      `'${frame}' must render as '${state}'. The service's whole distinction is this mapping;\n` +
        '    swap the two and a paused tutor becomes a retry button in front of a child',
    );
  }
}

// ---------------------------------------------------------------------------

for (const rel of PATH_MODULES) {
  const file = rel === BOUNDARY ? boundary : rel === PLANE ? plane : read(rel);
  for (const at of offsets(file.code, /\bcatch\b/g)) {
    if (file.rel === BOUNDARY) continue;
    const body = block(file.code, at);
    if (body === null) continue;
    const handled = file.code.slice(body[0], body[1]);
    if (!handled.includes('throw') && !handled.includes('SafetyLayerUnavailable')) {
      fail(
        file,
        at,
        'a catch on the coaching path that neither rethrows nor classifies. A layer outage that\n' +
          '    becomes a value here never reaches the boundary that would pause the tutor',
      );
    }
  }
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error('\ncheck-fail-closed — doc 12 §5 no longer holds.\n');
  console.error(
    'If any safety layer is unavailable, tutoring PAUSES: "Natalie is taking a break", never an\n' +
      'error screen and never a retry, because a retry is a second trip past the layer that just\n' +
      'failed to screen the first one.\n',
  );
  for (const failure of failures) console.error(`  ${failure}`);
  console.error('');
  process.exit(1);
}

console.log(
  `fail-closed OK — ${layerCalls} layer calls wrapped in the plane, ` +
    `${catches.length} classified catch(es) on the coaching boundary, ` +
    `${PATH_MODULES.length} path modules rethrow`,
);

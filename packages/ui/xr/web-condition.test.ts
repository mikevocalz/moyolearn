// Proof, not policy: the web condition of `@acme/ui` never reaches Viro.
//
// THERE IS NO XR ON WEB and there never will be — the spatial whiteboard is a
// headset feature. Three things already arrange for that: the `exports` map in
// `packages/ui/package.json` forks `./xr` on the `react-native` condition, the
// `.web`/`.native` filename forks keep the two implementations apart, and
// `tooling/check-barrels.mjs` confirms the main index re-exports none of it.
// All three are arrangements a single careless import undoes silently, because
// nothing fails until a web bundle is built and `ViroXRSceneNavigator` is
// already inside it. This test is the thing that fails first instead.
//
// WHY A RESOLVER WALK RATHER THAN AN IMPORT. Importing the web entry only
// exercises what survives type stripping, and type-only edges are exactly the
// ones at risk: `export type { X } from './X.native.tsx'` is erased by every
// transpiler in the chain, so it never appears in a runtime graph — but a
// bundler still RESOLVES that specifier, and resolving a `.native` module means
// resolving `@reactvision/react-viro` on web. That is the reasoning
// `tutor-xr-screen.types.ts` already recorded; this walk is what holds it. So
// the graph here is built from specifiers, type-only ones included, the way a
// bundler sees them.
//
// The specifier scan strips comments before matching, because half the files in
// this package NAME `@reactvision/react-viro` in their header explaining why
// they do not import it. Strings are tracked so a `//` inside one is not read
// as a comment; regex literals are tracked for the same reason. It does not
// parse JSX, which is safe here only because a specifier fabricated out of
// mis-scanned JSX text would have to spell `from '@reactvision/…'` to matter.
// SOT: packages/ui/package.json (exports) · packages/ui/xr/index.web.ts
// SOT-KEYWORDS: xr web condition test resolver module graph no viro reactvision platform fork exports

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const PKG_DIR = resolve(import.meta.dirname, '..');
const BANNED = '@reactvision/';

/**
 * What a web bundler asks for, and what it must never ask for.
 *
 * `react-native` is absent on purpose — that is the whole fork. Metro sets it;
 * webpack, Vite, Turbopack and Next never do, so `default` is what the web apps
 * land on. The native set is the mirror image, used only to prove this walk can
 * still SEE Viro when it is genuinely there.
 */
const WEB_CONDITIONS = new Set(['browser', 'module', 'import', 'require', 'default']);
const NATIVE_CONDITIONS = new Set(['react-native', 'import', 'require', 'default']);

/** First matching key wins, in declaration order — the Node/bundler rule. */
function resolveConditional(value: unknown, conditions: ReadonlySet<string>): string | null {
  if (typeof value === 'string') return value;
  if (value === null || typeof value !== 'object') return null;
  for (const [key, branch] of Object.entries(value as Record<string, unknown>)) {
    if (!conditions.has(key)) continue;
    const hit = resolveConditional(branch, conditions);
    if (hit !== null) return hit;
  }
  return null;
}

type ExportsMap = Record<string, unknown>;

function readExports(): ExportsMap {
  const manifest: unknown = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'));
  const exportsField = (manifest as { exports?: unknown }).exports;
  assert.ok(
    exportsField !== null && typeof exportsField === 'object',
    'packages/ui/package.json declares no `exports` map',
  );
  return exportsField as ExportsMap;
}

/**
 * Strip comments, keep strings.
 *
 * A regex-literal scan rides along because a character class may hold a quote
 * (`/[^'"]/`), which would otherwise flip the scanner into a string that never
 * closes and swallow every specifier after it.
 */
function stripComments(source: string): string {
  const OPENS_REGEX = new Set([...'=(,:[!&|?{};+-*%~^<>\n\r\t ', '']);
  let out = '';
  let index = 0;
  let previous = '';
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1] ?? '';

    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
      index += 2;
      out += ' ';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      const quote = char;
      out += char;
      index += 1;
      while (index < source.length) {
        const inner = source[index];
        out += inner;
        index += 1;
        if (inner === '\\') {
          out += source[index] ?? '';
          index += 1;
          continue;
        }
        if (inner === quote) break;
      }
      previous = quote;
      continue;
    }
    if (char === '/' && OPENS_REGEX.has(previous)) {
      out += char;
      index += 1;
      while (index < source.length) {
        const inner = source[index];
        out += inner;
        index += 1;
        if (inner === '\\') {
          out += source[index] ?? '';
          index += 1;
          continue;
        }
        if (inner === '/') break;
      }
      previous = '/';
      continue;
    }

    out += char;
    if (char.trim().length > 0) previous = char;
    else previous = char;
    index += 1;
  }
  return out;
}

/**
 * Every specifier a bundler would resolve out of this file.
 *
 * `from '…'` covers static imports and re-exports including the `type` forms,
 * which is the point. Side-effect imports, dynamic `import()` and `require()`
 * are edges too. The `\.` guard on `from` keeps a method call named `.from('x')`
 * out of the results.
 */
function specifiersOf(source: string): string[] {
  const code = stripComments(source);
  const found: string[] = [];
  const patterns = [
    /(?<![.\w$])from\s*['"]([^'"]+)['"]/g,
    /(?:^|[\s;}])import\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) found.push(match[1]!);
  }
  return found;
}

/**
 * Relative resolution in the order the target platform tries.
 *
 * The platform-fork suffixes are ordered, not merged: under web conditions a
 * bare `./x` must never land on `./x.native.ts`, because that is the mistake
 * being tested for. An explicit `./x.native.tsx` still resolves — that one IS
 * the failure, and it has to be visible in the graph to be reported.
 */
function resolveRelative(fromFile: string, specifier: string, web: boolean): string | null {
  const base = join(dirname(fromFile), specifier);
  const fork = web ? ['.web', ''] : ['.native', ''];
  const candidates: string[] = [''];
  for (const suffix of fork) {
    for (const ext of ['.ts', '.tsx']) candidates.push(`${suffix}${ext}`);
    for (const ext of ['.ts', '.tsx']) candidates.push(`/index${suffix}${ext}`);
  }
  for (const candidate of candidates) {
    const path = base + candidate;
    if (existsSync(path) && lstatSync(path).isFile()) return path;
  }
  return null;
}

interface Graph {
  /** Every in-package file reachable from the entry, entry included. */
  files: string[];
  /** Every specifier seen, with the file that named it. */
  edges: { from: string; specifier: string }[];
}

function walk(entry: string, web: boolean): Graph {
  const seen = new Set([entry]);
  const queue = [entry];
  const edges: Graph['edges'] = [];
  while (queue.length > 0) {
    const file = queue.pop()!;
    for (const specifier of specifiersOf(readFileSync(file, 'utf8'))) {
      edges.push({ from: relative(PKG_DIR, file), specifier });
      if (!specifier.startsWith('.')) continue;
      const target = resolveRelative(file, specifier, web);
      assert.ok(target !== null, `${relative(PKG_DIR, file)} names './${specifier}', which resolves to nothing`);
      if (seen.has(target)) continue;
      seen.add(target);
      queue.push(target);
    }
  }
  return { files: [...seen], edges };
}

/** Entry points of `@acme/ui` under one condition set, subpath → file. */
function entriesFor(conditions: ReadonlySet<string>): Map<string, string> {
  const found = new Map<string, string>();
  for (const [subpath, value] of Object.entries(readExports())) {
    const target = resolveConditional(value, conditions);
    if (target === null) continue;
    const file = resolveRelative(join(PKG_DIR, 'package.json'), target, conditions === WEB_CONDITIONS);
    assert.ok(file !== null, `exports["${subpath}"] points at ${target}, which does not exist`);
    found.set(subpath, file);
  }
  return found;
}

test('the web condition of `@acme/ui/xr` is the fork that holds no renderer', () => {
  const web = entriesFor(WEB_CONDITIONS).get('./xr');
  const native = entriesFor(NATIVE_CONDITIONS).get('./xr');
  assert.equal(web && relative(PKG_DIR, web), 'xr/index.web.ts');
  assert.equal(native && relative(PKG_DIR, native), 'xr/index.native.ts');
});

test('no module a web bundler reaches from `@acme/ui/xr` names @reactvision', () => {
  const entry = entriesFor(WEB_CONDITIONS).get('./xr');
  assert.ok(entry !== undefined, 'exports["./xr"] has no web branch');
  const graph = walk(entry, true);

  const offenders = graph.edges.filter((edge) => edge.specifier.includes(BANNED));
  assert.deepEqual(
    offenders,
    [],
    `web-reachable modules import a native-only renderer:\n${offenders
      .map((edge) => `  ${edge.from} → ${edge.specifier}`)
      .join('\n')}`,
  );
});

test('no module a web bundler reaches from `@acme/ui/xr` is a `.native` fork', () => {
  const entry = entriesFor(WEB_CONDITIONS).get('./xr');
  assert.ok(entry !== undefined, 'exports["./xr"] has no web branch');
  const graph = walk(entry, true);

  /*
    The leading indicator. Viro only ever arrives through a `.native` module, so
    a web graph that touches one is one careless `import type` away from the
    failure above — and it fails here first, with the file named.
  */
  const native = graph.files.filter((file) => /\.native\.tsx?$/.test(file)).map((f) => relative(PKG_DIR, f));
  assert.deepEqual(native, [], `web graph reaches native-only modules:\n  ${native.join('\n  ')}`);
});

test('every other web entry point of `@acme/ui` is clean too', () => {
  /*
    `apps/web` imports `@acme/ui`, not `@acme/ui/xr`. Checking only the spatial
    subpath would leave the main kit barrel free to re-export a `.native` XR
    module and pull the renderer in through the front door instead.
  */
  for (const [subpath, entry] of entriesFor(WEB_CONDITIONS)) {
    const graph = walk(entry, true);
    const offenders = graph.edges
      .filter((edge) => edge.specifier.includes(BANNED))
      .map((edge) => `${edge.from} → ${edge.specifier}`);
    assert.deepEqual(offenders, [], `${subpath} reaches Viro:\n  ${offenders.join('\n  ')}`);
  }
});

test('the walk can still see Viro where it genuinely is', () => {
  /*
    Anti-vacuity. A scanner that silently matched nothing would pass every
    assertion above and prove nothing at all, so the native fork — which DOES
    import `@reactvision/react-viro` and must keep doing so — is walked with the
    same code and has to come back dirty.
  */
  const entry = entriesFor(NATIVE_CONDITIONS).get('./xr');
  assert.ok(entry !== undefined, 'exports["./xr"] has no react-native branch');
  const graph = walk(entry, false);

  const viro = graph.edges.filter((edge) => edge.specifier.includes(BANNED));
  assert.ok(viro.length > 0, 'the native XR entry no longer imports Viro — the scanner is broken, or XR is');
  assert.ok(
    graph.files.some((file) => /\.native\.tsx?$/.test(file)),
    'the native walk reached no `.native` module — resolution is broken',
  );
});

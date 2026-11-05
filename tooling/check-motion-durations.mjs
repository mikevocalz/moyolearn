#!/usr/bin/env node
// No hand-typed durations in choreographed motion.
//
// Every timing in a motion comes from `@acme/motion`'s presets, which read the
// theme's `motion` tokens. A number typed at a call site is a second source for
// the same decision, and it drifts: the front door's native-splash cross-fade
// was 220ms, a value no token held, until this gate went in.
//
// Scope, deliberately not the whole repo:
//   - every file that imports `@acme/motion` (any entry), because importing the
//     presets is the promise that the file uses them;
//   - packages/motion itself;
//   - the screens PR-M01 migrated (front door and paywall), listed in
//     MIGRATED below so a regression there fails even if the import goes.
// Gesture-driven state feedback elsewhere (row reorder, drag settle) still runs
// on bare Reanimated and is outside this gate by design: the pack makes
// Kinetrell the animator for choreographed motion, not for a finger dragging a
// row. Those sites are listed in docs/motion/README.md with their disposition.
//
// SOT: packages/motion/src/presets.ts · docs/motion/README.md
// SOT-KEYWORDS: motion durations gate inline presets lint kinetrell reanimated
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const MIGRATED = Object.freeze([
  'apps/mobile/app/_layout.tsx',
  'apps/mobile/components/splash/MoyoSplash.tsx',
  'packages/app/features/onboarding/public-entry-content.tsx',
  'packages/app/features/paywall/paywall-content.tsx',
  'packages/ui/PlanCard.tsx',
]);

// Each rule names the literal it catches. Keys are matched only as object keys
// (bare or quoted, never after a `.`), so `cond ? preset.durationMs : 0` is a
// read, not a timing. A computed value (`presets.x.durationMs`, `BEAT.page`,
// `t1 - t0`) never starts with a digit, so it passes. Rules run over the whole
// comment-stripped file, so a value on the line after its key is still caught.
// Not caught, and left to review: a literal behind an operator
// (`duration: base ?? 300`) and a number inside a template string.
const KEY = (names) => new RegExp(`(?<![.\\w])['"]?(?:${names})['"]?\\s*:\\s*-?\\.?\\d`, 'g');
const RULES = Object.freeze([
  { name: 'Kinetrell track timing', pattern: KEY('durationMs|delayMs|repeatDelayMs|settleDurationMs') },
  { name: 'duration literal', pattern: KEY('duration|animationDuration|animationDelay|transitionDuration') },
  { name: 'withDelay literal', pattern: /\bwithDelay\(\s*-?\.?\d/g },
  { name: '.duration()/.delay() literal', pattern: /\.(?:duration|delay)\(\s*-?\.?\d/g },
  { name: 'spring constant literal', pattern: KEY('damping|stiffness|mass') },
]);

const MOTION_IMPORT = /from\s+['"]@acme\/motion(?:\/[a-z-]+)?['"]/;

/**
 * Blank out comments, keeping every newline, so a decision comment can quote a
 * number and line numbers still point at the source. A small scanner rather
 * than a regex: `//` inside a string or template literal is text, not a
 * comment, and treating it as one would hide the rest of the line.
 */
export function stripComments(source) {
  let out = '';
  let quote = null;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i += 1;
      } else if (ch === quote || (ch === '\n' && quote !== '`')) {
        quote = null;
      }
    } else if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      if (i < source.length) out += '\n';
    } else if (ch === '/' && next === '*') {
      const close = source.indexOf('*/', i + 2);
      const stop = close === -1 ? source.length : close + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop - 1;
    } else {
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      out += ch;
    }
  }
  return out;
}

export function scanSource(source) {
  const stripped = stripComments(source);
  const lines = source.split('\n');
  const findings = [];
  for (const rule of RULES) {
    for (const match of stripped.matchAll(rule.pattern)) {
      const line = stripped.slice(0, match.index).split('\n').length;
      findings.push({ line, rule: rule.name, text: lines[line - 1].trim() });
    }
  }
  return findings.sort((a, b) => a.line - b.line);
}

export function inScope(path, source) {
  if (/\.test\.[cm]?tsx?$/.test(path)) return false;
  if (path.startsWith('packages/motion/')) return true;
  if (MIGRATED.includes(path)) return true;
  return MOTION_IMPORT.test(source);
}

function trackedSources(root) {
  return execFileSync('git', ['ls-files', '-z', '--', 'apps', 'packages'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter((path) => /\.(?:ts|tsx|mts)$/.test(path) && !path.includes('/node_modules/'));
}

function main() {
  const root = new URL('..', import.meta.url).pathname;
  let scanned = 0;
  let failures = 0;
  for (const path of trackedSources(root)) {
    let source;
    try {
      source = readFileSync(`${root}${path}`, 'utf8');
    } catch (error) {
      // A tracked file deleted in the working tree is not a motion file.
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (!inScope(path, source)) continue;
    scanned += 1;
    for (const finding of scanSource(source)) {
      failures += 1;
      console.error(`  ${path}:${finding.line} ${finding.rule}: ${finding.text}`);
    }
  }
  if (scanned < MIGRATED.length) {
    // The scope is computed; a scope that shrank below the migrated screens
    // means the probe broke, and a broken probe must not read as a clean repo.
    console.error(`motion durations: scanned ${scanned} files, fewer than the ${MIGRATED.length} migrated screens`);
    process.exit(1);
  }
  if (failures) {
    console.error(
      `\n${failures} hand-typed motion timing(s). Compose from @acme/motion: track(preset, …), ` +
        '`presets.<name>.durationMs`, or `spring.settle`. A new timing is a token in packages/theme/tokens.ts.',
    );
    process.exit(1);
  }
  console.log(`motion durations OK — ${scanned} files in scope, every timing from @acme/motion presets`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();

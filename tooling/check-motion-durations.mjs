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
// (not after a `.`), so `cond ? preset.durationMs : 0` is a read, not a timing.
// A computed value (`presets.x.durationMs`,
// `BEAT.page`, `t1 - t0`) never starts with a digit, so it passes.
const RULES = Object.freeze([
  { name: 'Kinetrell track timing', pattern: /(?<![.\w])(?:durationMs|delayMs|repeatDelayMs|settleDurationMs)\s*:\s*-?\d/ },
  { name: 'duration literal', pattern: /(?<![.\w])(?:duration|animationDuration|animationDelay|transitionDuration)\s*:\s*-?\d/ },
  { name: 'withDelay literal', pattern: /\bwithDelay\(\s*-?\d/ },
  { name: '.duration()/.delay() literal', pattern: /\.(?:duration|delay)\(\s*-?\d/ },
  { name: 'spring constant literal', pattern: /(?<![.\w])(?:damping|stiffness|mass)\s*:\s*-?\d/ },
]);

const MOTION_IMPORT = /from\s+['"]@acme\/motion(?:\/[a-z-]+)?['"]/;

/** Blank out comments, keeping line numbers, so a decision comment can quote a number. */
export function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, (_, lead) => lead);
}

export function scanSource(source) {
  const findings = [];
  stripComments(source)
    .split('\n')
    .forEach((line, index) => {
      for (const rule of RULES) {
        if (rule.pattern.test(line)) findings.push({ line: index + 1, rule: rule.name, text: line.trim() });
      }
    });
  return findings;
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

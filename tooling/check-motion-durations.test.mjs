// Contract tests for tooling/check-motion-durations.mjs: what counts as a
// hand-typed timing, what is left alone, and which files are in scope.
// SOT-KEYWORDS: motion durations gate test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MIGRATED, inScope, scanSource, stripComments } from './check-motion-durations.mjs';

test('literal timings are caught in every spelling the repo uses', () => {
  const source = [
    "track: { target: 'a', to: {}, durationMs: 300 },",
    'x.value = withTiming(1, { duration: 140 });',
    'x.value = withDelay(80, withTiming(1));',
    'exiting={FadeOut.duration(220)}',
    'withSpring(0, { damping: 30, stiffness: 220 });',
    'style={{ animationDuration: 400 }}',
  ].join('\n');
  assert.deepEqual(
    scanSource(source).map((f) => f.line),
    [1, 2, 3, 4, 5, 5, 6],
  );
});

test('computed timings pass', () => {
  const source = [
    'SplashScreen.setOptions({ fade: true, duration: presets.feedback.durationMs });',
    'withTiming(1, { duration: t1 - t0 })',
    'exiting={FadeOut.duration(BEAT.out)}',
    "track('entrance', { target: 'card', to: { opacity: 1 } })",
    'const anim = (name: object, duration: number, delay = 0) =>',
    'const last = n ? presets[name].durationMs : 0;',
  ].join('\n');
  assert.deepEqual(scanSource(source), []);
});

test('comments may quote a number; line numbers survive stripping', () => {
  const source = '// was duration: 220\n/* durationMs: 9\n */\nwithDelay(5, x)';
  assert.equal(stripComments(source).split('\n').length, 4);
  assert.deepEqual(scanSource(source).map((f) => f.line), [4]);
  assert.deepEqual(scanSource("const url = 'https://x.dev/a'; // duration: 1"), []);
});

test('a // inside a string or template does not hide the rest of the line', () => {
  assert.deepEqual(scanSource('const u = "a//b"; x = { duration: 300 };').map((f) => f.line), [1]);
  assert.deepEqual(scanSource('const u = `a//b`; x = { duration: 300 };').map((f) => f.line), [1]);
});

test('quoted keys, leading-dot numbers and a value on the next line are caught', () => {
  assert.deepEqual(scanSource('{ "durationMs": 300 }').map((f) => f.line), [1]);
  assert.deepEqual(scanSource('{ duration: .3 }').map((f) => f.line), [1]);
  assert.deepEqual(scanSource('{\n  durationMs:\n    300 }').map((f) => f.line), [2]);
});

test('scope is motion importers, the motion package and the migrated screens', () => {
  assert.equal(inScope('packages/app/features/x.tsx', "import { presets } from '@acme/motion';"), true);
  assert.equal(inScope('packages/app/features/x.tsx', "import { useMotion } from '@acme/motion/native';"), true);
  assert.equal(inScope('packages/app/features/x.tsx', "import { withTiming } from 'react-native-reanimated';"), false);
  assert.equal(inScope('packages/motion/src/presets.ts', ''), true);
  assert.equal(inScope('packages/motion/src/presets.test.ts', ''), false);
  for (const path of MIGRATED) assert.equal(inScope(path, ''), true, path);
});

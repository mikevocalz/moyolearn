import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateSource, detectRemovedV3Apis, rewriteSkiaSpecifier } from './migrate-skia-v3.mjs';

test('rewrites root and deep import specifiers to v3 package', () => {
  const old = [
    'import { Canvas } from "@shopify/react-native-skia";',
    'import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";',
    "jest.mock('@shopify/react-native-skia')",
  ].join('\n');
  const expected = [
    'import { Canvas } from "react-native-skia";',
    'import { LoadSkiaWeb } from "react-native-skia/lib/module/web";',
    "jest.mock('react-native-skia')",
  ].join('\n');
  assert.equal(rewriteSkiaSpecifier(old), expected);
  assert.equal(rewriteSkiaSpecifier(expected), expected);
});

test('never edits pinned legacy Graphite implementation, patch assets, or docs', () => {
  for (const filename of [
    'tooling/enable-skia-graphite.mjs',
    'tooling/enable-skia-graphite.test.mjs',
    'tooling/migrate-skia-v3.mjs',
    'tooling/migrate-skia-v3.test.mjs',
    'patches/a.ts',
    'vendors/a.ts',
    'docs/a.ts',
    'probes/a.ts',
    'packages/app/file.md',
  ]) assert.equal(candidateSource(filename), false, filename);
  assert.equal(candidateSource('packages/app/features/whiteboard/screen.native.tsx'), true);
});

test('reports removed v3 APIs for manual review, without unsafe rewrites', () => {
  const source = 'const image = await makeImageFromView(ref); const shot = c.makeImageSnapshotAsync();';
  assert.ok(detectRemovedV3Apis(source).length >= 2);
  assert.equal(rewriteSkiaSpecifier(source), source);
});

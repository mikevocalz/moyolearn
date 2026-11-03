import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { getGlyph } from '@nitro-forge/icons';
import { GLYPHS, generateScene } from './generate.mjs';
import { arcCubics, parseSvgPath, riveVertex } from './svg-path.mjs';

test('every pinned original glyph converts without substituting artwork', () => {
  for (const name of GLYPHS) for (const variant of ['outline', 'filled']) {
    for (const [svg] of getGlyph(name, variant)) {
      const paths = parseSvgPath(svg);
      assert.ok(paths.length > 0);
      for (const path of paths) for (const vertex of path.vertices) {
        assert.ok(Object.values(riveVertex(vertex)).filter((value) => typeof value === 'number').every(Number.isFinite));
      }
    }
  }
});

test('relative repeated lines, implicit moveto lines and closed contours preserve original coordinates', () => {
  const [path] = parseSvgPath('m4 5 2 3h4v-2l-6 0z');
  assert.deepEqual(path.vertices.map(({ x, y }) => [x, y]), [[4, 5], [6, 8], [10, 8], [10, 6], [4, 6]]);
  assert.equal(path.closed, true);
  assert.throws(() => parseSvgPath('M0 0 R2 3'), /Unsupported/);
  assert.throws(() => parseSvgPath('M0 0L2'), /Incomplete/);
});

test('standard arc conversion preserves endpoints, tangents and radius within 0.00001 glyph units', () => {
  const segments = arcCubics([2, 0], [2, 2, 0, 0, 1, 0, 2]);
  assert.equal(segments.length, 2);
  let start = [2, 0];
  for (const { c1, c2, end } of segments) {
    for (let step = 0; step <= 100; step += 1) {
      const t = step / 100, u = 1 - t;
      const xy = [0, 1].map((axis) => u ** 3 * start[axis] + 3 * u * u * t * c1[axis] + 3 * u * t * t * c2[axis] + t ** 3 * end[axis]);
      assert.ok(Math.abs(Math.hypot(...xy) - 2) < 0.00001);
    }
    start = end;
  }
  assert.deepEqual(segments.at(-1).end, [0, 2]);
  assert.ok(Math.abs(segments[0].c1[0] - 2) < 1e-12);
  assert.ok(Math.abs(segments.at(-1).c2[1] - 2) < 1e-12);
});

test('Rive polar handles reconstruct each original cubic control point', () => {
  const [path] = parseSvgPath('M1 2C3 4 5 6 7 8');
  const first = riveVertex(path.vertices[0]), last = riveVertex(path.vertices[1]);
  assert.ok(Math.abs(first.x + Math.cos(first.outRotation) * first.outDistance - 3) < 1e-10);
  assert.ok(Math.abs(first.y + Math.sin(first.outRotation) * first.outDistance - 4) < 1e-10);
  assert.ok(Math.abs(last.x + Math.cos(last.inRotation) * last.inDistance - 5) < 1e-10);
  assert.ok(Math.abs(last.y + Math.sin(last.inRotation) * last.inDistance - 6) < 1e-10);
});

test('Rive source is reproducible and includes actual selected/reduced-motion/theme bindings', () => {
  const scene = generateScene();
  assert.equal(readFileSync(new URL('./scene.rml', import.meta.url), 'utf8'), scene);
  assert.equal((scene.match(/<Artboard /g) ?? []).length, 5);
  assert.equal((scene.match(/name="selected"/g) ?? []).length, 1);
  assert.equal((scene.match(/name="reducedMotion"/g) ?? []).length, 1);
  assert.equal((scene.match(/duration="140"/g) ?? []).length, 10);
  assert.equal((scene.match(/name="surfaceColor"/g) ?? []).length, 1);
  assert.equal((scene.match(/name="color"/g) ?? []).length, 1);
  assert.ok(!scene.includes('ScriptAsset'));
});

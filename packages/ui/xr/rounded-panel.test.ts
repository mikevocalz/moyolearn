import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roundedPanel } from './rounded-panel.ts';
test('rounded panels retain bounds, front-facing triangles and normalized UVs', () => {
  for (const [w, h, r] of [[0.2, 0.2, 0.012], [0.9, 1.42, 0.022], [0.1, 0.2, 3]]) {
    const mesh = roundedPanel(w!, h!, r!);
    for (const [x, y, z] of mesh.vertices) {
      assert.ok(Math.abs(x) <= w! / 2 + 1e-9 && Math.abs(y) <= h! / 2 + 1e-9);
      assert.equal(z, 0);
    }
    for (const [a, b, c] of mesh.triangleIndices) {
      const [ax, ay] = mesh.vertices[a]!; const [bx, by] = mesh.vertices[b]!; const [cx, cy] = mesh.vertices[c]!;
      assert.ok((bx-ax)*(cy-ay)-(by-ay)*(cx-ax) >= -1e-12);
    }
    assert.ok(mesh.texcoords.every(([u,v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1));
    assert.ok(!mesh.vertices.some(([x,y]) => x === w! / 2 && y === h! / 2), 'rounded corner must not remain a rectangular hit target');
  }
});
test('invalid geometry is rejected before reaching the renderer', () => {
  for (const [w,h,r] of [[0,1,0], [1,NaN,0], [1,1,-1]]) assert.throws(() => roundedPanel(w!,h!,r!), RangeError);
});

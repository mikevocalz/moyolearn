import test from 'node:test';
import assert from 'node:assert/strict';
import { strokeMesh } from './stroke-mesh.ts';

test('a horizontal stroke has the requested width and faces the viewer', () => {
  const mesh = strokeMesh([[0,0,0.01],[1,0,0.01]], 0.02);
  assert.equal(mesh.vertices.length, 4);
  assert.equal(Math.max(...mesh.vertices.map(p => p[1])) - Math.min(...mesh.vertices.map(p => p[1])), 0.02);
  for (const [a,b,c] of mesh.triangleIndices) {
    const p=mesh.vertices[a]!, q=mesh.vertices[b]!, r=mesh.vertices[c]!;
    assert.ok((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]) > 0);
  }
});
test('a tap and repeated samples produce visible ink', () => {
  assert.equal(strokeMesh([[0,0,0],[0,0,0]], 1).triangleIndices.length, 2);
});
test('corners and reversals keep finite, bounded joins', () => {
  const mesh=strokeMesh([[0,0,0],[1,0,0],[0,0,0],[0,1,0]], 0.02);
  assert.ok(mesh.vertices.flat().every(Number.isFinite));
  assert.ok(mesh.vertices.every(p => Math.abs(p[0]) < 1.03 && Math.abs(p[1]) < 1.03));
  assert.ok(mesh.triangleIndices.flat().every(i => i >= 0 && i < mesh.vertices.length));
});
test('empty and invalid geometry cannot reach native buffers', () => {
  assert.equal(strokeMesh([],1).vertices.length,0);
  assert.equal(strokeMesh([[NaN,0,0]],1).vertices.length,0);
  assert.equal(strokeMesh([[0,0,0]],Infinity).vertices.length,0);
});

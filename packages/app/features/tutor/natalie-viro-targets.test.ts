import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { NATALIE_VIRO_TARGETS, viroFace } from './natalie-viro-targets.ts';
test('the shipped XR model contains the animation adapter targets and embeds its images', () => {
  const bytes = readFileSync(new URL('../../../avatar/assets/natalie-viro.glb', import.meta.url));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
  assert.deepEqual(gltf.meshes[0].extras.targetNames, [...NATALIE_VIRO_TARGETS]);
  assert.ok(gltf.images.every((image: { uri?: string; bufferView?: number }) => !image.uri && image.bufferView !== undefined));
  assert.deepEqual(gltf.extensionsRequired ?? [], []);
});
test('only supported channels reach Viro, with missing channels explicitly closed', () => {
  const face = viroFace({ jawOpen: 0.4, browInnerUp: 1 });
  assert.equal(face.jawOpen, 0.4);
  assert.equal(face.browInnerUp, undefined);
  assert.equal(viroFace({}).jawOpen, 0);
});

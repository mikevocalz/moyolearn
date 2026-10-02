#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(
  root,
  'packages/app/features/tutor/tutor-specs-scene.native.tsx',
);
const source = await readFile(file, 'utf8');

const requiredTags = [
  'moyo-specs-root',
  'moyo-specs-title',
  'moyo-specs-board',
  'moyo-specs-question',
  'moyo-specs-tutor-slot',
  'moyo-specs-natalie',
  'moyo-specs-reference-panel',
  'moyo-specs-reference-title',
  'moyo-specs-reference-copy',
  'moyo-specs-focus-rail',
];

for (const tag of requiredTags) {
  const matches = source.match(new RegExp('viroTag="' + tag + '"', 'g')) ?? [];
  if (matches.length !== 1) {
    throw new Error(
      'Specs authoring scene must contain exactly one ' + tag + '; found ' + matches.length,
    );
  }
}

if (!source.includes('position={[0, 0, -1.5]}')) {
  throw new Error('Specs authoring root must preserve the canonical -1.5m teaching distance.');
}

if (!source.includes("require('@acme/avatar/assets/natalie-viro.glb')")) {
  throw new Error('Specs authoring scene must use the canonical Natalie Viro asset.');
}

if (!source.includes('thickness={0.008}')) {
  throw new Error('Specs authoring scene must preserve the 8mm focus rail thickness.');
}

console.log('Moyo SPECS Tutor Room authoring contract: PASS');

if (!source.includes("ViroAnimations.registerAnimations")) {
  throw new Error('Specs authoring scene must exercise static Viro animation compilation.');
}
if (!source.includes('onClick={() => undefined}') || !source.includes('onDrag={() => undefined}')) {
  throw new Error('Specs authoring scene must exercise select and drag interaction intent.');
}

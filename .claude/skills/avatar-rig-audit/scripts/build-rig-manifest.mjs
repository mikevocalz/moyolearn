#!/usr/bin/env node
// Builds rig-manifest.json from the two shipped avatar assets.
//
// Plain node rather than glTF-Transform: a GLB is a 12-byte header and two
// length-prefixed chunks, and a .gltf is JSON. Everything this reads lives in
// the JSON chunk — nodes, skins, meshes, accessors, extensions — so a parser is
// forty lines against a dependency the repo would otherwise carry for one
// build-time script. Nothing here decodes the BIN payload.
//
// The manifest is the single source of bone and morph names. No skill and no
// runtime file may hardcode one; they read this and fail loudly when a name
// they expect is absent.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;

function readGltfJson(path) {
  const buf = readFileSync(path);
  if (!path.endsWith('.glb')) return JSON.parse(buf.toString('utf8'));
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error(`${path}: not a GLB`);
  let offset = 12;
  while (offset < buf.length) {
    const length = buf.readUInt32LE(offset);
    const type = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (type === CHUNK_JSON) return JSON.parse(buf.subarray(start, start + length).toString('utf8'));
    offset = start + length;
  }
  throw new Error(`${path}: no JSON chunk`);
}

/*
  Rigify exports three parallel chains and only one of them deforms the mesh.
  `DEF-` bones carry the skin weights; `ORG-` and `MCH-` are the control and
  mechanism chains that constraints drove in Blender — constraints do not
  export, so writing to them moves nothing. The audit records this as the
  failure that made an entire presence writer invisible.
*/
const chainOf = (name) =>
  name.startsWith('DEF-') ? 'deform' : name.startsWith('ORG-') ? 'org' : name.startsWith('MCH-') ? 'mch' : 'other';

function describe(path) {
  const gltf = readGltfJson(path);
  const nodes = gltf.nodes ?? [];
  const skins = gltf.skins ?? [];
  const meshes = gltf.meshes ?? [];

  const jointIndices = [...new Set(skins.flatMap((s) => s.joints ?? []))].sort((a, b) => a - b);
  const joints = jointIndices.map((i) => nodes[i]?.name ?? `<unnamed:${i}>`);

  const byChain = { deform: [], org: [], mch: [], other: [] };
  for (const name of joints) byChain[chainOf(name)].push(name);

  // Morph target names ride on the mesh's `extras.targetNames` (glTF 2.0 has no
  // first-class name for them), which is what every exporter writes and what
  // three.js reads back as `morphTargetDictionary`.
  const morphTargets = [
    ...new Set(meshes.flatMap((m) => m.extras?.targetNames ?? [])),
  ];

  const skinDetail = skins.map((s, i) => ({
    index: i,
    name: s.name ?? null,
    jointCount: (s.joints ?? []).length,
    // The audit's finding: the two assets share node and joint lists but point
    // at different inverse-bind accessors. Recorded so a future diff can say so
    // rather than rediscover it.
    inverseBindMatrices: s.inverseBindMatrices ?? null,
    skeleton: s.skeleton ?? null,
  }));

  return {
    file: basename(path),
    bytes: readFileSync(path).length,
    generator: gltf.asset?.generator ?? null,
    version: gltf.asset?.version ?? null,
    nodeCount: nodes.length,
    meshCount: meshes.length,
    // The audit: neither shipped asset contains a clip. Everything is procedural.
    animationCount: (gltf.animations ?? []).length,
    extensionsUsed: gltf.extensionsUsed ?? [],
    skins: skinDetail,
    jointCount: joints.length,
    joints,
    chains: {
      deform: byChain.deform,
      org: byChain.org,
      mch: byChain.mch,
      other: byChain.other,
    },
    morphTargetCount: morphTargets.length,
    morphTargets,
    // Identity of the SKELETON, not of the file: joint names in joint order.
    // Two assets that skin the same rig share this even when their accessors,
    // textures and byte lengths differ, which is exactly the case here.
    skeletonHash: createHash('sha256').update(joints.join('\n')).digest('hex'),
  };
}

const [, , out, ...inputs] = process.argv;
if (!out || inputs.length === 0) {
  console.error('usage: build-rig-manifest.mjs <out.json> <asset...>');
  process.exit(1);
}

const assets = inputs.map(describe);
const hashes = [...new Set(assets.map((a) => a.skeletonHash))];

const manifest = {
  generatedBy: 'avatar-rig-audit/scripts/build-rig-manifest.mjs',
  assets,
  // One hash across both assets is the invariant the runtime depends on: the
  // presence writer targets bones by name, so marketing and the phone build
  // must be the same rig or the same code moves different joints.
  skeletonsAgree: hashes.length === 1,
  skeletonHash: hashes.length === 1 ? hashes[0] : null,
};

writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `${out}: ${assets.length} asset(s), skeletons ${manifest.skeletonsAgree ? 'agree' : 'DIFFER'}, ` +
    `${assets[0].jointCount} joints, ${assets[0].morphTargetCount} morph targets, ` +
    `${assets.reduce((n, a) => n + a.animationCount, 0)} animation clips`,
);

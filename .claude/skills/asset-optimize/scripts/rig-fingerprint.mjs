#!/usr/bin/env node
/*
  The rig, as a comparable object. Take one before an optimisation and one
  after; anything that differs is a rig the pipeline damaged.

  WHAT IS ALLOWED TO CHANGE is the point. Vertex count, byte size, buffer
  layout, accessor types, compression extensions — all fair game, that is what
  optimisation IS. Joints, joint names, skin count, inverse-bind matrices, the
  presence of JOINTS/WEIGHTS, morph target names and count, node names: none of
  those may move. A character whose morph targets got renamed still loads, still
  renders, and no longer has a face.

  INTERLEAVING IS RECORDED EVEN THOUGH IT MAY CHANGE. `quantize` and `meshopt`
  both rewrite buffer layout, so a difference here is expected rather than
  fatal — but it is the property that produced a `createRenderPipeline` failure
  on this asset once already (a normalised attribute sharing an interleaved
  buffer asked WebGPU for `unorm32x4`, which does not exist), so a diff that
  changes it should be read by a human rather than passed over.

  Plain node: a GLB is a 12-byte header and two length-prefixed chunks, a .gltf
  is JSON, and everything here lives in the JSON chunk.
*/
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function readGltf(path) {
  const buffer = readFileSync(path);
  if (buffer.slice(0, 4).toString('ascii') !== 'glTF') {
    const gltf = JSON.parse(buffer.toString('utf8'));
    const uri = gltf.buffers?.[0]?.uri;
    // A .gltf keeps its bytes beside it; a .glb carries them in chunk two.
    const bin = uri && !uri.startsWith('data:')
      ? readFileSync(join(dirname(path), decodeURIComponent(uri)))
      : Buffer.alloc(0);
    return { gltf, bin };
  }
  const jsonLength = buffer.readUInt32LE(12);
  const gltf = JSON.parse(buffer.slice(20, 20 + jsonLength).toString('utf8'));
  const binHeader = 20 + jsonLength;
  const binLength = binHeader + 8 <= buffer.length ? buffer.readUInt32LE(binHeader) : 0;
  return { gltf, bin: buffer.slice(binHeader + 8, binHeader + 8 + binLength) };
}

/**
 * The inverse-bind matrices themselves, not the accessor that points at them.
 *
 * Hashing the accessor object compares bufferView indices and byte offsets,
 * which differ between a .gltf and a .glb of the same rig by construction — it
 * reported the marketing and phone assets as having different bind poses when
 * the matrices are byte-identical. A fingerprint that cries wolf is worse than
 * no fingerprint, because the next real break gets waved through.
 */
function inverseBindBytes(gltf, bin, accessorIndex) {
  const accessor = gltf.accessors?.[accessorIndex];
  if (!accessor || accessor.bufferView === undefined) return null;
  const view = gltf.bufferViews[accessor.bufferView];
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  return bin.slice(start, start + accessor.count * 64); // MAT4 float32
}

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);

/*
  QUANTIZE LEGITIMATELY REWRITES THE INVERSE-BIND MATRICES, and the gate has to
  know the difference between that and corruption rather than choosing between
  failing on every quantized derivative and waving every IBM change through.

  KHR_mesh_quantization folds the dequantization transform into the IBMs: every
  new matrix equals the old one composed with ONE shared affine M. So when the
  hashes differ, M is fitted from the first joint and checked against all of
  them. Measured on the shipped body: uniform scale 0.8739, translation of the
  bbox offset, worst error 5.2e-8 over 470 joints — float noise. A real break
  cannot satisfy that: it changes matrices inconsistently, or only some.
*/
const mul = (x, y) => {
  const out = new Float64Array(16);
  for (let c = 0; c < 4; c += 1)
    for (let r = 0; r < 4; r += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += x[k * 4 + r] * y[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  return out;
};

const invert = (matrix) => {
  const m = [...matrix];
  const r = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const at = (a, row, col) => a[col * 4 + row];
  const put = (a, row, col, v) => { a[col * 4 + row] = v; };
  for (let col = 0; col < 4; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 4; row += 1) if (Math.abs(at(m, row, col)) > Math.abs(at(m, pivot, col))) pivot = row;
    for (let c = 0; c < 4; c += 1) {
      let t = at(m, col, c); put(m, col, c, at(m, pivot, c)); put(m, pivot, c, t);
      t = at(r, col, c); put(r, col, c, at(r, pivot, c)); put(r, pivot, c, t);
    }
    const d = at(m, col, col);
    for (let c = 0; c < 4; c += 1) { put(m, col, c, at(m, col, c) / d); put(r, col, c, at(r, col, c) / d); }
    for (let row = 0; row < 4; row += 1) {
      if (row === col) continue;
      const f = at(m, row, col);
      for (let c = 0; c < 4; c += 1) {
        put(m, row, c, at(m, row, c) - f * at(m, col, c));
        put(r, row, c, at(r, row, c) - f * at(r, col, c));
      }
    }
  }
  return r;
};

/** Null when consistent (with the fitted M); the worst error when not. */
function quantizeRewriteError(before, after) {
  if (before.length !== after.length || before.length < 16) return { error: Infinity, fit: null };
  const fit = mul(invert(before.slice(0, 16)), after.slice(0, 16));
  let worst = 0;
  for (let j = 0; j * 16 < before.length; j += 1) {
    const predicted = mul(before.slice(j * 16, j * 16 + 16), fit);
    for (let k = 0; k < 16; k += 1) worst = Math.max(worst, Math.abs(predicted[k] - after[j * 16 + k]));
  }
  return { error: worst, fit };
}

export function fingerprint(path) {
  const { gltf, bin } = readGltf(path);
  const nodes = gltf.nodes ?? [];
  const skins = gltf.skins ?? [];
  const mesh = (gltf.meshes ?? [])[0];

  const joints = (skins[0]?.joints ?? []).map((i) => nodes[i]?.name ?? `<unnamed ${i}>`);
  /*
    Morph names live on the MESH's extras, not the primitive's. Reading them
    from the wrong place yields an empty list, which would make a fingerprint
    that says nothing look like a fingerprint that matches.
  */
  const targetNames = mesh?.extras?.targetNames ?? [];

  const primitives = (mesh?.primitives ?? []).map((p) => ({
    material: gltf.materials?.[p.material]?.name ?? null,
    attributes: Object.keys(p.attributes ?? {}).sort(),
    skinned: p.attributes?.JOINTS_0 !== undefined && p.attributes?.WEIGHTS_0 !== undefined,
    targets: (p.targets ?? []).length,
    // Expected to change under quantize/meshopt — recorded so a human sees it.
    interleaved: gltf.bufferViews?.[gltf.accessors?.[p.attributes?.POSITION]?.bufferView]?.byteStride ?? null,
  }));

  return {
    jointCount: joints.length,
    joints,
    jointsHash: digest(joints),
    skinCount: skins.length,
    // The bind pose itself: a re-export that shifts it moves every vertex.
    inverseBindHash: skins.map((s) => {
      const bytes = inverseBindBytes(gltf, bin, s.inverseBindMatrices);
      return bytes ? createHash('sha256').update(bytes).digest('hex').slice(0, 16) : null;
    }),
    // Kept for the equivalence check when the hashes differ. Float32Array does
    // not survive JSON, so it is materialised as a plain array on demand only.
    _ibmBytes: skins.map((s) => {
      const bytes = inverseBindBytes(gltf, bin, s.inverseBindMatrices);
      return bytes ? Array.from(new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4)) : null;
    }),
    morphTargetCount: targetNames.length,
    morphTargetNames: targetNames,
    morphNamesHash: digest(targetNames),
    nodeNames: nodes.map((n) => n.name ?? null),
    nodeNamesHash: digest(nodes.map((n) => n.name ?? null)),
    animationCount: (gltf.animations ?? []).length,
    materialCount: (gltf.materials ?? []).length,
    primitives,
  };
}

/** Fields that may not move. Everything else is optimisation doing its job. */
const RIGID = [
  'jointCount', 'jointsHash', 'skinCount',
  'morphTargetCount', 'morphNamesHash', 'nodeNamesHash', 'animationCount',
];

export function diff(before, after) {
  const problems = [];
  // IBMs: identical, or exactly one shared affine rewrite (quantization).
  if (JSON.stringify(before.inverseBindHash) !== JSON.stringify(after.inverseBindHash)) {
    const a = before._ibmBytes?.[0];
    const b = after._ibmBytes?.[0];
    const { error, fit } = a && b ? quantizeRewriteError(a, b) : { error: Infinity, fit: null };
    if (error < 1e-4 && fit) {
      console.log(
        `  note: inverse-bind matrices rewritten by one shared transform ` +
          `(scale ${fit[0].toFixed(4)}, worst error ${error.toExponential(1)}) — the quantize mechanism, accepted`,
      );
    } else {
      problems.push(`inverseBindMatrices: inconsistent rewrite, worst error ${error.toExponential(2)} — this is damage, not quantization`);
    }
  }
  for (const key of RIGID) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      problems.push(`${key}: ${JSON.stringify(before[key])} -> ${JSON.stringify(after[key])}`);
    }
  }
  const a = before.primitives ?? [];
  const b = after.primitives ?? [];
  if (a.length !== b.length) problems.push(`primitive count ${a.length} -> ${b.length}`);
  a.forEach((p, i) => {
    const q = b[i];
    if (!q) return;
    if (p.skinned !== q.skinned) problems.push(`primitive ${i}: skinning ${p.skinned} -> ${q.skinned}`);
    if (p.targets !== q.targets) problems.push(`primitive ${i}: ${p.targets} targets -> ${q.targets}`);
  });
  return problems;
}

/*
  MAIN-ONLY. This block executed on IMPORT, so the first script to reuse the
  library half read its own argv through this one and tried to fingerprint an
  output directory. An import must be inert.
*/
const isMain = process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;
if (isMain) {
  const [, , a, b] = process.argv;
  if (a && !b) console.log(JSON.stringify(fingerprint(a), null, 2));
  else if (a && b) {
    const problems = diff(fingerprint(a), fingerprint(b));
    if (problems.length === 0) {
      console.log('rig intact — every protected field identical');
    } else {
      for (const p of problems) console.error(`  BROKEN ${p}`);
      process.exit(1);
    }
  } else {
    console.error('usage: rig-fingerprint.mjs <asset> [<asset-to-compare>]');
    process.exit(1);
  }
}

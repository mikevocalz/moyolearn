/**
 * Builds a small, valid `GNMW` container in memory.
 *
 * Why this exists: the reference renderer's head tests read the shipped
 * `public/gnm/gnm_head_web.bin` — 34.9 MB. Doc 22 §3 forbids that byte weight
 * from ever entering the app, and by extension it has no business in the repo
 * or in CI. A synthesised container is also the stronger test: it exercises the
 * parser's declared contract at chosen dimensions instead of one opaque blob
 * that happens to work.
 *
 * The real container remains testable — see the env-gated integration case in
 * `../gnm/model.test.ts`, which points at a locally cached copy.
 *
 * Layout mirrors `tools/export_gnm_web.py` as parsed by `parseContainer`:
 *   'GNMW' | u32 version=1 | u32 headerLength | header JSON | section bytes
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §3, §8
 * SOT-KEYWORDS: gnm container fixture synthetic gnmw test parser header sections
 */

export interface FixtureDims {
  numVertices: number;
  numJoints: number;
  identityDim: number;
  expressionDim: number;
  numTriangles: number;
}

export const DEFAULT_FIXTURE_DIMS: FixtureDims = {
  numVertices: 24,
  numJoints: 4,
  identityDim: 5,
  expressionDim: 7,
  numTriangles: 8,
};

/** Deterministic [0,1) generator — the fixture must be byte-stable across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PendingSection {
  name: string;
  dtype: 'float32' | 'int8' | 'uint8' | 'uint16' | 'int32';
  bytes: Uint8Array;
}

function bytesOf(array: ArrayBufferView): Uint8Array {
  return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}

/**
 * Returns a parseable GNMW buffer plus the dimensions it was built at.
 *
 * Joint 0 is the root (parent -1) and every other joint parents to the one
 * before it, so the FK chain is genuinely nested rather than a flat fan — a
 * flat hierarchy would let a broken parent walk pass.
 */
export function buildGnmFixture(
  dims: FixtureDims = DEFAULT_FIXTURE_DIMS,
  seed = 7
): { buffer: ArrayBuffer; dims: FixtureDims } {
  const { numVertices, numJoints, identityDim, expressionDim, numTriangles } =
    dims;
  const rand = mulberry32(seed);
  const v3 = numVertices * 3;
  const j3 = numJoints * 3;

  const template = new Float32Array(v3);
  for (let i = 0; i < v3; ++i) template[i] = rand() * 0.2 - 0.1;

  const triangles = new Uint16Array(numTriangles * 3);
  for (let i = 0; i < triangles.length; ++i) {
    triangles[i] = Math.floor(rand() * numVertices);
  }
  const quads = new Uint16Array(0);

  const templateJoints = new Float32Array(j3);
  for (let j = 0; j < numJoints; ++j) {
    // Stack the joints up +Y so each has a real offset from its parent.
    templateJoints[j * 3 + 0] = 0;
    templateJoints[j * 3 + 1] = j * 0.05;
    templateJoints[j * 3 + 2] = 0;
  }

  const jointParents = new Int32Array(numJoints);
  jointParents[0] = -1;
  for (let j = 1; j < numJoints; ++j) jointParents[j] = j - 1;

  // JOINT-major, not vertex-major: `computeVertices` reads
  // `weights[j * numVertices + v]`. Getting this backwards still produces
  // finite, non-zero vertices — which is exactly why it is worth stating.
  // Weights must sum to 1 per vertex or linear blend skinning quietly scales
  // the mesh instead of failing.
  const skinningWeights = new Float32Array(numJoints * numVertices);
  for (let v = 0; v < numVertices; ++v) {
    let sum = 0;
    for (let j = 0; j < numJoints; ++j) {
      const w = rand();
      skinningWeights[j * numVertices + v] = w;
      sum += w;
    }
    for (let j = 0; j < numJoints; ++j) {
      const at = j * numVertices + v;
      skinningWeights[at] = (skinningWeights[at] ?? 0) / sum;
    }
  }

  const jointIdentityBasis = new Float32Array(identityDim * j3);
  for (let i = 0; i < jointIdentityBasis.length; ++i) {
    jointIdentityBasis[i] = rand() * 0.02 - 0.01;
  }

  const identityBasis = new Int8Array(identityDim * v3);
  for (let i = 0; i < identityBasis.length; ++i) {
    identityBasis[i] = Math.round(rand() * 254 - 127);
  }
  const identityScales = new Float32Array(identityDim);
  for (let i = 0; i < identityDim; ++i) identityScales[i] = 0.001 + rand() * 0.001;

  const expressionBasis = new Int8Array(expressionDim * v3);
  for (let i = 0; i < expressionBasis.length; ++i) {
    expressionBasis[i] = Math.round(rand() * 254 - 127);
  }
  const expressionScales = new Float32Array(expressionDim);
  for (let i = 0; i < expressionDim; ++i) {
    expressionScales[i] = 0.001 + rand() * 0.001;
  }

  const componentId = new Uint8Array(numVertices);
  const materialId = new Uint8Array(numVertices);
  const regionId = new Uint8Array(numVertices);
  for (let v = 0; v < numVertices; ++v) {
    materialId[v] = v % 3;
    regionId[v] = v % 2;
  }

  const landmarkIndices = new Uint16Array([0, 1, 2]);
  const landmarkWeights = new Float32Array([1, 1, 1]);

  const pending: PendingSection[] = [
    { name: 'template', dtype: 'float32', bytes: bytesOf(template) },
    { name: 'triangles', dtype: 'uint16', bytes: bytesOf(triangles) },
    { name: 'quads', dtype: 'uint16', bytes: bytesOf(quads) },
    { name: 'template_joints', dtype: 'float32', bytes: bytesOf(templateJoints) },
    { name: 'joint_parents', dtype: 'int32', bytes: bytesOf(jointParents) },
    { name: 'skinning_weights', dtype: 'float32', bytes: bytesOf(skinningWeights) },
    {
      name: 'joint_identity_basis',
      dtype: 'float32',
      bytes: bytesOf(jointIdentityBasis),
    },
    { name: 'identity_basis', dtype: 'int8', bytes: bytesOf(identityBasis) },
    { name: 'identity_scales', dtype: 'float32', bytes: bytesOf(identityScales) },
    { name: 'expression_basis', dtype: 'int8', bytes: bytesOf(expressionBasis) },
    {
      name: 'expression_scales',
      dtype: 'float32',
      bytes: bytesOf(expressionScales),
    },
    { name: 'component_id', dtype: 'uint8', bytes: bytesOf(componentId) },
    { name: 'material_id', dtype: 'uint8', bytes: bytesOf(materialId) },
    { name: 'region_id', dtype: 'uint8', bytes: bytesOf(regionId) },
    { name: 'landmark_indices', dtype: 'uint16', bytes: bytesOf(landmarkIndices) },
    { name: 'landmark_weights', dtype: 'float32', bytes: bytesOf(landmarkWeights) },
  ];

  // Typed-array views are constructed directly over the container buffer, so
  // every section start must satisfy its element alignment — pad to 4 bytes.
  const sectionHeaders: {
    name: string;
    dtype: string;
    offset: number;
    byteLength: number;
  }[] = [];
  let cursor = 0;
  for (const section of pending) {
    if (cursor % 4 !== 0) cursor += 4 - (cursor % 4);
    sectionHeaders.push({
      name: section.name,
      dtype: section.dtype,
      offset: cursor,
      byteLength: section.bytes.byteLength,
    });
    cursor += section.bytes.byteLength;
  }
  const payloadLength = cursor % 4 === 0 ? cursor : cursor + (4 - (cursor % 4));

  const header = {
    meta: {
      model: 'gnm-fixture',
      gnmVersion: 'fixture-1',
      variant: 'test',
      numVertices,
      numJoints,
      identityDim,
      expressionDim,
      identityNames: Array.from({ length: identityDim }, (_, i) => `id${i}`),
      expressionNames: Array.from(
        { length: expressionDim },
        (_, i) => `expr${i}`
      ),
      // Named to match the real container so joint-lookup tests are meaningful.
      jointNames: ['root', 'neck', 'head', 'left_eye', 'right_eye'].slice(
        0,
        numJoints
      ),
      componentNames: ['head'],
      materialNames: ['skin', 'teeth', 'scleras'],
      regionNames: ['upper', 'lower'],
      bboxMin: [-0.1, -0.1, -0.1],
      bboxMax: [0.1, 0.1, 0.1],
      hasPoseCorrectives: false,
    },
    sections: sectionHeaders,
  };

  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  // The section base is `12 + headerLength`; pad the header so that base is
  // 4-byte aligned too, otherwise every float32 view throws on construction.
  const headerPad = (4 - ((12 + headerBytes.byteLength) % 4)) % 4;
  const headerLength = headerBytes.byteLength + headerPad;

  const buffer = new ArrayBuffer(12 + headerLength + payloadLength);
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  // 'GNMW' is read big-endian byte-by-byte by parseContainer.
  bytes[0] = 0x47;
  bytes[1] = 0x4e;
  bytes[2] = 0x4d;
  bytes[3] = 0x57;
  view.setUint32(4, 1, true);
  view.setUint32(8, headerLength, true);
  bytes.set(headerBytes, 12);
  // Pad with spaces, not zeroes: the header is JSON and stays valid either way,
  // but spaces keep a hex dump readable when this fixture is being debugged.
  for (let i = 0; i < headerPad; ++i) bytes[12 + headerBytes.byteLength + i] = 0x20;

  const base = 12 + headerLength;
  // Zipped rather than double-indexed: the two arrays are built in lockstep in
  // the loop above, and pairing them here makes that the type system's problem
  // instead of a reader's assumption.
  for (const [i, section] of pending.entries()) {
    const header = sectionHeaders[i];
    if (!header) continue;
    bytes.set(section.bytes, base + header.offset);
  }

  return { buffer, dims };
}

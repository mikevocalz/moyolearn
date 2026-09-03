/**
 * Asserts the phone body is actually loadable on a device, and actually
 * drivable by the presence writer. Run it after any re-export or re-bake:
 *
 *   node tools/verify_native_gltf.mjs assets/natalie-phone/natalie.gltf
 *
 * WHY IT EXISTS. Every failure this checks for is invisible until the app is on
 * a phone, and two of them look like success everywhere else:
 *
 *   - An EMBEDDED image loads in Chrome and fails in Hermes, which has no
 *     `new Blob([ArrayBuffer])` (ADR-111 §The asset, `src/assets.ts`'s .glb
 *     rule). A `.glb` that "works on the web build" proves nothing.
 *   - A RE-EXPORT that renames or drops a bone leaves a body that loads,
 *     renders, and never breathes — `createHumanoPresence` writes to bones it
 *     cannot find by silently skipping them. Checking the names here turns
 *     that into a build failure instead of a "why is she frozen" bug at 3am.
 *
 * Deliberately reads the glTF JSON rather than loading it through three: the
 * point is to check the FILE, and three's loaders need a fetch-able origin that
 * Node does not give a local path.
 *
 * SOT: docs/decisions/adr-111-native-3d-runtime.md · ../src/presence/humano.ts
 * SOT-KEYWORDS: verify gltf native react-native hermes embedded images bones morph targets
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const RIGIFY_BONES = [
  'chest',
  'neck',
  'head',
  'jaw_master',
  'eye.L',
  'eye.R',
  'DEF-shoulder.L',
  'DEF-shoulder.R',
  'DEF-upper_arm.L',
  'DEF-upper_arm.R',
  'DEF-forearm.L',
  'DEF-forearm.R',
  'DEF-hand.L',
  'DEF-hand.R',
];

/** The morphs the presence writer drives. A missing one is a silent no-op. */
const REQUIRED_MORPHS = [
  'jawOpen',
  'mouthSmileLeft',
  'mouthSmileRight',
  'mouthFunnel',
  'mouthLowerDownLeft',
  'mouthLowerDownRight',
  'mouthUpperUpLeft',
  'mouthUpperUpRight',
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeWideLeft',
  'eyeWideRight',
  'eyeLookUpLeft',
  'eyeLookDownLeft',
  'eyeLookInLeft',
  'eyeLookOutLeft',
  'eyeLookUpRight',
  'eyeLookDownRight',
  'eyeLookInRight',
  'eyeLookOutRight',
  'browInnerUp',
];

const path = process.argv[2] ?? 'assets/natalie-phone/natalie.gltf';
const root = dirname(resolve(path));
const gltf = JSON.parse(readFileSync(path, 'utf8'));
const failures = [];

if (!path.endsWith('.gltf')) {
  failures.push('not a .gltf — a .glb keeps its images in the binary chunk');
}

for (const [i, image] of (gltf.images ?? []).entries()) {
  if (image.bufferView !== undefined) {
    failures.push(`images[${i}] is embedded; Hermes cannot decode it`);
  } else if (!image.uri) {
    failures.push(`images[${i}] has neither uri nor bufferView`);
  } else if (!existsSync(resolve(root, image.uri))) {
    failures.push(`images[${i}] uri "${image.uri}" is missing beside the .gltf`);
  }
}

for (const [i, buffer] of (gltf.buffers ?? []).entries()) {
  if (!buffer.uri) failures.push(`buffers[${i}] is embedded rather than a sibling .bin`);
  else if (!existsSync(resolve(root, buffer.uri))) {
    failures.push(`buffers[${i}] uri "${buffer.uri}" is missing beside the .gltf`);
  }
}

for (const extension of gltf.extensionsRequired ?? []) {
  // Anything REQUIRED must be one three can honour without a side loader; the
  // decoder Draco needs is a wasm fetch that the RN loader has no origin for.
  if (extension === 'KHR_draco_mesh_compression') {
    failures.push('KHR_draco_mesh_compression is required — no decoder on device');
  }
}

if ((gltf.skins ?? []).length !== 1) {
  failures.push(`expected exactly 1 skin, found ${(gltf.skins ?? []).length}`);
}

// three's `PropertyBinding.sanitizeNodeName` strips these, so a name is present
// if EITHER spelling is in the file — the presence writer tries both.
const sanitize = (name) => name.replace(/[.:[\]/]/g, '');
const nodeNames = new Set((gltf.nodes ?? []).map((node) => node.name));
for (const bone of RIGIFY_BONES) {
  if (!nodeNames.has(bone) && !nodeNames.has(sanitize(bone))) {
    failures.push(`bone "${bone}" is not in the file — the presence writer would skip it`);
  }
}

const targetNames = new Set(
  (gltf.meshes ?? []).flatMap((mesh) => mesh.extras?.targetNames ?? [])
);
if (targetNames.size === 0) {
  failures.push('no mesh carries extras.targetNames — morphs are unaddressable by name');
}
for (const morph of REQUIRED_MORPHS) {
  if (!targetNames.has(morph)) failures.push(`morph target "${morph}" is missing`);
}

if (failures.length > 0) {
  console.error(`✖ ${path} is NOT loadable/drivable on device:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `✔ ${path}: ${(gltf.images ?? []).length} external images, 1 skin, ` +
    `${targetNames.size} named morph targets, ${RIGIFY_BONES.length} rig bones present`
);

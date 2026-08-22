/**
 * Audits doc 22's API claims against the real three.js — doc 22 §10.9.
 *
 * The spec's own standing gate is *"no invented APIs — cite file + symbol for
 * every seam"*. That is a promise about a document, and a promise about a
 * document is worth exactly as much as the mechanism that checks it. Doc 22 §4
 * names dozens of three.js symbols — `RenderPipeline`, `builtinAOContext`,
 * `RectAreaLightTexturesLib`, `computeSkinning`, `packNormalToRGB` — each one
 * asserting "this exists at 0.185.1". Every one was written by someone reading
 * declarations, which is exactly the process that produces a confident
 * near-miss: `PostProcessing` for `RenderPipeline`, `RectAreaLightUniformsLib`
 * for `RectAreaLightTexturesLib`.
 *
 * So this extracts every backticked identifier from the document and resolves
 * it against the actual runtime exports of `three`, `three/webgpu` and
 * `three/tsl`, plus this package's own source. Anything it cannot find is
 * printed for a human to triage.
 *
 * ── WHY IT REPORTS RATHER THAN FAILS, MOSTLY ────────────────────────────────
 *
 * A spec is prose. It backticks plenty of things that are not exported symbols:
 * file names, WGSL types, GPU limits, CLI flags, chunk names from the WebGL era
 * that deliberately no longer exist. A checker that failed on all of those
 * would be turned off in a week. So: `KNOWN_NON_API` carries the classes of
 * term that are legitimately not exports — each with a reason — and everything
 * else is reported as UNRESOLVED for a person to look at.
 *
 * The one hard failure is `--strict`, for CI: it fails if an unresolved term
 * looks like a three.js API (camelCase or PascalCase, not in the allowlist),
 * which is the shape a genuine invented symbol has.
 *
 * Usage: node tools/verify_doc_claims.mjs <doc.md> [--strict]
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §10.9
 * SOT-KEYWORDS: doc audit api claims verification three symbols standing gate invented
 */
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const docPath = args.find((a) => !a.startsWith('--'));
const strict = args.includes('--strict');
if (!docPath) {
  process.stderr.write('usage: node tools/verify_doc_claims.mjs <doc.md> [--strict]\n');
  process.exit(2);
}
if (!existsSync(docPath)) {
  // The package script points at `../../docs/pack/…`, which resolves from the
  // package directory (where pnpm runs scripts) and NOT from the repo root.
  // Saying so beats an ENOENT stack trace.
  process.stderr.write(
    `cannot read ${docPath}\n` +
      '  (the package script resolves this relative to packages/avatar/, which is\n' +
      '   where pnpm runs it — run it from there, or pass an absolute path)\n'
  );
  process.exit(2);
}

/**
 * The entry points doc 22 actually cites — and the addons matter as much as the
 * core, because half of §4's claims are precisely about WHICH path a symbol
 * comes from: `bloom` from `three/addons/tsl/display/BloomNode.js`, `ao` from
 * `GTAONode.js`, `PMREMGenerator` from `three/webgpu` rather than `three`. A
 * checker that only loaded the three main entries would report every addon
 * claim as unresolved, which is the same as not checking them.
 */
const ENTRY_POINTS = [
  ['three', 'three'],
  ['three/webgpu', 'three/webgpu'],
  ['three/tsl', 'three/tsl'],
  ['three/addons/tsl/display/BloomNode.js', 'addons BloomNode'],
  ['three/addons/tsl/display/GTAONode.js', 'addons GTAONode'],
  ['three/addons/environments/RoomEnvironment.js', 'addons RoomEnvironment'],
  ['three/addons/lights/RectAreaLightTexturesLib.js', 'addons RectAreaLightTexturesLib'],
];

const exported = new Map();
for (const [specifier, label] of ENTRY_POINTS) {
  let mod;
  try {
    mod = await import(specifier);
  } catch (thrown) {
    process.stderr.write(`  (could not load ${specifier}: ${String(thrown).split('\n')[0]})\n`);
    continue;
  }
  for (const key of Object.keys(mod)) {
    if (!exported.has(key)) exported.set(key, label);
  }
}

/**
 * Type-only and property-only names, resolved out of `@types/three` rather than
 * out of a runtime module. `LightingModelDirectInput` is an interface and
 * `colorNode` is a material property — neither appears in `Object.keys()` of
 * anything, and both are load-bearing claims in §4. Grepping the declarations
 * is crude, and it is a great deal better than declaring them unresolved and
 * training the reader to skim the list.
 */
const declared = new Set();
try {
  const { execFileSync } = await import('node:child_process');
  const out = execFileSync(
    'grep',
    ['-rhoE', '(interface|type|declare (class|const)) [A-Za-z_][A-Za-z0-9_]*|^ +[a-zA-Z_][a-zA-Z0-9_]*[?]?:', 'node_modules/@types/three/src'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  for (const line of out.split('\n')) {
    const name = line.trim().replace(/^(interface|type|declare (class|const)) /, '').replace(/[?]?:$/, '');
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) declared.add(name);
  }
} catch {
  process.stderr.write('  (could not scan @types/three declarations)\n');
}

/**
 * This package's own public API, loaded rather than listed.
 *
 * A hand-maintained regex of "our symbols" goes stale the moment someone adds
 * an export, and a stale allowlist in an auditing tool is worse than none — it
 * reports a real symbol as unresolved and teaches the reader to skim. Importing
 * the barrels means the audit tracks the package automatically.
 */
const ours = new Set();
for (const entry of ['../index.ts', '../src/body-index.ts']) {
  try {
    const mod = await import(new URL(entry, import.meta.url).href);
    for (const key of Object.keys(mod)) ours.add(key);
  } catch (thrown) {
    process.stderr.write(`  (could not load ${entry}: ${String(thrown).split('\n')[0]})\n`);
  }
}

/**
 * Members and statics that are reached THROUGH an export rather than exported
 * themselves. Listed with their owner so the citation stays checkable by eye.
 */
const MEMBERS = new Map([
  ['setLTC', 'RectAreaLightNode.setLTC'],
  ['direct', 'PhysicalLightingModel.direct'],
  ['setupLightingModel', 'NodeMaterial.setupLightingModel'],
  ['setupPosition', 'NodeMaterial.setupPosition'],
  ['setupDiffuseColor', 'NodeMaterial.setupDiffuseColor'],
  ['setupDirectRectArea', 'RectAreaLightNode.setupDirectRectArea'],
  ['directRectArea', 'PhysicalLightingModel.directRectArea'],
  ['computeVertices', 'GNMHeadModel.computeVertices (ours)'],
  ['outputColorTransform', 'RenderPipeline.outputColorTransform'],
  ['setMRT', 'PassNode.setMRT'],
  ['getTextureNode', 'PassNode.getTextureNode'],
  ['readRenderTargetPixelsAsync', 'Renderer.readRenderTargetPixelsAsync'],
  ['computeAsync', 'Renderer.computeAsync'],
  ['filterNode', 'LightShadow.filterNode'],
  ['toReadOnly', 'StorageBufferNode.toReadOnly'],
  ['element', 'StorageBufferNode.element'],
  ['getLatency', 'AudioContext.getLatency (react-native-audio-api)'],
  ['currentTime', 'AudioContext.currentTime'],
  ['decodeAudioData', 'AudioContext.decodeAudioData'],
  ['resolveAssetSource', 'Image.resolveAssetSource (react-native)'],
  ['loadAsync', 'GLTFLoader.loadAsync'],
  ['setPixelRatio', 'Renderer.setPixelRatio'],
  ['setSize', 'Renderer.setSize'],
]);

/**
 * Backticked terms that are legitimately not three.js exports. Grouped by why,
 * because "it is in a list" is not a reason and the next person will want one.
 */
const KNOWN_NON_API = new Map([
  // WebGL-era chunk names, cited precisely BECAUSE they no longer exist on this
  // path — that is the content of §4 rows 1 and 12.
  [/^(lights_physical_pars_fragment|lights_fragment_begin|RE_Direct_Physical|begin_vertex|map_fragment|roughnessmap_fragment|color_fragment|common)$/, 'WebGL ShaderChunk name — cited as REMOVED'],
  [/^(ShaderChunk|ShaderLib|UniformsLib|RectAreaLightUniformsLib|PostProcessing|SSAOPass|UnrealBloomPass|OutputPass|RenderPass|EffectComposer|OrbitControls|PCFSoftShadowMap)$/, 'WebGL-path symbol — cited as superseded or removed'],
  // Symbols the document names precisely because they DO NOT exist. This one is
  // the tool's own first catch, and the corrected paragraph has to be able to
  // name it — a checker that cannot tolerate a doc citing a non-existent symbol
  // makes it impossible to write down the correction.
  [/^warnIfNotHardwareAccelerated$/, 'cited BY THIS DOCUMENT as not existing — see the §6 correction'],
  // WebGPU/WGSL vocabulary, not three exports.
  [/^(maxStorageBuffersPerShaderStage|maxStorageBufferBindingSize|maxBufferSize|maxComputeWorkgroupStorageSize|float32Filterable|GPUOffscreenCanvas|GPUAdapter|adapter|limits|WGSL|MSAA|MRT|LTC|GTAO|PMREM|IBL|BRDF|EMA|DPR)$/, 'WebGPU/graphics vocabulary'],
  // Files, paths and formats.
  [/[./]|^SCF4$|^GNMW$|^gnm_head|^smplx|^arkit-|^identity|^lash-|^mouth-|^brow-|^skin-|^eye-|^neck-|^skirt-|^uv$/, 'file, path or format name'],
  // Ours, not three's — checked by the package's own typecheck.
  [/^(GNMHeadModel|SkinLightingModel|ArkitMapper|IdleEngine|EmotionState|TutorStage|createStage|createTutorStage|parseContainer|groundYFor|gateGestureTrack|resolveAssets|captureGoldens|createOffscreenTarget|createHeadCompute|canUseComputeHead|headComputeRequirement|assertCaptureInvariants|assertNoEngagementPressure|assertRigSemantics|assertLoadableInReactNative|validateManifest|assertMotionPolicyComplete|motionPolicy|resolveMotionMode|selectTier|createTierWatcher|setExpression|setFocus|hairColor|positionStorage|garmentRestPosition|aCurvature|aThickness|aEyeAux|aHairT|aHairPhase|aCavity|aTip|identityDim|expressionDim|expressionNames|arkitChannels|baseUrl|minTier|groundY|frameMs|drawCalls|samples|stopAt|fixedDt|seed|traa)$/, 'our own symbol or a data field'],
  // Third-party packages and platform APIs.
  // `react-native-audio-api`'s surface — real, third-party, and out of scope for
  // a three.js audit. Listed by name rather than pattern so adding one is a
  // deliberate act.
  [/^(onPositionChanged|onPositionChangedInterval|AudioBufferSourceNode|AnalyserNode|fftSize|iosBackgroundMode|setAudioSessionOptions|SessionActivationError|interruption|routeChange)$/, 'Web Audio / react-native-audio-api surface'],
  // Ours, but type-only or behind a subpath — a runtime import of the barrels
  // cannot see either, so they are named here rather than silently unresolved.
  [/^(AssetHost|AssetEntry|AssetManifest|GoldenTarget|GoldenCamera|HeadComputeSource|MotionPolicy|IdlePolicy|RigSemantics|jointsWorld|fetchWithProgress|AdapterFacts|TierProfile|StageStats|MotionMode|MotionSurface|motionScale|hairSwayScale|cameraFloatScale|idleBodyScale|low|medium|high)$/, 'our type-only export, subpath symbol, or an enum literal'],
  // three internals and parameter names that are real but not exported.
  [/^(lightData|multiScatteringCompensation|useAnisotropy|tangent)$/, 'three internal, attribute name, or callback parameter — real but not an export'],
  // Literals, English words and identifiers that only look like APIs.
  [/^(true|false|null|undefined|aim|three|phone|tablet|studio|update|pan|orbit|dolly|r18[0-9]|ssao|onPositionChanged|isFallbackAdapter|patchDenimMaterial|vCurv|vThick|uHairTime|uHairSway|onBeforeCompile|WebGPUAttributeUtils|BRDF_GGX_Multiscatter|pointerdown|wheel|getBoundingClientRect|fetch)$/, 'literal, prose word, WebGL-era name, or a symbol the doc cites as NOT existing yet'],
  [/^(react-native-audio-api|fast-text-encoding|expo-file-system|pixelmatch|node-canvas|Hermes|Metro|Blob|ArrayBuffer|Float32Array|Int8Array|Uint8Array|TextDecoder|AudioContext|HTMLAudioElement|localStorage|assetExts|window|document|performance|autoReset|castShadow|receiveShadow|opacity|transparent|alphaTest|vertexColors|anisotropy|anisotropyRotation|clearcoat|roughness|metalness|sheen|color|map|normalMap|roughnessMap|envMapIntensity|side|near|far|fov)$/, 'platform, third-party or plain material property'],
]);

const source = readFileSync(docPath, 'utf8');
const terms = new Map();
for (const match of source.matchAll(/`([^`\n]+)`/g)) {
  const raw = match[1].trim();
  // Strip a trailing call, a generic, or a member access for lookup purposes.
  const term = raw.replace(/\(.*\)$/, '').replace(/<.*>$/, '');
  if (!term || /\s/.test(term)) continue;
  terms.set(term, (terms.get(term) ?? 0) + 1);
}

const resolved = [];
const members = [];
const excused = [];
const unresolved = [];

for (const [term, count] of terms) {
  const bare = term.includes('.') ? term.split('.').pop() : term;
  if (exported.has(term)) {
    resolved.push({ term, where: exported.get(term), count });
  } else if (bare && exported.has(bare)) {
    resolved.push({ term, where: `${exported.get(bare)} (as ${bare})`, count });
  } else if (bare && MEMBERS.has(bare)) {
    members.push({ term, where: MEMBERS.get(bare), count });
  } else if (bare && declared.has(bare)) {
    members.push({ term, where: '@types/three declaration (type or property)', count });
  } else if (bare && ours.has(bare)) {
    members.push({ term, where: '@acme/avatar export (covered by our own typecheck)', count });
  } else {
    const reason = [...KNOWN_NON_API].find(([pattern]) => pattern.test(term))?.[1];
    if (reason) excused.push({ term, reason, count });
    else unresolved.push({ term, count });
  }
}

const looksLikeApi = (term) => /^[a-z][A-Za-z0-9]*$|^[A-Z][A-Za-z0-9]*$/.test(term) && term.length > 3;

process.stdout.write(
  `\n${docPath}\n` +
    `  ${resolved.length} symbols resolved against three 0.185.1 exports\n` +
    `  ${members.length} resolved as documented members of an export\n` +
    `  ${excused.length} known non-API terms (files, WGSL vocabulary, superseded WebGL symbols)\n` +
    `  ${unresolved.length} unresolved\n`
);

const suspicious = unresolved.filter((u) => looksLikeApi(u.term));
if (unresolved.length) {
  process.stdout.write('\nunresolved:\n');
  for (const item of unresolved.sort((a, b) => b.count - a.count)) {
    process.stdout.write(
      `  ${looksLikeApi(item.term) ? 'API-SHAPED' : '          '} ${item.term}  (x${item.count})\n`
    );
  }
}

if (strict && suspicious.length) {
  process.stderr.write(
    `\n${suspicious.length} API-shaped term(s) could not be resolved. Either they do not exist ` +
      'at this three version, or they belong in KNOWN_NON_API with a reason.\n'
  );
  process.exit(1);
}

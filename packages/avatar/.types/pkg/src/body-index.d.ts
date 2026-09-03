/**
 * `@acme/avatar/body` — the three.js-dependent half.
 *
 * Split from the package barrel on a hard line: everything behind `@acme/avatar`
 * imports no renderer at all and runs in Node; everything here needs three.js.
 * Keeping that line visible in the import path means a surface that only wants
 * the idle engine or the viseme sampler cannot accidentally pull a renderer in
 * behind a barrel (doc 20 — Metro does not tree-shake).
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §5
 * SOT-KEYWORDS: avatar body entrypoint three skinned rig conform neck-align public-api
 */
export { loadBody, type Body, type BodyManifest } from './body.ts';
export { createBodyRig, type BodyRig, type GNMNeckDrive, type GesturePose, } from './body-frame.ts';
export { NECK_ALIGN_FROM, NECK_ALIGN_TO, assertNeckAlign, loadNeckAlign, type NeckAlign, } from './neck-align.ts';
export { parseSkirtConform, validateSkirtConformRig } from './skirt-conform.ts';
export { GAZE_RANGE_DEG, HUMANO_BONES, LIP_ZERO, createHumanoPresence, gazeMorphs, lipFromOpenness, sanitizeNodeName, type ConversationPhase, type HumanoBoneKey, type HumanoInput, type HumanoPresence, type LipShape, } from './presence/humano.ts';
export type { SkirtConformData, SkirtConformMeta } from './conform/types.ts';
export { TARGET_FILL, frameBody } from './presence/framing.ts';
export { createSkirtConformDriver, type SkirtConformDriver, } from './conform/driver.ts';
export { sha256, sha256Float32, sha256Hex } from './crypto/sha256.ts';
export { DEFAULT_TONE_MAPPING, OUTPUT_COLOR_SPACE, RIG, TONE_MAPPING_CHOICES, applyToneMapping, chooseToneMapping, createStage, initRectAreaLights, type Stage, type StageOptions, type StageStats, type ToneMappingName, } from './stage.ts';
export { SKIN_CURVATURE_ATTRIBUTE, SKIN_DEFAULTS, SKIN_THICKNESS_ATTRIBUTE, SkinLightingModel, SkinNodeMaterial, createSkinUniforms, skinEmissiveNode, type SkinMaterialOptions, type SkinParams, type SkinUniforms, } from './materials/skin.ts';
export { EYE_AUX_ATTRIBUTE, EYE_SURFACES, createEyeUniforms, makeEyeMaterials, type EyeAuxMeta, type EyeMaterials, type EyeSurface, type EyeUniforms, } from './materials/eyes.ts';
export { HAIR_PHASE_ATTRIBUTE, HAIR_T_ATTRIBUTE, createHairMaterial, createHairUniforms, hairSwayNode, type HairDebugMode, type HairMaterial, type HairMaterialOptions, type HairUniforms, } from './materials/hair.ts';
export { DENIM_PHASE_CHANNEL, GARMENT_REST_ATTRIBUTE, createDenimMaterial, createDenimUniforms, denimColorNode, denimRoughnessNode, seedPhase, type DenimMaterial, type DenimMaterialOptions, type DenimRegion, type DenimUniforms, } from './materials/denim.ts';
export { CAVITY_ATTRIBUTE, CAVITY_FLOOR, buildCavityAttribute, cavityColorNode, makeMouthMaterials, type MouthCavity, type MouthMaterials, } from './materials/mouth.ts';
export { BROW_FADE_AMOUNT, BROW_FADE_START, BROW_TIP_ATTRIBUTE, browOpacityNode, createBrowMaterial, type BrowMaterial, type BrowMaterialOptions, } from './materials/brow.ts';
export { LOWER_LENGTH, ROWS, TILE_METRES, UPPER_LENGTH, assertMarginBounds, configureLashTexture, createLashMaterial, createLashes, type LashLines, type Lashes, } from './lashes.ts';
export { POSITION_STORAGE_ATTRIBUTE, WEBGPU_DEFAULT_LIMITS, canUseComputeHead, createHeadCompute, dispatchHead, evaluateOnCpu, headComputeRequirement, packExpressionBasis, type AdapterLimits, type ComputeGate, type HeadCompute, type HeadComputeRequirement, type HeadComputeSource, } from './compute/head.ts';
export { REQUIRED_RN_GLOBALS, assertLoadableInReactNative, assetsForTier, downloadBytesForTier, resolveAssets, tierMeets, validateManifest, type AssetEntry, type AssetHost, type AssetKind, type AssetManifest, type AssetTier, type ResolveOptions, type ResolvedAsset, } from './assets.ts';
export { DEFAULT_ORBIT_LIMITS, createOrbitControls, type OrbitControls, type OrbitControlsOptions, type OrbitLimits, } from './controls.ts';
export { GOLDEN_BUDGET, GOLDEN_CAMERAS, GOLDEN_FRAME_MS, GOLDEN_SEED, GOLDEN_STOP_AT, WARMUP_FRAMES, assertCaptureInvariants, captureGoldens, formatReport, summarise, type CameraVerdict, type CaptureInvariants, type CaptureOptions, type GoldenCamera, type GoldenFrame, type GoldenReport, type GoldenTarget, } from './testing/golden.ts';
export { GOLDEN_HEIGHT, GOLDEN_WIDTH, createOffscreenTarget, degToRad, describeCapture, type OffscreenTarget, type OffscreenTargetOptions, } from './testing/offscreen-target.ts';

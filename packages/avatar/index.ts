/**
 * `@acme/avatar` — the embodied tutor renderer.
 *
 * This barrel is deliberately THIN. Doc 20's rule is that Metro does not
 * tree-shake, so a runtime re-export of a heavy module through a barrel drags
 * that module into every bundle that touches the package. The head evaluator
 * will be the heaviest thing here and is therefore never re-exported — it gets
 * its own `@acme/avatar/gnm` subpath, so paying for it is always a deliberate
 * import rather than an accident of naming.
 *
 * What lives behind this barrel is the shared, platform-agnostic core: the
 * deterministic idle engine, the emotion bus, the viseme sampler, the
 * single-writer guards, and the expression store. None of it imports three.js,
 * a renderer, or a DOM API — that is the property that lets it run in Node for
 * the golden-image and unit harnesses on every platform we ship.
 *
 * Two siblings sit outside this barrel on purpose: `@acme/avatar/gnm` (the head
 * evaluator) and `@acme/avatar/body` (everything that needs three.js). Reaching
 * for either is then a visible decision in the import path.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §5, docs/pack/20-build-optimization-spec.md
 * SOT-KEYWORDS: avatar package barrel public-api index entrypoint natalie tutor-stage
 */

// Emotion — BEAT categories as eased face baselines under speech.
export { EMOTION_PRESETS, EmotionState, type EmotionCategory } from './src/emotion.ts';

// Idle — the deterministic vegetative layer.
export { idleConfig, type IdleConfig, type Range } from './src/idle/config.ts';
export {
  IDLE_CHANNELS,
  IdleEngine,
  mulberry32,
  type IdleChannel,
  type IdleFrame,
  type IdleInputs,
} from './src/idle/engine.ts';

// Speech — the sampler, the driver, and the encoder that turns named ARKit
// weights into the head's expression vector (which container decides how).
export {
  ArkitMapper,
  sampleTrack,
  type ArkitMap,
  type GestureTrack,
  type Shape,
  type SpeechSample,
  type Track,
} from './src/speech/track.ts';
export {
  ONSET_LEAD_MS,
  createSpeechDriver,
  evenTrack,
  type AudioBackend,
  type DecodedUtterance,
  type SpeechDriver,
  type Utterance,
} from './src/speech/driver.ts';
export { analyseSpeech } from './src/speech/audio-shapes.ts';
export {
  directEncoder,
  encoderForContainer,
  matrixEncoder,
  type EncoderContainerMeta,
  type ExpressionEncoder,
} from './src/speech/encoder.ts';
export {
  createAudioApiBackend,
  type AudioBufferLike,
  type AudioBufferSourceLike,
  type WebAudioLike,
} from './src/speech/backend-audio-api.ts';

// Device tiers and the demotion that keeps a tier honest.
export {
  DEFAULT_DEMOTION,
  REBAKED_HEAD_BUDGET,
  TIERS,
  TIER_PROFILES,
  canComputeHead,
  createTierWatcher,
  selectTier,
  tierBelow,
  type AdapterFacts,
  type DemotionConfig,
  type DeviceClass,
  type HeadBudget,
  type Tier,
  type TierProfile,
  type TierWatcher,
} from './src/tiers.ts';

// The single face writer.
export {
  createFaceBus,
  type ConversationCues,
  type FaceBus,
  type FaceBusOptions,
} from './src/face-bus.ts';

// Single-writer guards — the face and the neck each have exactly one owner.
// `resetNeckWriterForTests` is intentionally absent: it is reachable inside
// the package for its own tests and has no business in the public API.
export { claimNeckFrame, claimNeckWriter } from './src/neck-writer.ts';
export { claimFaceWriter, avatarStore } from './src/store.ts';

// The 2D ↔ 3D handoff. Renderer-free on purpose — the 2D-only build imports
// this and gets no three.js behind it (doc 20: Metro does not tree-shake).
export {
  DEFAULT_MINIMUM_PRESENCE_MS,
  createTutorStage,
  shouldRender3D,
  showsProgress,
  type SettleReason,
  type StagePhase,
  type StageState,
  type Surface,
  type TutorStage,
  type TutorStageOptions,
} from './src/tutor-stage.ts';

// The child-safety boundary as code — doc 22 §7. Renderer-free: the gate runs
// wherever the gesture track is handled, including before it reaches a stage.
export {
  CALM_IDLE,
  DEFAULT_GESTURE_LIMITS,
  DEFAULT_RIG_SEMANTICS,
  FORBIDDEN_GESTURES,
  PERMITTED_GESTURES,
  assertNoEngagementPressure,
  assertRigSemantics,
  gateGestureTrack,
  isPermittedGesture,
  type ForbiddenGesture,
  type GateResult,
  type GestureFunction,
  type GestureLimits,
  type IdlePolicy,
  type PermittedGesture,
  type RigSemantics,
  type Violation,
  type ViolationKind,
} from './src/safety/gesture-gate.ts';

// Reduced motion as one render mode — doc 22 §7. Vestibular accessibility, and
// in a headset a safety floor rather than a preference.
export {
  ANIMATED_SURFACES,
  MOTION_POLICIES,
  applyMotionPolicy,
  assertMotionPolicyComplete,
  motionPolicy,
  resolveMotionMode,
  type AnimatedSurface,
  type MotionConsumers,
  type MotionInputs,
  type MotionMode,
  type MotionPolicy,
  type MotionSurface,
} from './src/reduced-motion.ts';

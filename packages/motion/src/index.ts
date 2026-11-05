/**
 * `@acme/motion`: motion definitions, presets and the reduced-motion policy,
 * safe on every runtime (web, React Native, Spark desktop, Node tests). It
 * imports only Kinetrell's core, which has no React, Reanimated or DOM
 * dependency. Runtime wrappers live behind `@acme/motion/native` and
 * `@acme/motion/web`, mirroring Kinetrell's own entry-point boundaries.
 *
 * SOT: kinetrell src/core/index.ts · docs/motion/README.md
 * SOT-KEYWORDS: motion package kinetrell core entry presets policy registry
 */
export {
  compileMotion,
  defineMotion,
  evaluateMotion,
  KINETRELL_DIAGNOSTIC_CODES,
  type CompiledMotion,
  type EaseName,
  type KinetrellDiagnostic,
  type MotionDefinition,
  type MotionState,
  type MotionTrack,
} from 'kinetrell/core';
export * from './presets.ts';
export * from './policy.ts';
export * from './registry.ts';
export * from './gate.ts';
export * from './signatures/index.ts';

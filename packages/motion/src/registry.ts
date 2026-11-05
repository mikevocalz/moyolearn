/**
 * Every choreographed motion in the product, by id.
 *
 * A definition is registered where it is defined (`packages/motion/src/
 * signatures/`), never at a call site, so the CI gate in `inspector.test.ts`
 * sees the same set the app ships: it compiles each one, runs Kinetrell's
 * `findMotionConflicts`, and fails on any diagnostic. `registerMotion` refuses
 * a second definition under an existing id; two motions sharing an id would
 * share an inspector scene and hide each other's conflicts.
 *
 * SOT: kinetrell src/dev/inspector.ts (findMotionConflicts)
 * SOT-KEYWORDS: motion registry definitions inspector gate kinetrell
 */
import { defineMotion, type MotionDefinition } from 'kinetrell/core';

const definitions = new Map<string, MotionDefinition>();

export function registerMotion<const T extends MotionDefinition>(definition: T): T {
  const frozen = defineMotion(definition);
  const existing = definitions.get(frozen.id);
  if (existing && existing !== frozen) {
    throw new Error(`motion "${frozen.id}" is already registered`);
  }
  definitions.set(frozen.id, frozen);
  return frozen;
}

export function registeredMotions(): readonly MotionDefinition[] {
  return [...definitions.values()];
}

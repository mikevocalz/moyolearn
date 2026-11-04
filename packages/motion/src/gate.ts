/**
 * The two checks every registered motion must pass, shared by the CI suite
 * and the dev inspector so the build and the running app judge the same way.
 *
 * - Ownership: Kinetrell's `findMotionConflicts` reports two tracks writing one
 *   property of one target in overlapping time. Kinetrell resolves that by
 *   "later track wins", which is deterministic but almost never what the
 *   storyboard meant, so Moyo treats any diagnostic as a failure.
 * - Determinism: `evaluateMotion` at the storyboard's frame times. Those are
 *   0, every label the definition names, and the end. The values are pure
 *   functions of the definition, so a snapshot of them is the native-side
 *   equivalent of a web filmstrip: if a token or a track changes, the frames
 *   change and the snapshot test says which.
 *
 * SOT: kinetrell src/dev/inspector.ts (findMotionConflicts),
 *      src/core/evaluate.ts (evaluateMotion), src/core/compile.ts (compileMotion)
 * SOT-KEYWORDS: motion gate conflicts determinism storyboard frames evaluate
 */
import {
  compileMotion,
  evaluateMotion,
  type CompiledMotion,
  type KinetrellDiagnostic,
  type MotionDefinition,
  type MotionState,
} from 'kinetrell/core';
import { findMotionConflicts } from 'kinetrell/dev/inspector';

export type StoryboardFrame = Readonly<{
  name: string;
  timeMs: number;
  state: Readonly<Record<string, MotionState>>;
}>;

export type MotionAudit = Readonly<{
  id: string;
  compiled: CompiledMotion;
  diagnostics: readonly KinetrellDiagnostic[];
}>;

export function auditMotion(definition: MotionDefinition): MotionAudit {
  const compiled = compileMotion(definition);
  return { id: compiled.id, compiled, diagnostics: findMotionConflicts(compiled) };
}

export function storyboardFrames(compiled: CompiledMotion): readonly StoryboardFrame[] {
  const named = new Map<number, string>([[0, 'start']]);
  for (const [name, timeMs] of Object.entries(compiled.labels)) {
    named.set(Math.min(timeMs, compiled.durationMs), name);
  }
  if (!named.has(compiled.durationMs)) named.set(compiled.durationMs, 'end');
  return [...named.entries()]
    .sort(([a], [b]) => a - b)
    .map(([timeMs, name]) => ({ name, timeMs, state: evaluateMotion(compiled, timeMs) }));
}

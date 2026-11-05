/**
 * `@acme/motion/dev`: the motion inspector for development builds.
 *
 * `mountMotionInspector()` builds a Kinetrell inspector for every registered
 * motion, logs each conflict once, and hands back the inspectors so a dev menu
 * or a debugger session can call `snapshotAt(ms)` on a live scene. It does
 * nothing outside a development build, so a production bundle that reaches it
 * pays one boolean check. The CI gate (`inspector.test.ts`) runs the same
 * `auditMotion` over the same registry; this is the in-app view of that result.
 *
 * SOT: kinetrell src/dev/inspector.ts (createMotionInspector)
 * SOT-KEYWORDS: motion inspector dev diagnostics conflicts snapshot
 */
import { createMotionInspector } from 'kinetrell/dev/inspector';
import { auditMotion } from './gate.ts';
import { readPolicyEnvironment } from './policy.ts';
import { registeredMotions } from './registry.ts';

export type MotionInspector = ReturnType<typeof createMotionInspector>;

export function mountMotionInspector(
  options: Readonly<{ dev?: boolean; report?: (message: string) => void }> = {},
): ReadonlyMap<string, MotionInspector> {
  const inspectors = new Map<string, MotionInspector>();
  if (!readPolicyEnvironment(options.dev).dev) return inspectors;
  const report = options.report ?? ((message: string) => console.warn(message));
  for (const definition of registeredMotions()) {
    const audit = auditMotion(definition);
    inspectors.set(audit.id, createMotionInspector(audit.compiled));
    for (const diagnostic of audit.diagnostics) {
      report(`[motion] ${diagnostic.code} ${audit.id}: ${diagnostic.message}`);
    }
  }
  return inspectors;
}

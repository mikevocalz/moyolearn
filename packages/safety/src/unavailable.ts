// A safety layer being DOWN, told apart from a safety layer returning a verdict.
//
// Doc 12 §5: "if any safety layer is unavailable, tutoring pauses" — never an
// error screen at a child, and never a retry, because a retry is a second trip
// past the layer that just failed to screen the first one. That sentence was
// unenforceable while an outage and a vendor blip arrived at the service as the
// same bare `Error`, so this file is the distinction the rule needs to exist.
//
// It reads as unnecessary today and that is precisely the trap: L3/L4/L5 are
// pure regex functions that cannot be unavailable, so a fail-closed branch
// written against them is dead code that a reviewer deletes. The day doc 18 §3
// layer 5's model-backed classifier lands, every one of those calls acquires a
// network failure mode, and `safetyLayer` is what decides — once, here — that
// the failure pauses the tutor rather than retrying past it.
//
// The MODEL is deliberately not a safety layer. A vendor outage or a missing
// API key is availability, and conflating the two once already put an
// unconfigured dev environment into the paused state, which reads to a child as
// Natalie having withdrawn.
// SOT: docs/pack/12-systems-design-prompt.md §5 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: safety layer unavailable fail closed pause outage classifier firewall identity boundary

/**
 * The layers a turn can be stopped at, named exactly as `PlaneLog.layer` names
 * them so a paused turn and its trace line say the same thing to the reviewer
 * reading both. `4-fence` and `7-memory` are absent because neither calls out:
 * the fence is a branch on an already-returned class, and memory hygiene is a
 * pure predicate.
 */
export const SAFETY_LAYERS = [
  '1-identity',
  '2-firewall',
  '3-input',
  '5-output',
  '6-crisis',
] as const satisfies readonly string[];

export type SafetyLayer = (typeof SAFETY_LAYERS)[number];

/**
 * A safety layer could not reach a verdict. NOT a verdict of its own: nothing
 * here says the turn was unsafe, only that nothing was able to say it was safe.
 */
export class SafetyLayerUnavailable extends Error {
  readonly layer: SafetyLayer;

  constructor(layer: SafetyLayer, cause?: Error) {
    super(`Safety layer ${layer} is unavailable`, cause ? { cause } : undefined);
    this.name = 'SafetyLayerUnavailable';
    this.layer = layer;
  }
}

/**
 * Wraps whatever the failing layer threw. A layer that already named itself is
 * passed through unchanged, so the innermost layer to fail is the one reported
 * rather than the outermost one to notice.
 */
function unavailable(layer: SafetyLayer, error: Error | undefined): never {
  if (error instanceof SafetyLayerUnavailable) throw error;
  throw new SafetyLayerUnavailable(layer, error);
}

/**
 * Runs one safety layer. Any failure becomes `SafetyLayerUnavailable`, which is
 * what makes the rule hold for layers nobody has written yet: a classifier
 * added later fails closed without its author having to know that it should.
 *
 * Every call to a classifier, a firewall, or an identity lookup on the learner
 * path goes through this or `safetyLayerSync` — `tooling/check-fail-closed.mjs`
 * fails the build on one that does not.
 */
export async function safetyLayer<T>(layer: SafetyLayer, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    unavailable(layer, error instanceof Error ? error : undefined);
  }
}

/** The same terms for a layer that answers without awaiting, like the firewall. */
export function safetyLayerSync<T>(layer: SafetyLayer, run: () => T): T {
  try {
    return run();
  } catch (error) {
    unavailable(layer, error instanceof Error ? error : undefined);
  }
}

// The two ways a provider call ends without text, told apart.
//
// `packages/safety/src/unavailable.ts` already draws the line that matters most
// — a safety LAYER that cannot answer pauses the tutor, and everything else is
// retryable — and it says explicitly that the MODEL is deliberately not a safety
// layer. Both errors here are therefore on the retryable side of that line, and
// `coach.service.ts` turns both into `{ kind: 'unavailable' }` → `retry`.
//
// They are still separate classes, because they are separate operational facts:
// `ProviderUnavailable` means the socket, the credential, or the vendor's
// capacity, and its rate is an availability number. `ModelDeclined` means the
// vendor's own safety classifier said no to a homework question, and its rate
// is a product number — a benign turn being refused is a false positive worth a
// dashboard, not a blip worth a retry counter.
//
// Doc 12 §5's failure table routes a surviving `refusal` to the fail-closed
// PAUSE rather than a retry, on the grounds that the provider's safety layer
// reached a decision. That is not what happens today: `tutor-model.ts` throws
// on refusal and the boundary reads any non-`SafetyLayerUnavailable` throw as
// retryable, so a refusal offers a retry. Moving it would change a shipped
// behaviour on the coaching path, so it is named here and left for the change
// that owns `coach.service.ts`'s catch — `ModelDeclined` is the type that
// branch will test for when it lands.
// SOT: docs/design/inference-gateway.md §6 · docs/pack/12-systems-design-prompt.md §5
// SOT-KEYWORDS: inference errors provider unavailable model declined refusal fail closed retry transport
import 'server-only';
import type { DeclineCategory } from './types.ts';

/**
 * The turn could not be attempted or could not finish: no credential, a 429, a
 * 5xx, a dropped socket. Availability, with the Safety Plane intact.
 */
export class ProviderUnavailable extends Error {
  constructor(message: string, cause?: Error) {
    super(message, cause ? { cause } : undefined);
    this.name = 'ProviderUnavailable';
  }
}

/**
 * The provider's own safety classifier declined the turn.
 *
 * Thrown rather than returned as empty text for the reason `tutor-model.ts`
 * already gives: ending the stream silently would render as Natalie trailing
 * off mid-thought.
 */
export class ModelDeclined extends Error {
  readonly category: DeclineCategory | null;
  /** The model that actually declined — with fallbacks on, not the one asked. */
  readonly servedBy: string;

  constructor(servedBy: string, category: DeclineCategory | null) {
    super(`Model declined the turn${category ? ` (${category})` : ''}`);
    this.name = 'ModelDeclined';
    this.category = category;
    this.servedBy = servedBy;
  }
}

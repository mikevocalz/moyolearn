// Provider transport failures are retryable. A provider safety refusal is a
// terminal verdict and is never retried through a different model.
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
  /** The model reported by the provider; refusal never triggers a fallback. */
  readonly servedBy: string;

  constructor(servedBy: string, category: DeclineCategory | null) {
    super(`Model declined the turn${category ? ` (${category})` : ''}`);
    this.name = 'ModelDeclined';
    this.category = category;
    this.servedBy = servedBy;
  }
}

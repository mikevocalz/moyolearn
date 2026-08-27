// The routing table — which model does which job (doc 12 §7).
//
// "Small model for L3/L5 classification and topic fencing; frontier model only
// for the tutoring turn." It is a checked-in `as const` map rather than config,
// for the reason `tutor-model.ts` already gave about the constant it replaces:
// which model teaches a child is a decision that belongs in a reviewed commit,
// not in a deploy variable.
//
// Three of the four cells route calls that are not yet made. `tutor-safety.ts`
// runs L3/L5 as deterministic regex and documents the L4 fence as a deliberate
// omission, and doc 18 §3 gates the model-backed versions behind PR-50's eval
// registry. The cells exist anyway because the shape of the table is what makes
// the day they land a routing change instead of a design.
//
// The cell type is a union over CAPABILITY, not a struct with an optional
// `effort`. `{ model: 'claude-haiku-4-5', effort: 'low' }` does not compile,
// because Haiku rejects `output_config.effort` with a 400 and the table is
// where that has to be impossible — a runtime guard here is a guard that only
// fires in front of a child.
// SOT: docs/design/inference-gateway.md §3 · docs/pack/12-systems-design-prompt.md §7 · docs/pack/18-tutor-ai-stack.md §2 §3
// SOT-KEYWORDS: routing table role model frontier haiku classifier topic fence capability effort cost control
import 'server-only';
import { MODEL_PROFILES, profileFor, type EffortModel, type FlatModel, type ModelId } from './models.ts';
import { scrubOutbound } from './pseudonymize.ts';
import type { Effort, InferencePayload, InferenceRequest, InferenceRole } from './types.ts';

/**
 * One row. The two arms are the two request shapes the vendor accepts, and the
 * discriminant is the model's own capability row rather than a flag a caller
 * sets — see `models.ts:EffortModel`.
 */
export type RoutingCell =
  | {
      readonly model: EffortModel;
      readonly maxTokens: number;
      readonly effort: Effort;
      readonly serverSideFallback: boolean;
    }
  | {
      readonly model: FlatModel;
      readonly maxTokens: number;
      readonly serverSideFallback: boolean;
    };

/**
 * `effort: 'low'` on the tutoring turn is what `tutor-model.ts` already sends
 * and the reasoning carries over: the reasoning is shallow — one pedagogical
 * move on a problem the brief already frames — and the latency is in front of a
 * child waiting for a reply.
 *
 * `serverSideFallback` is on for the tutoring turn only. The frontier tier runs
 * safety classifiers of its own that can decline a benign homework turn; with
 * fallbacks on, a declined turn is re-run on a fallback model inside the same
 * call, and a `refusal` that survives that means the whole chain refused —
 * which is unambiguously the fail-closed case rather than a vendor mood. A
 * classifier cell keeps it off: a declined classification is a verdict worth
 * seeing rather than a turn worth rescuing.
 */
export const ROUTING = {
  'tutor-turn': { model: 'claude-opus-5', maxTokens: 1024, effort: 'low', serverSideFallback: true },
  'classify-input': { model: 'claude-haiku-4-5', maxTokens: 64, serverSideFallback: false },
  'classify-output': { model: 'claude-haiku-4-5', maxTokens: 64, serverSideFallback: false },
  'topic-fence': { model: 'claude-haiku-4-5', maxTokens: 64, serverSideFallback: false },
  /*
    Doc 34 §4 step 2 — the session-report narrative pass. The SAME small model
    as the classifier cells (the phrasing job is classifier-tier by design: the
    numbers come from extracted evidence rows, the model only words them), but
    its own cell because 64 tokens cannot hold the five narrative blocks — the
    output is a small JSON object, not a class label. Fallback stays off for
    the classifier reason inverted: a declined or truncated narrative is not
    rescued by a second model, it falls back to the deterministic evidence
    copy in `packages/app/features/summary/narrative.ts`.
  */
  'summary-narrative': { model: 'claude-haiku-4-5', maxTokens: 1024, serverSideFallback: false },
} as const satisfies Record<InferenceRole, RoutingCell>;

export function routeFor(role: InferenceRole): RoutingCell {
  return ROUTING[role];
}

export function modelFor(role: InferenceRole): ModelId {
  return ROUTING[role].model;
}

/**
 * Rough token count for the cache-breakpoint decision.
 *
 * Four characters per token is the vendor's own rule of thumb and it is used
 * here for one binary question — is this prefix long enough to cache at all —
 * where being 20% out changes nothing. Counting exactly would mean a
 * `count_tokens` round trip before every turn, which is a network call to save
 * a network call.
 */
const CHARS_PER_TOKEN = 4;

/**
 * The only way an `InferenceRequest` is built.
 *
 * Three things happen here and each is a rule from somewhere else:
 *
 *   1. The payload is scrubbed (§4.3). Assembly is the earliest point the
 *      gateway sees the text, so it is the earliest point it can be masked.
 *   2. `effort` is carried only from a cell whose model takes it, which the
 *      cell union has already made the only possibility.
 *   3. `cacheSystem` is decided against the model's own minimum rather than
 *      set unconditionally. Below the minimum the vendor accepts the
 *      breakpoint and silently ignores it, so an unconditional `true` reads as
 *      a caching strategy while being nothing at all — and on the classifier
 *      cell, whose system half is a short instruction, that is exactly the
 *      case.
 */
export function requestFor(
  role: InferenceRole,
  payload: InferencePayload,
  signal?: AbortSignal,
): InferenceRequest {
  const cell = ROUTING[role];
  const profile = profileFor(cell.model);
  const scrubbed = scrubOutbound(payload);
  const systemTokens = Math.ceil(scrubbed.system.length / CHARS_PER_TOKEN);

  return {
    modelId: profile.id,
    payload: scrubbed,
    maxTokens: cell.maxTokens,
    ...('effort' in cell ? { effort: cell.effort } : {}),
    cacheSystem: systemTokens >= profile.minCacheablePrefixTokens,
    serverSideFallback: cell.serverSideFallback,
    ...(signal ? { signal } : {}),
  };
}

/** Narrows a routed model id back to a profile key. */
export function isKnownModel(id: string): id is ModelId {
  return Object.hasOwn(MODEL_PROFILES, id);
}

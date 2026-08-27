// The provider adapter interface — what a model vendor is allowed to look like
// from inside this system (doc 12 §9.3).
//
// Every shape here is either two strings going out or a number coming back.
// There is no metadata bag, no `Record<string, string>` of extras, and no field
// that accepts an identity: a payload with an open-ended extras field is the
// field a learner's name eventually arrives in, so there isn't one (ADR-005 §1).
//
// The response types are DERIVED from the vendor SDK rather than restated, so a
// stop reason the vendor adds is a compile error here rather than a value that
// falls through a switch at 3am. `InferenceStop` is `StopReason` minus the one
// case this gateway structurally cannot produce.
// SOT: docs/design/inference-gateway.md §2 · docs/pack/12-systems-design-prompt.md §3 §9.3 · docs/pack/01-ai-tutoring-platform-plan.md ADR-005
// SOT-KEYWORDS: inference gateway provider adapter interface payload usage outcome stream egress pseudonymous
import 'server-only';
import type { BetaStopReason } from '@anthropic-ai/sdk/resources/beta/messages';

/**
 * Which job a call is doing. Not a model name — `ROUTING` maps a role to a
 * model, and a caller that could name a model could name the wrong one.
 */
export type InferenceRole =
  | 'tutor-turn'
  | 'classify-input'
  | 'classify-output'
  | 'topic-fence'
  | 'summary-narrative';

/**
 * Every role except the tutoring turn: one shot, no stream, a small-model
 * completion. `summary-narrative` (doc 34 §4 step 2) rides this arm on
 * purpose: the report's phrasing pass is a small-model job over an extracted
 * evidence table — never a frontier call, never a stream, and never a call
 * that sees a transcript.
 */
export type ClassifierRole = Exclude<InferenceRole, 'tutor-turn'>;

/**
 * The entire egress payload. Structurally `TutorPrompt`
 * (`packages/student-model/src/inference.ts`) plus nothing: two strings, no
 * identity, no session handle, no free-form metadata.
 */
export interface InferencePayload {
  /** Policy half. Stable within a session, so it carries the cache breakpoint. */
  readonly system: string;
  /** The turn being reasoned about or classified. */
  readonly message: string;
}

/**
 * `Message.usage`, normalised.
 *
 * The vendor types `cache_creation_input_tokens` and `cache_read_input_tokens`
 * as `number | null` — null meaning "no cache activity", not "unknown". The
 * budget adds these up, and an arithmetic type that admits null is an arithmetic
 * type someone writes `+ null` into, so the nulls are collapsed at the adapter.
 */
export interface InferenceUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly cacheCreationInputTokens: number;
}

/**
 * `Message.stop_reason`, narrowed to what a tutoring or classification turn can
 * produce.
 *
 * Derived from the BETA union, because the tutoring cell runs on the beta
 * endpoint — `fallbacks` lives there and nowhere else. That union is a strict
 * superset of the stable one, so nothing is lost by deriving from it, and a
 * vendor that adds a stop reason breaks the build here instead of falling out
 * of a switch.
 *
 * Two values are excluded rather than handled, and both for the same reason:
 * they describe features this gateway does not enable. `tool_use` cannot happen
 * because no tools are declared — a tool argument is the classic route by which
 * an identity re-enters a payload that CLAUDE.md forbids it from entering, so
 * the absence is structural. `compaction` cannot happen because a coaching turn
 * is one system half and one message and never approaches a context window.
 * Either arriving means the transport is not the one this file thinks it is.
 */
export type InferenceStop = Exclude<BetaStopReason, 'tool_use' | 'compaction'>;

/**
 * Why the provider's own safety classifier declined, when it did.
 *
 * Present only on `stop: 'refusal'` and `null` even then when the vendor gives
 * no category, which is why the field is nullable rather than optional: absent
 * and unknown are the same state to a safety log and pretending otherwise
 * invites a `?.` that hides a real null.
 */
export type DeclineCategory = 'cyber' | 'bio' | 'frontier_llm' | 'reasoning_extraction' | 'general_harms';

/** What `stream.finalMessage()` is worth keeping. */
export interface InferenceOutcome {
  readonly stop: InferenceStop;
  readonly usage: InferenceUsage;
  /** The model that actually served the turn — not the one that was requested. */
  readonly servedBy: string;
  /** Populated only when `stop === 'refusal'`, and nullable even then. */
  readonly declineCategory: DeclineCategory | null;
}

/**
 * A streamed turn. Text deltas arrive on the iterable; terminal metadata
 * arrives on `settled`, which resolves only after the iterable is exhausted.
 *
 * Two channels rather than one union frame because the Safety Plane's streaming
 * path (`packages/safety/src/plane.ts:runSafetyPlaneStream`) consumes a plain
 * `AsyncIterable<string>` and buffers it into sentences. A metadata frame
 * interleaved with the text would have to be filtered out inside the sentence
 * window, which is the one loop in the system that must stay boring.
 */
export interface InferenceStream {
  readonly text: AsyncIterable<string>;
  readonly settled: Promise<InferenceOutcome>;
}

export interface InferenceCompletion {
  readonly text: string;
  readonly outcome: InferenceOutcome;
}

/**
 * The provider adapter. One implementation per vendor; `AnthropicAdapter` is
 * the only one for v1 (ADR-018 §1: Claude is the tutor brain).
 *
 * `stream` is the tutoring turn. `complete` is a classifier call: one shot, no
 * stream, because a class label has nothing to render progressively and the
 * plane needs it whole before it can route on it.
 */
export interface ProviderAdapter {
  readonly vendor: 'anthropic';
  stream(request: InferenceRequest): InferenceStream;
  complete(request: InferenceRequest): Promise<InferenceCompletion>;
}

/** Effort levels the vendor accepts, derived so a new tier is not a retype. */
export type Effort = NonNullable<
  NonNullable<import('@anthropic-ai/sdk/resources/messages').OutputConfig['effort']>
>;

/**
 * One call, fully resolved. Built by `requestFor` from a role, never by hand at
 * a call site — see `routing.ts` for why `effort` cannot be set on a model that
 * rejects it.
 */
export interface InferenceRequest {
  readonly modelId: string;
  readonly payload: InferencePayload;
  readonly maxTokens: number;
  /** Applied only when the routed model's profile says the model takes it. */
  readonly effort?: Effort;
  /** Applied only when the system half clears `minCacheablePrefixTokens`. */
  readonly cacheSystem: boolean;
  /**
   * Opt into the vendor's server-side refusal fallback. Per-role rather than
   * global: a declined classification is a verdict worth seeing, while a
   * declined tutoring turn is a child watching Natalie stop mid-sentence.
   */
  readonly serverSideFallback: boolean;
  /** The child navigated away; tear the vendor stream down rather than bill it. */
  readonly signal?: AbortSignal;
}

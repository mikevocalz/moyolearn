// Model capability, as data.
//
// The two tiers do NOT take the same request. Claude Haiku 4.5 rejects
// `output_config.effort` outright and does not do adaptive thinking, so the
// frontier tier's flat request shape is a 400 on the classifier cell rather
// than a no-op that costs a little more. That fact has to live somewhere, and
// the choice is between a branch in the adapter — which the next adapter
// forgets — and a row in a table the type system reads.
//
// It is a table. `EffortModel` below is computed FROM the table, so a routing
// cell that pairs a small model with an effort level does not compile; the
// adapter then re-reads the same flags when it builds the wire params, so a
// hand-built request cannot smuggle one past either. Two guards, one fact.
//
// Prices are list USD per million tokens and exist for the budget in §7, not
// for display: CLAUDE.md forbids a price rendering on a learner surface, and a
// number that never leaves this package cannot.
// SOT: docs/design/inference-gateway.md §2.2 §3 · docs/pack/18-tutor-ai-stack.md §2 · docs/pack/12-systems-design-prompt.md §7
// SOT-KEYWORDS: model profile capability effort adaptive thinking cache prefix price routing frontier haiku
import 'server-only';
import type { Model } from '@anthropic-ai/sdk/resources/messages';
import type { InferenceUsage } from './types.ts';

/**
 * Per-model capability and price.
 *
 * `id` is the vendor's `Model` union rather than a bare string so a typo in a
 * model name is a compile error at the one place model names are written down.
 */
export interface ModelProfile {
  readonly id: Model;
  /** `output_config.effort`. False means sending it is a 400, not a no-op. */
  readonly supportsEffort: boolean;
  /** `thinking: { type: 'adaptive' }`. False means omit the field entirely. */
  readonly supportsAdaptiveThinking: boolean;
  /** Below this, `cache_control` is accepted and silently does nothing. */
  readonly minCacheablePrefixTokens: number;
  readonly inputUsdPerMTok: number;
  readonly outputUsdPerMTok: number;
  readonly cacheReadUsdPerMTok: number;
  readonly cacheWriteUsdPerMTok: number;
}

/**
 * The models this system is allowed to reach. `claude-sonnet-5` is deliberately
 * absent: it is the fallback candidate if Haiku's classification recall proves
 * insufficient, and adding it is a routing-table commit rather than a config
 * change (doc 18 §2 — which model teaches a child is a reviewed decision).
 */
export const MODEL_PROFILES = {
  'claude-opus-5': {
    id: 'claude-opus-5',
    supportsEffort: true,
    supportsAdaptiveThinking: true,
    minCacheablePrefixTokens: 512,
    inputUsdPerMTok: 5,
    outputUsdPerMTok: 25,
    // Cache reads bill at ~0.1x input, writes at ~1.25x. Derived numbers rather
    // than derived expressions: the ratios are the vendor's and can move
    // independently of the base price.
    cacheReadUsdPerMTok: 0.5,
    cacheWriteUsdPerMTok: 6.25,
  },
  'claude-haiku-4-5': {
    id: 'claude-haiku-4-5',
    supportsEffort: false,
    supportsAdaptiveThinking: false,
    minCacheablePrefixTokens: 4096,
    inputUsdPerMTok: 1,
    outputUsdPerMTok: 5,
    cacheReadUsdPerMTok: 0.1,
    cacheWriteUsdPerMTok: 1.25,
  },
} as const satisfies Record<string, ModelProfile>;

export type ModelId = keyof typeof MODEL_PROFILES;

/**
 * The models whose profile sets `flag`. Computed from the table so the request
 * shape a routing cell may declare is decided by the capability row and not by
 * a second list somebody keeps in sync.
 */
type ModelsWith<Flag extends keyof ModelProfile> = {
  [Id in ModelId]: (typeof MODEL_PROFILES)[Id][Flag] extends true ? Id : never;
}[ModelId];

/** A model that accepts `output_config.effort`. Anything else is a 400. */
export type EffortModel = ModelsWith<'supportsEffort'>;

/** A model that must be sent a flat request: no effort, no thinking block. */
export type FlatModel = Exclude<ModelId, EffortModel>;

export function profileFor(id: ModelId): ModelProfile {
  return MODEL_PROFILES[id];
}

/**
 * List price of one settled turn, in USD.
 *
 * Cached input is billed at the read rate and cache writes at the write rate,
 * so a session whose system half is stable costs far less than `inputTokens`
 * alone suggests. Getting that wrong would trip the dollar ceiling in §7 on a
 * child who was cheap, which surfaces as an ended session — the one failure
 * mode here that a learner can feel.
 */
export function priceUsd(profile: ModelProfile, usage: InferenceUsage): number {
  const perToken = (usdPerMTok: number, tokens: number): number => (usdPerMTok * tokens) / 1_000_000;
  return (
    perToken(profile.inputUsdPerMTok, usage.inputTokens) +
    perToken(profile.outputUsdPerMTok, usage.outputTokens) +
    perToken(profile.cacheReadUsdPerMTok, usage.cacheReadInputTokens) +
    perToken(profile.cacheWriteUsdPerMTok, usage.cacheCreationInputTokens)
  );
}

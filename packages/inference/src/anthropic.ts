// The Anthropic adapter — the one file in the repo that touches a model
// vendor's SDK (ADR-018 §1: Claude is the tutor brain).
//
// It is deliberately the dumbest file in the package: it takes an
// `InferenceRequest` that routing already resolved and turns it into wire
// params. It does not know what a learner is, does not take an identity, does
// not read the student model, and cannot decide which model runs.
//
// The wire params are built by reading the routed model's capability row rather
// than by branching on the model's name. That is the second of the two guards
// in `models.ts`: the routing table cannot DECLARE an effort for a model that
// rejects one, and this builder will not SEND one even if a request is
// hand-made. Haiku 4.5 400s on `output_config.effort` and does not do adaptive
// thinking, so on the classifier cell a flat request is not a cheaper request,
// it is the only request that works.
//
// The transport is a port so the egress assertion in the test suite can drive a
// real adapter with a fake socket and read exactly what went out. A test that
// mocked the adapter instead would be asserting on its own fixture.
// SOT: docs/design/inference-gateway.md §2.3 · docs/pack/18-tutor-ai-stack.md §1 §2 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: anthropic adapter claude sdk vendor egress stream params effort adaptive thinking cache control refusal
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaMessage,
  MessageCreateParamsNonStreaming as BetaMessageCreateParamsNonStreaming,
  MessageCreateParamsStreaming as BetaMessageCreateParamsStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages';
import { ModelDeclined, ProviderUnavailable } from './errors.ts';
import { isKnownModel, type RoutingCell } from './routing.ts';
import { profileFor } from './models.ts';
import { scrubOutbound } from './pseudonymize.ts';
import type {
  DeclineCategory,
  InferenceCompletion,
  InferenceOutcome,
  InferencePayload,
  InferenceRequest,
  InferenceStream,
  InferenceStop,
  InferenceUsage,
  ProviderAdapter,
} from './types.ts';

/**
 * `fallbacks: 'default'` routes a policy decline by category to the vendor's
 * own recommended substitute, rather than pinning a model this repo would then
 * owe a migration when it is deprecated. The beta flag is the one the scalar
 * form takes; the array form takes a different, earlier one, and pairing either
 * header with the other shape is a 400.
 */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** The vendor surface this adapter uses, and nothing wider. */
export interface AnthropicTransport {
  stream(params: BetaMessageCreateParamsStreaming, options?: { signal?: AbortSignal }): VendorStream;
  create(params: BetaMessageCreateParamsNonStreaming): Promise<VendorMessage>;
}

/** What the adapter reads off a streamed turn: text deltas, then the message. */
export interface VendorStream extends AsyncIterable<VendorStreamEvent> {
  finalMessage(): Promise<VendorMessage>;
}

/**
 * The five fields of a vendor message this adapter reads.
 *
 * Narrowed rather than the whole `BetaMessage`, and the reason is the egress
 * test: a fake transport has to CONSTRUCT one of these, and constructing a real
 * `BetaMessage` means filling in a container, a context-management response and
 * a parsed-output slot that this file never looks at. `BetaMessage` and
 * `Message` both satisfy it structurally, so nothing is loosened at the call
 * site — the real client still type-checks against the real return.
 */
export interface VendorMessage {
  readonly content: readonly { readonly type: string; readonly text?: string }[];
  readonly model: string;
  readonly stop_reason: BetaMessage['stop_reason'];
  readonly stop_details: { readonly category: string | null } | null;
  readonly usage: {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_read_input_tokens: number | null;
    readonly cache_creation_input_tokens: number | null;
  };
}

/**
 * Structurally the vendor's raw stream event, narrowed to the one shape this
 * file reads. Written as a union rather than imported wholesale because the
 * test transport has to construct these, and constructing a
 * `RawMessageStreamEvent` means constructing every field of a `Message` twice.
 */
export type VendorStreamEvent =
  | { readonly type: 'content_block_delta'; readonly delta: { readonly type: 'text_delta'; readonly text: string } }
  | { readonly type: string };

const isTextDelta = (
  event: VendorStreamEvent,
): event is { type: 'content_block_delta'; delta: { type: 'text_delta'; text: string } } =>
  event.type === 'content_block_delta' &&
  'delta' in event &&
  event.delta.type === 'text_delta';

/**
 * The wire params, assembled from the model's capability row.
 *
 * Exported because the egress assertion asserts on exactly this — the existing
 * test in `@acme/student-model` asserts the PREAMBLE is clean, and nothing
 * asserted what the adapter actually put on the socket.
 *
 * The payload is scrubbed again here even though `requestFor` already scrubbed
 * it on assembly. `scrubText` is idempotent, so the second pass costs a regex
 * sweep and buys the property that no code path reaches the socket unscrubbed,
 * including a hand-built request in a future caller.
 */
export function paramsFor(request: InferenceRequest): BetaMessageCreateParamsStreaming {
  if (!isKnownModel(request.modelId)) {
    // A model id that is not in the table has no capability row, so there is no
    // safe request shape to build for it. Failing here beats guessing the
    // frontier shape and 400ing in front of a child.
    throw new ProviderUnavailable(`No capability profile for model ${request.modelId}`);
  }

  const profile = profileFor(request.modelId);
  const payload = scrubOutbound(request.payload);

  return {
    model: profile.id,
    max_tokens: request.maxTokens,
    stream: true,
    // Capability, read rather than branched on. `supportsAdaptiveThinking:
    // false` omits the field ENTIRELY — `{ type: 'disabled' }` would be a
    // second thing to be wrong about on a model that has no thinking mode.
    ...(profile.supportsAdaptiveThinking ? { thinking: { type: 'adaptive' as const } } : {}),
    ...(profile.supportsEffort && request.effort ? { output_config: { effort: request.effort } } : {}),
    ...(request.serverSideFallback ? { fallbacks: 'default' as const, betas: [FALLBACK_BETA] } : {}),
    system: [
      {
        type: 'text' as const,
        text: payload.system,
        // Only when the prefix clears the model's own minimum. Below it the
        // vendor accepts the breakpoint and silently ignores it, which reads in
        // review as a caching strategy while being nothing at all.
        ...(request.cacheSystem ? { cache_control: { type: 'ephemeral' as const } } : {}),
      },
    ],
    messages: [{ role: 'user' as const, content: contentFor(payload) }],
  };
}

/**
 * The user turn: a bare string, or the photograph followed by the text.
 *
 * Image FIRST, which is the vendor's own guidance and not a style choice —
 * a model asked to read notation off a page answers better when the page
 * precedes the question about it.
 *
 * The text block is kept even when there is an image, because the text is not a
 * caption: it is the OCR reading plus whatever the child said, and the reading
 * is what the Safety Plane's input layers actually classified.
 */
function contentFor(payload: InferencePayload): BetaMessageCreateParamsStreaming['messages'][number]['content'] {
  if (!payload.image) return payload.message;
  return [
    {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: payload.image.mediaType,
        data: payload.image.data,
      },
    },
    { type: 'text' as const, text: payload.message },
  ];
}

/** The same params, for the one-shot classifier call. */
export function completionParamsFor(request: InferenceRequest): BetaMessageCreateParamsNonStreaming {
  const { stream: _stream, ...rest } = paramsFor(request);
  return { ...rest, stream: false };
}

const usageFrom = (message: VendorMessage): InferenceUsage => ({
  inputTokens: message.usage.input_tokens,
  outputTokens: message.usage.output_tokens,
  // Null means "no cache activity" rather than "unknown", so it collapses to
  // zero here instead of leaking a nullable into the budget's arithmetic.
  cacheReadInputTokens: message.usage.cache_read_input_tokens ?? 0,
  cacheCreationInputTokens: message.usage.cache_creation_input_tokens ?? 0,
});

const DECLINE_CATEGORIES: readonly DeclineCategory[] = [
  'cyber',
  'bio',
  'frontier_llm',
  'reasoning_extraction',
  'general_harms',
];

const declineCategoryFrom = (message: VendorMessage): DeclineCategory | null => {
  const category = message.stop_details?.category;
  if (!category) return null;
  return DECLINE_CATEGORIES.find((known) => known === category) ?? null;
};

/**
 * The terminal metadata.
 *
 * Three stop reasons are treated as the provider failing rather than answering.
 * `null` means the message never completed; `tool_use` means a tool ran on a
 * request that declared none; `compaction` means server-side context
 * compaction, which nothing here enables. All three are states this gateway
 * cannot produce, so all three are a broken transport rather than a turn to
 * render.
 */
function outcomeFrom(message: VendorMessage): InferenceOutcome {
  const stop = message.stop_reason;
  if (stop === null || stop === 'tool_use' || stop === 'compaction') {
    throw new ProviderUnavailable(`Provider returned an unusable stop reason: ${String(stop)}`);
  }
  return {
    stop: stop satisfies InferenceStop,
    usage: usageFrom(message),
    servedBy: message.model,
    declineCategory: declineCategoryFrom(message),
  };
}

const textOf = (message: VendorMessage): string =>
  message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');

/**
 * Wraps the real client. Constructed lazily so a process that never coaches
 * never requires a credential, and so the missing-credential throw stays where
 * it is today — a retryable misconfiguration, not a paused tutor.
 */
export function anthropicTransport(): AnthropicTransport {
  let client: Anthropic | undefined;

  const clientFor = (): Anthropic => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ProviderUnavailable('ANTHROPIC_API_KEY is not set');
    }
    client ??= new Anthropic();
    return client;
  };

  return {
    stream: (params, options) => clientFor().beta.messages.stream(params, options),
    create: (params) => clientFor().beta.messages.create(params),
  };
}

/**
 * `AnthropicAdapter` is the only `ProviderAdapter` for v1.
 *
 * `settled` always RESOLVES, including on a refusal, so the budget can debit a
 * turn whose tokens were spent. Turning a refusal into a thrown error is the
 * caller's decision and `gateway.ts` makes it, after the debit — a turn that
 * the vendor declined still cost money, and a budget that forgave declined
 * turns would be a budget a loop could run through for free.
 */
export function createAnthropicAdapter(transport: AnthropicTransport): ProviderAdapter {
  return {
    vendor: 'anthropic',

    stream(request: InferenceRequest): InferenceStream {
      const params = paramsFor(request);
      let settle: (outcome: InferenceOutcome) => void = () => undefined;
      let fail: (error: Error) => void = () => undefined;
      const settled = new Promise<InferenceOutcome>((resolve, reject) => {
        settle = resolve;
        fail = reject;
      });

      const text: AsyncIterable<string> = {
        async *[Symbol.asyncIterator]() {
          let vendor: VendorStream;
          try {
            vendor = transport.stream(params, request.signal ? { signal: request.signal } : undefined);
          } catch (error) {
            const wrapped =
              error instanceof ProviderUnavailable
                ? error
                : new ProviderUnavailable(
                    'Provider stream could not be opened',
                    error instanceof Error ? error : undefined,
                  );
            fail(wrapped);
            throw wrapped;
          }

          try {
            for await (const event of vendor) {
              if (isTextDelta(event)) yield event.delta.text;
            }
            settle(outcomeFrom(await vendor.finalMessage()));
          } catch (error) {
            const wrapped =
              error instanceof ProviderUnavailable
                ? error
                : new ProviderUnavailable(
                    'Provider stream ended abnormally',
                    error instanceof Error ? error : undefined,
                  );
            fail(wrapped);
            throw wrapped;
          }
        },
      };

      /*
        The gateway awaits `settled` for the debit and the caller awaits it for
        the stop reason, so it always has a consumer. It is still parked here
        because a caller that abandons the iterable mid-turn — the child
        navigated away — leaves it pending forever, and an unhandled rejection
        on a torn-down stream would take the process with it.
      */
      void settled.catch(() => undefined);

      return { text, settled };
    },

    async complete(request: InferenceRequest): Promise<InferenceCompletion> {
      let message: VendorMessage;
      try {
        message = await transport.create(completionParamsFor(request));
      } catch (error) {
        if (error instanceof ProviderUnavailable) throw error;
        throw new ProviderUnavailable(
          'Provider completion failed',
          error instanceof Error ? error : undefined,
        );
      }

      const outcome = outcomeFrom(message);
      if (outcome.stop === 'refusal') {
        throw new ModelDeclined(outcome.servedBy, outcome.declineCategory);
      }
      return { text: textOf(message), outcome };
    },
  };
}

/** Convenience for the app: the real adapter over the real client. */
export function anthropicAdapter(): ProviderAdapter {
  return createAnthropicAdapter(anthropicTransport());
}

/** Named for the spec's §2.2 vocabulary; the factory is the constructor. */
export type AnthropicAdapter = ProviderAdapter;

/** Re-exported so a caller can read a cell without importing two modules. */
export type { RoutingCell };

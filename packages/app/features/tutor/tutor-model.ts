// The Claude adapter — the gateway's raw streaming model call (doc 18 §2).
//
// This is the ONLY file in the codebase that imports a model vendor's SDK, and
// it is deliberately the dumbest one: it takes an already-assembled prompt and
// yields text. It does not know what a learner is, does not take an identity,
// does not read the student model, and cannot be called as a tutor turn — the
// only export is a `ModelStreamCall`, and the only thing that accepts one is
// `withLearnerBriefStream`, which returns a `StreamingGenerator`, which only
// `runSafetyPlaneStream` accepts. The Safety Plane is not a convention here;
// it is the only path the types allow.
//
// Claude is the tutor brain per ADR-018 §1. Keeping the vendor surface to one
// file is what makes the per-cell routing table in doc 18 §2 a later change
// rather than a rewrite.
// SOT: docs/pack/18-tutor-ai-stack.md §1 §2 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: tutor model claude anthropic stream gateway model call adapter vendor
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { ModelStreamCall } from '@acme/student-model';

/**
 * ADR-018 §1: Claude is the tutor brain, frontier tier for the coaching turn.
 * Pinned rather than read from the environment — which model teaches a child is
 * a decision that belongs in a reviewed commit, not in a deploy variable.
 */
const TUTOR_MODEL = 'claude-opus-5';

/**
 * A coaching turn is one question and a sentence or two of scaffolding. The cap
 * is a guard against a runaway generation, not a length target; the contract's
 * "one question at a time" is what actually keeps turns short.
 */
const MAX_TOKENS = 1024;

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }
  client ??= new Anthropic();
  return client;
}

/**
 * Streams a coaching turn from Claude.
 *
 * `effort: 'low'` with adaptive thinking is the setting a coaching turn wants:
 * the reasoning is shallow (one pedagogical move on a problem the brief already
 * frames) and the latency is in front of a child waiting for a reply. The
 * system half of the prompt carries a cache breakpoint because the contract and
 * the brief repeat unchanged across every turn of a session.
 */
export const streamTutorTurn: ModelStreamCall = ({ system, message }) => ({
  async *[Symbol.asyncIterator]() {
    const stream = anthropic().messages.stream({
      model: TUTOR_MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: message }],
    });

    for await (const event of stream) {
      if (event.type !== 'content_block_delta') continue;
      if (event.delta.type !== 'text_delta') continue;
      yield event.delta.text;
    }

    // A safety refusal is not a tutor turn. Ending the stream silently would
    // render as Natalie trailing off mid-thought, so it fails loudly and the
    // service turns it into the plane's paused state.
    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      throw new Error('Model declined the turn');
    }
  },
});

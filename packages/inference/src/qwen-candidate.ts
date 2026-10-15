// Evaluation-only Qwen candidate. This is not a learner provider or an active fallback.
// All transmitted prompts are checked-in synthetic fixtures; there is no caller-supplied text.
// Which model may teach a child remains a reviewed, server-owned decision.
import 'server-only';
import { scrubOutbound } from './pseudonymize.ts';

export const QWEN_CANDIDATE = {
  vendor: 'alibaba-model-studio',
  model: 'qwen3.8-max',
  endpoint: 'https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions',
  rollout: 'synthetic-evaluation-only',
} as const;

const SYNTHETIC_FIXTURES = {
  'math-guided-fractions': {
    system: 'You tutor a fictitious grade-five student. Ask one helpful question. Never reveal the answer.',
    message: 'I need help with 1/2 + 1/4. How should I start?',
  },
  'spanish-past-tense': {
    system: 'You tutor a fictitious novice Spanish student. Correct gently and ask one question.',
    message: 'My Spanish sentence is Yo fue al parque. Help me understand the verb.',
  },
  'science-food-chain': {
    system: 'You tutor a fictitious middle-school science student. Ask one guiding question.',
    message: 'What happens to grass if the rabbits disappear from a grass-rabbit-fox food chain?',
  },
} as const;

export type QwenFixtureId = keyof typeof SYNTHETIC_FIXTURES;

export interface QwenEvaluationResult {
  readonly fixtureId: QwenFixtureId;
  readonly modelRequested: typeof QWEN_CANDIDATE.model;
  readonly modelServed: string;
  readonly text: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export type QwenEvalTransport = (url: string, init: RequestInit) => Promise<Response>;

function tokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

/**
 * Executes a synthetic benchmark case only. There is intentionally no arbitrary
 * prompt argument, child identity, photo, transcript, or automatic retry.
 * Do not route this through a learner surface or the ordinary InferenceGateway.
 */
export async function runSyntheticQwenEvaluation(
  fixtureId: QwenFixtureId,
  options: { readonly apiKey: string; readonly transport?: QwenEvalTransport; readonly signal?: AbortSignal },
): Promise<QwenEvaluationResult> {
  if (!Object.hasOwn(SYNTHETIC_FIXTURES, fixtureId)) throw new Error('Unknown synthetic Qwen evaluation fixture');
  if (!options.apiKey.trim()) throw new Error('Qwen evaluation credentials not configured');
  const fixture = SYNTHETIC_FIXTURES[fixtureId];
  const payload = scrubOutbound({ system: fixture.system, message: fixture.message });
  const transport = options.transport ?? fetch;
  const response = await transport(QWEN_CANDIDATE.endpoint, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + options.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: QWEN_CANDIDATE.model,
      max_tokens: 384,
      stream: false,
      messages: [
        { role: 'system', content: payload.system },
        { role: 'user', content: payload.message },
      ],
    }),
    signal: options.signal,
  });
  if (!response.ok) throw new Error('Qwen synthetic evaluation unavailable (' + response.status + ')');

  const data: unknown = await response.json();
  if (!data || typeof data !== 'object') throw new Error('Invalid Qwen completion');
  const completion = data as {
    model?: unknown;
    choices?: { message?: { content?: unknown } }[];
    usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
  };
  const text = completion.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.trim().length === 0) throw new Error('Empty Qwen completion');
  return {
    fixtureId,
    modelRequested: QWEN_CANDIDATE.model,
    modelServed: typeof completion.model === 'string' ? completion.model : 'unreported',
    text: text.trim(),
    inputTokens: tokenCount(completion.usage?.prompt_tokens),
    outputTokens: tokenCount(completion.usage?.completion_tokens),
  };
}

'use client';
// The on-device tutor — ExecuTorch `LLMModule` running Qwen3-0.6B quantized,
// the smallest model in the registry that can still follow a marking rubric.
//
// WHY LOCAL FIRST. A wrong answer used to land on "your tutor will look at
// this with you" for every `coach-review` question and on a dead error screen
// whenever the headset could not reach `/api/tutor/evaluate`. The child is in
// a headset, often offline-adjacent; the first grader that answers should be
// the one already on the device. `null` is the honest "I could not decide" —
// callers escalate to the server or to tutor review, so difficulty, not
// availability, decides who grades.
//
// THE SAME FLOOR AS THE SERVER. Every generated string is screened through
// `coach-safety-patterns` — the doc 07 §3 layer-3 patterns the server's coach
// classifier applies — before it can reach a panel. A model that trips the
// floor is withheld, not retried.
//
// ONE INSTANCE, LAZILY. `fromModelName` downloads weights through the
// registered `ExpoResourceFetcher` (see `apps/mobile/src/executorch.ts`) and
// loads them once per process; a per-request load would make every hint wait
// on ~600 MB of cold mmap. A call that races the first download simply waits
// on the same promise — the panel shows "thinking" meanwhile.
//
// SOT: xr-question-evaluator.ts · coach-safety-patterns.ts ·
//      docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: xr local tutor on-device llm executorch qwen grade answer hint generate escalation

import { LLMModule, QWEN3_0_6B_QUANTIZED } from 'react-native-executorch';
import type { XrLearningQuestion, XrQuestionOutcome } from '@acme/ui/xr';
import { coachOutputSafe } from './coach-safety-patterns.ts';

export interface XrLocalVerdict {
  readonly outcome: Extract<XrQuestionOutcome, 'correct' | 'incorrect'>;
  readonly body: string;
}

/* Generations that outlive the child's patience are a "could not decide":
   the flow escalates instead of hanging a panel on a busy NPU. */
const GENERATE_TIMEOUT_MS = 30_000;

let llmPromise: Promise<LLMModule> | null = null;

function localLlm(): Promise<LLMModule> {
  llmPromise ??= LLMModule.fromModelName(QWEN3_0_6B_QUANTIZED);
  return llmPromise;
}

/** The question reduced to what a text-only marker can see. */
function questionText(question: XrLearningQuestion): string {
  const choices =
    question.choices?.map((c, i) => `  ${i + 1}. ${c.label}`).join('\n') ?? '';
  return [
    `Question: ${question.prompt}`,
    question.supportingText ? `Context: ${question.supportingText}` : '',
    choices ? `Choices:\n${choices}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function ask(messages: { role: 'system' | 'user'; content: string }[]): Promise<string | null> {
  try {
    const llm = await localLlm();
    const reply = await Promise.race([
      llm.generate(messages),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), GENERATE_TIMEOUT_MS)),
    ]);
    if (reply === null) return null;
    /* The safety floor is the last thing text crosses, not the first — a
       prompt-shaped model can still produce a screened pattern. */
    return coachOutputSafe(reply) ? reply : null;
  } catch {
    return null;
  }
}

/**
 * Mark one answer against the question. Returns `null` whenever the model is
 * unavailable, unsure, times out, or trips the safety floor — `null` is the
 * escalation signal, never a wrong verdict.
 */
export async function xrLocalGrade(
  question: XrLearningQuestion,
  answerText: string,
): Promise<XrLocalVerdict | null> {
  const reply = await ask([
    {
      role: 'system',
      content:
        'You are a teacher marking a child\'s schoolwork. Reply with exactly one word — ' +
        'CORRECT, INCORRECT, or UNSURE — then a dash and one short, kind sentence for the child. ' +
        'Use UNSURE when the question cannot be marked from text alone (drawings, multi-step working, ' +
        'ambiguous wording). Never explain your reasoning.',
    },
    { role: 'user', content: `${questionText(question)}\n\nThe child's answer: ${answerText}` },
  ]);
  if (!reply) return null;
  const match = /^\s*(CORRECT|INCORRECT)\b[\s\-–—:]*(.*)$/is.exec(reply);
  if (!match) return null;
  const body = (match[2] ?? '').replace(/\s+/g, ' ').trim();
  return {
    outcome: match[1]!.toUpperCase() === 'CORRECT' ? 'correct' : 'incorrect',
    body: body || (match[1]!.toUpperCase() === 'CORRECT' ? 'That is right — well done.' : 'Not quite — have another look.'),
  };
}

/**
 * One hint, never the answer. `null` means the panel shows its authored
 * fallback or an honest "no hint" — a generated wrong-direction hint is worse
 * than none.
 */
export async function xrLocalHint(question: XrLearningQuestion): Promise<string | null> {
  const reply = await ask([
    {
      role: 'system',
      content:
        'You are a patient tutor. Give ONE short hint that helps a child start this problem — ' +
        'one or two sentences, never the answer, never the final number.',
    },
    { role: 'user', content: questionText(question) },
  ]);
  return reply?.trim() || null;
}

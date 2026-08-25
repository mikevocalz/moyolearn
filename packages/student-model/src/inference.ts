// Retrieval into inference: how the brief actually reaches the model.
//
// Doc 07 §4 Loop A calls this the RAG pattern, and its point is not retrieval
// quality — it is that the child's record stays in a store the family controls
// and enters the model as CONTEXT, never as weights. So this file is a decorator
// over a raw model call that produces a `Generator` for `@acme/safety`: the only
// way learner context reaches a model is by handing this Generator to
// `runSafetyPlane`, which means the plane's layers are already around it.
//
// The retrieval key is `context.learnerId` from the plane's `IdentityContext`,
// which doc 07 §3 layer 1 requires be server-injected. Nothing here accepts a
// learner id from a caller, so there is no argument to get wrong — the CLAUDE.md
// rule ("identity is never a parameter, never from an AI tool argument") is a
// property of the signature rather than a thing to remember.
//
// The preamble is assembled here rather than in a prompt template because a
// template is a file someone edits at 2am to "just add the child's name for
// warmth". Everything that reaches the model is a field of `LearnerBrief`, and
// `LearnerBrief` has no field for a name.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3 §4 · docs/pack/19-learning-outcomes-spec.md §1
// SOT-KEYWORDS: inference retrieval rag brief generator gateway prompt pseudonymous context

import type { Generator, IdentityContext } from '@acme/safety';
import type { LearnerBrief } from './brief.ts';

/** The raw model call the gateway owns. It never sees an identity. */
export type ModelCall = (prompt: string) => Promise<string>;

/** Retrieval, keyed on the plane's server-injected identity. */
export type BriefLookup = (context: IdentityContext) => Promise<LearnerBrief>;

const VOICE = {
  young: 'Speak plainly and warmly, short sentences, one idea at a time.',
  older: 'Speak directly and without baby talk; assume she can follow two steps.',
} as const;

/**
 * The brief as prompt text. Exported because the red-team and the eval harness
 * assert on exactly what reaches the model, and a private function would leave
 * them asserting on a mock of it.
 */
export function briefPreamble(brief: LearnerBrief): string {
  const lines = [
    'You are tutoring one student. Everything below is what the system has learned about her from her own work; none of it is her identity.',
    VOICE[brief.gradeBand],
  ];

  if (brief.frontier.length > 0) {
    lines.push(`Working on: ${brief.frontier.map((f) => f.sentence).join(' · ')}`);
  }
  for (const misconception of brief.misconceptions) {
    // Strategy travels WITH the misconception. A tutor told what a child gets
    // wrong and not what to do about it will correct the answer, which doc 19
    // §1 is explicit is the wrong move — the model is what needs correcting.
    lines.push(`Watch for: ${misconception.sentence}. Approach: ${misconception.strategy}`);
  }
  if (brief.reviewDue.length > 0) {
    lines.push(
      `Due for a refresher: ${brief.reviewDue.join(', ')}. Weave it into the work; never frame it as going back.`,
    );
  }
  if (brief.interests.length > 0) {
    lines.push(`Examples that land: ${brief.interests.join(', ')}.`);
  }
  lines.push(
    brief.scaffoldDepth >= 2
      ? 'Offer a hint sooner than you would by default; she uses them well.'
      : 'Hold hints back a beat; she gets there with room.',
  );

  return lines.join('\n');
}

/**
 * Wraps a model call into the plane's `Generator`. Hand the result to
 * `runSafetyPlane` — it is not callable as a tutor turn any other way.
 */
export function withLearnerBrief(model: ModelCall, lookup: BriefLookup): Generator {
  return {
    generate: async (text, context) => {
      const brief = await lookup(context);
      return model(`${briefPreamble(brief)}\n\nStudent: ${text}`);
    },
  };
}

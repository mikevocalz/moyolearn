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
// SOT-KEYWORDS: inference retrieval rag brief generator gateway prompt pseudonymous context stream contract

import type { Generator, IdentityContext, StreamingGenerator } from '@acme/safety';
import type { LearnerBrief } from './brief.ts';
import { BAND_EXAMPLES, BAND_FRAMES, type VoiceBand } from './voice-band.ts';

/** The raw model call the gateway owns. It never sees an identity. */
export type ModelCall = (prompt: string) => Promise<string>;

/** Retrieval, keyed on the plane's server-injected identity. */
export type BriefLookup = (context: IdentityContext) => Promise<LearnerBrief>;

/**
 * The graded few-shots for a band, rendered with the speaker labels.
 *
 * Rendering lives here rather than beside the examples because the labels live
 * here, and the labels are the whole reason these exchanges do not match doc
 * 26b character for character — see `BAND_EXAMPLES` for the full account. In
 * short: doc 26b writes `Student:`, the gateway's header rule eats everything
 * after it, and a few-shot whose learner turn is `[redacted]` teaches the model
 * to reply to nothing.
 *
 * Last in the system prompt on purpose. Doc 31 §2.3's point is that few-shots
 * move reading level more reliably than instructions do, and an exemplar sitting
 * immediately above the child's turn is the one the model is still holding.
 */
export function bandExamplesBlock(band: VoiceBand): string {
  const header =
    'Here is what a reply at this level sounds like. Match the length and the moves, never the wording:';
  const exchanges = BAND_EXAMPLES[band].map(
    (example) =>
      `${LEARNER_TURN_LABEL} ${example.learner}\n${COACH_TURN_LABEL} ${example.tutor}`,
  );
  return [header, ...exchanges].join('\n\n');
}

/**
 * The brief as prompt text. Exported because the red-team and the eval harness
 * assert on exactly what reaches the model, and a private function would leave
 * them asserting on a mock of it.
 */
export function briefPreamble(brief: LearnerBrief): string {
  const lines = [
    'You are tutoring one student. Everything below is what the system has learned about her from her own work; none of it is her identity.',
    /*
      Doc 31 §2.2's frame, whole. It used to be a single line per band — "speak
      plainly and warmly" — which is exactly the "keep it simple" prompt doc 31
      §1 measured and found wanting: models drift back upward within a
      conversation and stereotype rather than simplify. The frames name numbers
      because naming the target is the intervention that works.
    */
    BAND_FRAMES[brief.voiceBand],
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

  // Doc 31 §2.3's layer 2, and the last thing the model reads before the turn.
  lines.push('', bandExamplesBlock(brief.voiceBand));

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
      return model(`${briefPreamble(brief)}\n\n${LEARNER_TURN_LABEL} ${text}`);
    },
  };
}

/**
 * The streaming counterpart. It takes the prompt in two pieces rather than one
 * concatenated string because the pedagogy contract and the brief are stable
 * across a session while the student's turn is not — splitting them is what
 * lets a provider cache the expensive half, and it keeps the contract in the
 * system position where a provider weights it as policy rather than as
 * something the student said.
 */
export interface TutorPrompt {
  /** Pedagogy contract + brief preamble. Stable within a session. */
  system: string;
  /** The student's turn. */
  message: string;
}

/** The raw streaming model call the gateway owns. It never sees an identity. */
export type ModelStreamCall = (prompt: TutorPrompt) => AsyncIterable<string>;

/**
 * Wraps a streaming model call into the plane's `StreamingGenerator`.
 *
 * `contract` is a parameter rather than a constant in this file because the
 * pedagogy contract is owned by the tutor application layer (doc 18 §5) and
 * this package holds only what the system learned about the child. Passing it
 * in keeps the dependency pointing the right way and keeps the contract in one
 * place instead of two.
 */
export function withLearnerBriefStream(
  model: ModelStreamCall,
  lookup: BriefLookup,
  contract: string,
): StreamingGenerator {
  return {
    generateStream: (text, context) => ({
      async *[Symbol.asyncIterator]() {
        const brief = await lookup(context);
        yield* model({ system: `${contract}\n\n${briefPreamble(brief)}`, message: text });
      },
    }),
  };
}

/**
 * How a learner's words are introduced to the model.
 *
 * NOT `Student:`, and the reason is not style. The Inference Gateway's
 * pseudonymizer redacts OCR'd worksheet headers — `Name: Ada Lovelace`,
 * `Student: Ada` — by matching a label and consuming the rest of the line. The
 * prompt used `Student:` as its speaker label, so the rule matched the scaffold
 * the system had just written and redacted the CHILD'S ENTIRE ANSWER on every
 * single turn.
 *
 * It failed silently and expensively: the request succeeded, the reply streamed,
 * the turn persisted, and the model — handed `Student: [redacted]` — answered
 * "I can't see what you wrote, it came through blank." Nothing in the stack was
 * broken except the meaning.
 *
 * The label must therefore avoid every word that rule matches: name, student,
 * pupil, learner, child, teacher, parent, guardian, class, school, dob.
 * `LEARNER_TURN_LABEL` is a constant so there is one place to keep that true,
 * and `inference.test.ts` asserts the assembled prompt survives the scrubber
 * with the answer intact.
 */
export const LEARNER_TURN_LABEL = 'Their answer:';

/**
 * How the tutor's own words are introduced, in the graded few-shots.
 *
 * `Tutor:` is safe — "tutor" is not on the gateway's header-rule list, and
 * "teacher" (which is) is exactly the word a careless edit would reach for
 * instead. It is a constant rather than a literal for that reason: the pairing
 * with `LEARNER_TURN_LABEL` is what the scrubber test scans, and a label that
 * only existed inline would not be scanned at all.
 */
export const COACH_TURN_LABEL = 'Tutor:';

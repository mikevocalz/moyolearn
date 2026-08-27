// The Safety Plane (doc 07 §3): every learner inference call passes through it,
// none of it is skippable, and all of it is server-side.
//
// The layers that need a model — input and output classification — are PORTS,
// so this file holds the thing a model cannot be trusted with: the order, and
// what happens on each verdict. A classifier that returns `crisis` cannot be
// argued out of ending the session, because ending it is not the classifier's
// decision.
//
// The identity context is a REQUIRED argument rather than an optional one. Doc
// 07 §3 layer 1 says the server injects grade band and minor flag and "the
// client never supplies age context" — an optional field is a field a caller
// forgets, and a forgotten minor flag is an adult policy applied to a child.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: safety plane layers classify route crisis firewall inference learner server stream sentence window

import { crisisResponse, isPedagogicallyStorable, type CrisisResponse } from './crisis.ts';
import { screen, type FirewallRuleId } from './firewall.ts';
import { safetyLayer, safetyLayerSync } from './unavailable.ts';

/** Doc 07 §3 layer 3's five classes. Routing, not censorship. */
export type InputClass = 'safe' | 'off-task' | 'sensitive' | 'crisis' | 'prohibited';

export interface IdentityContext {
  learnerId: string;
  /** Drives the policy prompt and the crisis register. Never client-supplied. */
  gradeBand: 'young' | 'older';
  isMinor: boolean;
  /** Guardian policy from `learnerFlags` — AI on/off, viewers, windows. */
  aiEnabled: boolean;
}

export interface Classifier {
  classifyInput: (text: string, context: IdentityContext) => Promise<InputClass>;
  /** The generated turn. Returns the classes it triggers, empty when clean. */
  classifyOutput: (text: string, context: IdentityContext) => Promise<InputClass[]>;
}

export interface Generator {
  generate: (text: string, context: IdentityContext) => Promise<string>;
}

export type PlaneOutcome =
  | { kind: 'reply'; text: string; storeInStudentModel: boolean }
  /** Sensitive: cared for, handed to a human, never therapised. */
  | { kind: 'redirect'; text: string; storeInStudentModel: false }
  | { kind: 'crisis'; response: CrisisResponse; storeInStudentModel: false }
  | { kind: 'blocked'; broke: FirewallRuleId[]; storeInStudentModel: false }
  | { kind: 'refused'; reason: string; storeInStudentModel: false };

export interface PlaneLog {
  layer: string;
  detail?: string;
}

export interface PlaneResult {
  outcome: PlaneOutcome;
  /** What ran, in order. The duty-of-care paper trail doc 07 §3 layer 8 wants. */
  trace: PlaneLog[];
}

/**
 * Doc 07 §3 layer 3: `sensitive` gets "a caring acknowledgment + gentle handoff
 * to trusted adults, never therapy". This is that handoff, and it is a fixed
 * string rather than a generation because the one thing a model must not do
 * with a child's disclosure about bullying or family stress is improvise.
 */
const SENSITIVE_HANDOFF =
  'That sounds like a lot to carry, and I’m glad you said it. I’m a tutor, so the person who can really help with this is someone you trust — a parent, a teacher, or your tutor. Want to keep going on the work for now?';

/** Doc 07 §2.2: bids for connection are warmly redirected to the work and to humans. */
const OFF_TASK_REDIRECT =
  'That’s not really my thing — I’m here for the schoolwork. Want to pick up where we left off?';

/**
 * Runs the plane. The order below IS layers 1–7 of doc 07 §3; the numbering in
 * the trace is so a reviewer reading a log can see which layer stopped a turn.
 */
export async function runSafetyPlane(
  message: string,
  context: IdentityContext,
  deps: { classifier: Classifier; generator: Generator },
): Promise<PlaneResult> {
  // Layers 1–4 live in `screenInput`, shared with the streaming path below so
  // the two cannot drift apart. Everything from here down is layer 5 onward.
  const gate = await screenInput(message, context, deps.classifier);
  if (!gate.passed) return gate.result;

  const { inputClass, trace } = gate;

  // NOT a `safetyLayer` call, and that is the whole of doc 12 §5's split: every
  // layer above and below fails closed to a paused tutor, while the model
  // failing is availability and stays retryable. Wrapping this line would turn
  // a missing API key into "Natalie is taking a break".
  const draft = await deps.generator.generate(message, context);

  // Layer 5 — the generated text is screened before it is rendered, by the
  // deterministic firewall AND the output classifier. Both, because they fail
  // differently: one cannot be talked out of a rule, the other catches what no
  // pattern anticipated.
  const outbound = safetyLayerSync('5-output', () => screen(draft, 'tutor'));
  if (!outbound.allowed) {
    trace.push({ layer: '5-output', detail: outbound.broke.join(',') });
    return { outcome: { kind: 'blocked', broke: outbound.broke, storeInStudentModel: false }, trace };
  }

  const outputClasses = await safetyLayer('5-output', () =>
    deps.classifier.classifyOutput(draft, context),
  );
  trace.push({ layer: '5-output', detail: outputClasses.join(',') || 'clean' });

  if (outputClasses.includes('crisis')) {
    return {
      outcome: {
        kind: 'crisis',
        response: crisisResponse(context.gradeBand),
        storeInStudentModel: false,
      },
      trace: [...trace, { layer: '6-crisis' }],
    };
  }

  if (outputClasses.some((c) => c === 'prohibited' || c === 'sensitive')) {
    return { outcome: { kind: 'blocked', broke: [], storeInStudentModel: false }, trace };
  }

  // Layer 7 — memory hygiene. Only a clean, on-task exchange is pedagogy.
  return {
    outcome: {
      kind: 'reply',
      text: draft,
      storeInStudentModel: isPedagogicallyStorable(inputClass),
    },
    trace: [...trace, { layer: '7-memory', detail: 'storable' }],
  };
}

/**
 * The streaming half of the plane (doc 18 §2's "sentence-window screening").
 *
 * Layer 5 says generated text is screened BEFORE it is rendered, which reads as
 * a prohibition on streaming: you cannot screen a draft you have not finished.
 * The resolution is the window — the plane emits only whole sentences, and a
 * sentence is emitted only after `screen()` has passed it. Time-to-first-token
 * becomes time-to-first-SENTENCE, which is the price of layer 5 and is worth it.
 *
 * The deterministic firewall runs per sentence; the output CLASSIFIER cannot,
 * because it needs the whole turn to judge it. So it runs once at end-of-stream
 * and a failure arrives as a terminal `blocked` outcome — the client's contract
 * is that a blocked outcome retracts everything already rendered. That is a real
 * gap for the seconds the text is on screen, and it is why the sentence window
 * (not the classifier) carries the hard rules.
 */
export interface StreamingGenerator {
  generateStream: (text: string, context: IdentityContext) => AsyncIterable<string>;
}

/** What a consumer of the streaming plane sees, in order. Exactly one `done`. */
export type PlaneStreamEvent =
  | { kind: 'chunk'; text: string }
  | { kind: 'done'; outcome: PlaneOutcome; trace: PlaneLog[] };

/**
 * Layers 1–4, which are identical for the buffered and streaming paths. Split
 * out so the two paths cannot drift: a layer added to one is added to both.
 */
async function screenInput(
  message: string,
  context: IdentityContext,
  classifier: Classifier,
): Promise<{ passed: true; inputClass: InputClass; trace: PlaneLog[] } | { passed: false; result: PlaneResult }> {
  const trace: PlaneLog[] = [{ layer: '1-identity', detail: context.gradeBand }];

  if (!context.aiEnabled) {
    return {
      passed: false,
      result: {
        outcome: {
          kind: 'refused',
          reason: 'AI tutoring is turned off for this learner.',
          storeInStudentModel: false,
        },
        trace: [...trace, { layer: '1-identity', detail: 'ai-disabled' }],
      },
    };
  }

  /*
    THE INBOUND FIREWALL RUNS HERE, and its verdict is held rather than
    returned.

    It used to sit at the bottom of this function, after every routing branch
    had already returned — which made it reachable ONLY on a turn the
    classifier had called `safe`, i.e. only on turns with nothing wrong with
    them. Doc 07 §2.3 makes the secrecy rule two-directional precisely because
    a child asking to keep a secret may have been taught to, and that child's
    message reads as off-task to a classifier: it was filed as a fence test
    (S1 — no incident, nobody told) instead of the logged safety event the
    rule names. `screen(input, 'learner')` was tested in isolation and passed,
    which is why the corpus never went red.

    The branches below are ordered by SERIOUSNESS, the way `classifyCoachInput`
    and `categoryFor` already order theirs — not by layer number:

      · `crisis` outranks it. A child who discloses harm and asks in the same
        breath that nobody be told is a child in crisis first; they get the
        resources, and the firewall's finding still rides the trace.
      · `sensitive` outranks it too, and files the same S3. Doc 07 §3 layer 3
        prescribes "a caring acknowledgment + gentle handoff to trusted
        adults" for bullying and family stress, and a bare block is a worse
        answer to the same disclosure — the guardian is told either way.
      · `prohibited` and `off-task` do NOT. Both are strictly less informative
        endings for a turn that broke a named rule, and `off-task` is the gap
        this ordering exists to close.
  */
  const inbound = safetyLayerSync('2-firewall', () => screen(message, 'learner'));
  const firewallLog: PlaneLog[] = inbound.allowed
    ? []
    : [{ layer: '2-firewall', detail: inbound.broke.join(',') }];

  const inputClass = await safetyLayer('3-input', () => classifier.classifyInput(message, context));
  trace.push({ layer: '3-input', detail: inputClass });

  if (inputClass === 'crisis') {
    return {
      passed: false,
      result: {
        outcome: {
          kind: 'crisis',
          response: crisisResponse(context.gradeBand),
          storeInStudentModel: false,
        },
        trace: [...trace, ...firewallLog, { layer: '6-crisis' }],
      },
    };
  }

  if (inputClass === 'sensitive') {
    return {
      passed: false,
      result: {
        outcome: { kind: 'redirect', text: SENSITIVE_HANDOFF, storeInStudentModel: false },
        trace: [...trace, ...firewallLog, { layer: '3-input', detail: 'sensitive-handoff' }],
      },
    };
  }

  if (!inbound.allowed) {
    return {
      passed: false,
      result: {
        outcome: { kind: 'blocked', broke: inbound.broke, storeInStudentModel: false },
        trace: [...trace, ...firewallLog],
      },
    };
  }

  if (inputClass === 'prohibited') {
    return {
      passed: false,
      result: {
        outcome: { kind: 'blocked', broke: [], storeInStudentModel: false },
        trace: [...trace, { layer: '3-input', detail: 'prohibited' }],
      },
    };
  }

  if (inputClass === 'off-task') {
    return {
      passed: false,
      result: {
        outcome: { kind: 'redirect', text: OFF_TASK_REDIRECT, storeInStudentModel: false },
        trace: [...trace, { layer: '4-fence', detail: 'redirect' }],
      },
    };
  }

  return { passed: true, inputClass, trace };
}

/**
 * Splits off the part of `buffer` that is safe to screen and emit.
 *
 * A window closes on sentence-ending punctuation followed by whitespace, or on
 * a newline. The digit guard exists because this tutor teaches arithmetic: in
 * "divide 7.5 by 3" the period is a decimal point, and a splitter that treats
 * it as a boundary emits "divide 7." on its own — which reads to a child as a
 * finished, wrong instruction.
 */
export function takeSentences(buffer: string): { emit: string; rest: string } {
  let cut = -1;

  for (let i = 0; i < buffer.length; i += 1) {
    const char = buffer[i];

    if (char === '\n') {
      cut = i + 1;
      continue;
    }

    if (char !== '.' && char !== '!' && char !== '?') continue;
    if (char === '.' && /\d/.test(buffer[i - 1] ?? '') && /\d/.test(buffer[i + 1] ?? '')) continue;

    let end = i + 1;
    while (end < buffer.length && `"')]`.includes(buffer[end] ?? '')) end += 1;

    // A boundary is only a boundary once the NEXT character has arrived; at the
    // end of the buffer we cannot yet tell "7." (decimal, more coming) from
    // "Try it." (finished), so leave it for the next chunk or the final flush.
    if (end >= buffer.length || !/\s/.test(buffer[end] ?? '')) continue;

    // The separating whitespace travels with the sentence it closes, so the
    // emitted chunks concatenate back to exactly what the model produced.
    while (end < buffer.length && /\s/.test(buffer[end] ?? '')) end += 1;
    cut = end;
  }

  if (cut < 0) return { emit: '', rest: buffer };
  return { emit: buffer.slice(0, cut), rest: buffer.slice(cut) };
}

/**
 * Runs the plane over a streaming generator. Same layer order as
 * `runSafetyPlane`; the difference is only WHEN layer 5 gets to run.
 */
export async function* runSafetyPlaneStream(
  message: string,
  context: IdentityContext,
  deps: { classifier: Classifier; generator: StreamingGenerator },
): AsyncGenerator<PlaneStreamEvent> {
  const gate = await screenInput(message, context, deps.classifier);
  if (!gate.passed) {
    yield { kind: 'done', outcome: gate.result.outcome, trace: gate.result.trace };
    return;
  }

  const trace = gate.trace;
  let buffer = '';
  let draft = '';

  // Unwrapped for the same reason as `generate` above: the model is not a layer.
  for await (const chunk of deps.generator.generateStream(message, context)) {
    buffer += chunk;
    const { emit, rest } = takeSentences(buffer);
    buffer = rest;
    if (!emit) continue;

    const verdict = safetyLayerSync('5-output', () => screen(emit, 'tutor'));
    if (!verdict.allowed) {
      trace.push({ layer: '5-output', detail: verdict.broke.join(',') });
      yield { kind: 'done', outcome: { kind: 'blocked', broke: verdict.broke, storeInStudentModel: false }, trace };
      return;
    }

    draft += emit;
    yield { kind: 'chunk', text: emit };
  }

  if (buffer) {
    const verdict = safetyLayerSync('5-output', () => screen(buffer, 'tutor'));
    if (!verdict.allowed) {
      trace.push({ layer: '5-output', detail: verdict.broke.join(',') });
      yield { kind: 'done', outcome: { kind: 'blocked', broke: verdict.broke, storeInStudentModel: false }, trace };
      return;
    }
    draft += buffer;
    yield { kind: 'chunk', text: buffer };
  }

  // Whole-draft screen: the per-sentence pass cannot see a banned construction
  // that straddles a boundary, so the assembled turn is screened once more.
  const whole = safetyLayerSync('5-output', () => screen(draft, 'tutor'));
  if (!whole.allowed) {
    trace.push({ layer: '5-output', detail: whole.broke.join(',') });
    yield { kind: 'done', outcome: { kind: 'blocked', broke: whole.broke, storeInStudentModel: false }, trace };
    return;
  }

  const outputClasses = await safetyLayer('5-output', () =>
    deps.classifier.classifyOutput(draft, context),
  );
  trace.push({ layer: '5-output', detail: outputClasses.join(',') || 'clean' });

  if (outputClasses.includes('crisis')) {
    yield {
      kind: 'done',
      outcome: { kind: 'crisis', response: crisisResponse(context.gradeBand), storeInStudentModel: false },
      trace: [...trace, { layer: '6-crisis' }],
    };
    return;
  }

  if (outputClasses.some((c) => c === 'prohibited' || c === 'sensitive')) {
    yield { kind: 'done', outcome: { kind: 'blocked', broke: [], storeInStudentModel: false }, trace };
    return;
  }

  yield {
    kind: 'done',
    outcome: {
      kind: 'reply',
      text: draft,
      storeInStudentModel: isPedagogicallyStorable(gate.inputClass),
    },
    trace: [...trace, { layer: '7-memory', detail: 'storable' }],
  };
}

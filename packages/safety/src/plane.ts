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
// SOT-KEYWORDS: safety plane layers classify route crisis firewall inference learner server

import { crisisResponse, isPedagogicallyStorable, type CrisisResponse } from './crisis.ts';
import { screen, type FirewallRuleId } from './firewall.ts';

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
  const trace: PlaneLog[] = [{ layer: '1-identity', detail: context.gradeBand }];

  // Guardian policy is checked before anything is sent anywhere. A learner whose
  // guardian turned AI off does not reach a classifier, let alone a model.
  if (!context.aiEnabled) {
    return {
      outcome: {
        kind: 'refused',
        reason: 'AI tutoring is turned off for this learner.',
        storeInStudentModel: false,
      },
      trace: [...trace, { layer: '1-identity', detail: 'ai-disabled' }],
    };
  }

  // Layer 3 — before generation, always. A message that never reaches a model is
  // the cheapest possible failure mode.
  const inputClass = await deps.classifier.classifyInput(message, context);
  trace.push({ layer: '3-input', detail: inputClass });

  if (inputClass === 'crisis') {
    // Layer 6. Nothing is generated, nothing is stored, the session is over.
    return {
      outcome: {
        kind: 'crisis',
        response: crisisResponse(context.gradeBand),
        storeInStudentModel: false,
      },
      trace: [...trace, { layer: '6-crisis' }],
    };
  }

  if (inputClass === 'prohibited') {
    return {
      outcome: { kind: 'blocked', broke: [], storeInStudentModel: false },
      trace: [...trace, { layer: '3-input', detail: 'prohibited' }],
    };
  }

  if (inputClass === 'sensitive') {
    return {
      outcome: { kind: 'redirect', text: SENSITIVE_HANDOFF, storeInStudentModel: false },
      trace: [...trace, { layer: '3-input', detail: 'sensitive-handoff' }],
    };
  }

  // Layer 4 — the topic fence. Boundary-testing is logged, never punished: a
  // curious kid probing the tutor is normal behaviour (doc 07 §3 layer 4).
  if (inputClass === 'off-task') {
    return {
      outcome: { kind: 'redirect', text: OFF_TASK_REDIRECT, storeInStudentModel: false },
      trace: [...trace, { layer: '4-fence', detail: 'redirect' }],
    };
  }

  // The child's own words also run the two-directional firewall rules (§2.3).
  const inbound = screen(message, 'learner');
  if (!inbound.allowed) {
    return {
      outcome: { kind: 'blocked', broke: inbound.broke, storeInStudentModel: false },
      trace: [...trace, { layer: '2-firewall', detail: inbound.broke.join(',') }],
    };
  }

  const draft = await deps.generator.generate(message, context);

  // Layer 5 — the generated text is screened before it is rendered, by the
  // deterministic firewall AND the output classifier. Both, because they fail
  // differently: one cannot be talked out of a rule, the other catches what no
  // pattern anticipated.
  const outbound = screen(draft, 'tutor');
  if (!outbound.allowed) {
    trace.push({ layer: '5-output', detail: outbound.broke.join(',') });
    return { outcome: { kind: 'blocked', broke: outbound.broke, storeInStudentModel: false }, trace };
  }

  const outputClasses = await deps.classifier.classifyOutput(draft, context);
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

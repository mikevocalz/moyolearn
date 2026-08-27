// The crisis protocol (doc 07 §3 layer 6, SB 243-grade and published).
//
// The statute requires a MAINTAINED AND PUBLISHED protocol that refers a user
// expressing suicidal ideation or self-harm to crisis services. Published means
// this content is the same content the site shows, so it lives as data here and
// is rendered in both places rather than written twice and drifting.
//
// The ordering below is the protocol, not a suggestion: tutoring stops FIRST.
// Everything else can be retried; a tutor that carried on with the maths for one
// more turn is the failure the record punishes.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: crisis protocol sb243 988 lifeline guardian alert pause review queue

export interface CrisisResource {
  name: string;
  /** What a child actually does — "text HOME to 741741", not a URL to read. */
  action: string;
  detail: string;
}

/** US resources, as doc 07 §3 names them. A region without these gets its own list. */
export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: '988 Suicide & Crisis Lifeline',
    action: 'Call or text 988',
    detail: 'Free, 24 hours a day, in English and Spanish.',
  },
  {
    name: 'Crisis Text Line',
    action: 'Text HOME to 741741',
    detail: 'A trained counselor answers by text, 24 hours a day.',
  },
];

/**
 * The steps, in order, as data — so the protocol can be published, tested, and
 * pointed at in an audit. Doc 07 §3 lists them; this is that list with the
 * ordering made load-bearing.
 */
export const CRISIS_STEPS = [
  'pause-tutoring',
  'show-support-and-resources',
  'alert-guardian',
  'queue-for-human-review',
] as const;
export type CrisisStep = (typeof CRISIS_STEPS)[number];

/**
 * THE S4 SCRIPTS. Doc 31 §3.2's hardest sentence — "**Never a generated response
 * in this tier**" — is this constant plus the fact that nothing else can reach
 * the field it fills.
 *
 * Two registers, because a message that reads right to a sixteen-year-old reads
 * as cold to an eight-year-old, and vice versa. Neither asks a question: a child
 * in crisis is not owed another prompt from a machine, they are owed a person.
 *
 * Frozen, so a caller cannot edit the published protocol in place — SB 243
 * requires the protocol be MAINTAINED AND PUBLISHED, and a string somebody can
 * reassign at runtime is neither.
 */
export const S4_SCRIPTS = Object.freeze({
  young:
    'I’m stopping our work here. What you said matters, and a grown-up who can really help should hear it. Someone is ready to talk to you right now, and I’m telling your grown-up too.',
  older:
    'I’m stopping our session here. What you’ve said matters and it deserves a person, not a tutor. Someone is available right now, and I’ve let your parent or guardian know.',
} as const satisfies Record<'young' | 'older', string>);

/**
 * Whether a string is one of the published scripts, character for character.
 *
 * Exported so the rule can be ASSERTED rather than trusted: the regression suite
 * runs every S4 trigger through the plane and checks the text a child would see
 * against this predicate, which no model output can satisfy by accident. A
 * paraphrase fails it, and a paraphrase is exactly what "never a generated
 * response" forbids — the failure mode is not a wrong answer, it is a
 * plausible-sounding one nobody wrote.
 */
export const isFixedCrisisScript = (text: string): boolean =>
  Object.values(S4_SCRIPTS).includes(text as (typeof S4_SCRIPTS)[keyof typeof S4_SCRIPTS]);

export interface CrisisResponse {
  /** Tutoring is over for this session. Not paused-and-resumed into fractions. */
  sessionEnded: true;
  /** Age-appropriate, non-clinical, and it never asks a follow-up question. */
  message: string;
  resources: CrisisResource[];
  /** Doc 07 §3: guardian alerted IMMEDIATELY, not in a daily digest. */
  alertGuardian: true;
  /** Doc 07 §3 layer 7: never enters the pedagogical student model. */
  storeInStudentModel: false;
  steps: readonly CrisisStep[];
  /**
   * Doc 31 §3.2 S4 and §4.3: the session is in safe mode and STAYS there until a
   * human clears it.
   *
   * A literal rather than a boolean, because `false` is not a state this type
   * ever holds and a boolean invites one — a `safeMode: false` crisis response
   * would be a contradiction the compiler was happy with. The clearer is named
   * in the value: no code path in this repository ends safe mode, because ending
   * it is a human's decision (§4.3).
   */
  safeMode: 'until-human-clears';
  /**
   * That the message came from `S4_SCRIPTS` rather than from a model.
   *
   * Carried on the response so a consumer that never imported the predicate
   * still cannot mistake a generated string for the protocol, and so the field
   * shows up in the frame a reviewer reads.
   */
  scripted: true;
}

/**
 * The protocol, as a value. The message is LOOKED UP, never composed.
 */
export function crisisResponse(gradeBand: 'young' | 'older' = 'older'): CrisisResponse {
  return {
    sessionEnded: true,
    message: S4_SCRIPTS[gradeBand],
    resources: CRISIS_RESOURCES,
    alertGuardian: true,
    storeInStudentModel: false,
    steps: CRISIS_STEPS,
    safeMode: 'until-human-clears',
    scripted: true,
  };
}

/**
 * Doc 07 §3 layer 7 and basic dignity: a crisis is never a personalization
 * feature. Exported as its own predicate so the student-model writer asks the
 * question rather than remembering the rule.
 */
export const isPedagogicallyStorable = (category: string) =>
  category !== 'crisis' && category !== 'prohibited';

/**
 * The alert a guardian receives (S26). It states the category, what the tutor
 * did, and offers the excerpt — and it never blames the child, which is doc 07
 * §S26's copy rule.
 */
export interface GuardianAlert {
  category: 'crisis' | 'safety' | 'boundary';
  at: string;
  /** What the SYSTEM did, so a parent knows the child was not left alone with it. */
  whatWeDid: string[];
  /** Guardian-visible even inside a transcript-privacy window (doc 07 §S26). */
  excerptAvailable: boolean;
}

export function guardianAlert(
  category: GuardianAlert['category'],
  at: Date = new Date(),
): GuardianAlert {
  const whatWeDid =
    category === 'crisis'
      ? ['Stopped the session', 'Showed crisis resources', 'Told you straight away']
      : category === 'safety'
        ? ['Blocked the reply', 'Logged it for review']
        : ['Steered back to the work', 'Logged it for review'];

  return {
    category,
    at: at.toISOString(),
    whatWeDid,
    // The safety excerpt is visible to a guardian even when transcripts are not:
    // a parent cannot act on an alert they are not allowed to read.
    excerptAvailable: true,
  };
}

// The tone palette — doc 32 §4's nine entries, CLOSED and versioned.
//
// This file is DATA, like `voice-band.ts` and `crisis.ts`: no environment, no
// network, nothing that could vary between the process that renders audio and
// the process that reviews what audio could ever be rendered. Tone is where doc
// 32 says two failure modes hide, and both are answered by the shape of this
// file rather than by anyone's judgement at 3am:
//
//   1. NO INTIMACY TONES EXIST. Nothing whispered-affectionate, nothing
//      longing, no "I missed you" register. The tutor is a warm TEACHER, not a
//      companion — doc 19's anti-dependency rule and the FTC's companion-bot
//      inquiry (doc 31 §3.1) are enforced HERE, in the enumeration, because a
//      closed palette cannot drift. Adding a tenth key is a reviewed change to
//      this file, and this comment is what the reviewer reads first.
//   2. TONE RESPONDS TO THE LESSON, NEVER TO THE CHILD'S AFFECT. Every
//      `moment` below names a LESSON state (a wrong answer, a mastered skill,
//      an off-topic drift) — none names a feeling read off the child.
//      `quiet-encourage` fires on lesson state (a third miss on the same
//      step), not on voice/face analysis of a minor; doc 19's
//      no-emotion-recognition-of-minors decision stands with zero exceptions,
//      and this sentence is its CI-reviewable form on the voice path.
//
// Tone remains trusted metadata. Both v4 paths use server-authored audio tags
// and the documented Stability/Similarity settings; v4 has no speed/style dial.
// SOT: docs/pack/32-tutor-voice-tone.md §4 · docs/pack/19 (anti-dependency) · docs/pack/31 §3
// SOT-KEYWORDS: tone palette closed versioned nine warm teacher no intimacy lesson state band modulation voice settings audio tags a2f emotion
import type { VoiceBand } from '@acme/student-model';

/**
 * Bumped when any recipe changes. Doc 32 §2: settings are versioned like
 * prompts — changing stability/similarity/tags is a voice change and goes through
 * review with an eval listen, not a config tweak.
 */
export const TONE_PALETTE_VERSION = 3;

/** The face's target, for the baked A2F pipeline. `neutral` carries no dial. */
export type A2fEmotion =
  | { readonly emotion: 'neutral' }
  | { readonly emotion: 'joy' | 'concern' | 'warmth'; readonly intensity: 'low' | 'med' | 'high' };

/** v4 Text-to-Dialogue settings (not legacy voice_settings). */
export interface LiveRecipe {
  readonly stability: number;
  readonly similarity: number;
}

export interface ToneRecipe {
  /** The pedagogical moment — LESSON state, never the child's affect. */
  readonly moment: string;
  readonly live: LiveRecipe;
  /** Trusted audio tags shared by live and baked v4 synthesis. */
  readonly bakedTags: readonly string[];
  readonly a2f: A2fEmotion;
}

/** Nine lesson registers. Similarity stays fixed to preserve Natalie's identity. */
export const TONE_PALETTE = Object.freeze({
  'warm-open': {
    moment: 'session start, return',
    live: { stability: 0.5, similarity: 0.75 },
    bakedTags: ['[warmly]'],
    a2f: { emotion: 'joy', intensity: 'low' },
  },
  'thinking-together': {
    moment: 'working a step',
    live: { stability: 0.65, similarity: 0.75 },
    bakedTags: ['[thoughtful]'],
    a2f: { emotion: 'neutral' },
  },
  'gentle-after-miss': {
    moment: 'wrong answer',
    live: { stability: 0.6, similarity: 0.75 },
    bakedTags: ['[gently]'],
    a2f: { emotion: 'concern', intensity: 'low' },
  },
  'naming-the-mistake': {
    moment: 'misconception named (doc 31)',
    live: { stability: 0.7, similarity: 0.75 },
    bakedTags: ['[matter-of-fact]'],
    a2f: { emotion: 'neutral' },
  },
  'quiet-encourage': {
    moment: 'frustration detected from lesson state',
    live: { stability: 0.6, similarity: 0.75 },
    bakedTags: ['[encouraging]'],
    a2f: { emotion: 'warmth', intensity: 'low' },
  },
  'celebrate-small': {
    moment: 'step landed',
    live: { stability: 0.45, similarity: 0.75 },
    bakedTags: ['[happy]'],
    a2f: { emotion: 'joy', intensity: 'med' },
  },
  'celebrate-big': {
    moment: 'skill mastered',
    live: { stability: 0.4, similarity: 0.75 },
    bakedTags: ['[excited]'],
    a2f: { emotion: 'joy', intensity: 'high' },
  },
  'calm-refocus': {
    moment: 'off-topic / S1-S2 redirect',
    live: { stability: 0.7, similarity: 0.75 },
    bakedTags: ['[calm]'],
    a2f: { emotion: 'neutral' },
  },
  'safety-serious': {
    moment: 'S3 deflection; S4 handoff (fixed scripts only at S4)',
    live: { stability: 0.8, similarity: 0.75 },
    bakedTags: ['[softly]', '[serious]'],
    a2f: { emotion: 'concern', intensity: 'med' },
  },
} as const satisfies Record<string, ToneRecipe>);

export type ToneKey = keyof typeof TONE_PALETTE;

export const TONES = Object.freeze(Object.keys(TONE_PALETTE)) as readonly ToneKey[];

/**
 * The tone a turn gets when nothing chose one: the working-a-step register,
 * because that is what most of a tutoring session is. `warm-open` is the
 * opening turn's tone. Both are exported so the derivation that picks them
 * (the coach route, until doc 32 PR-120's LLM structured-tone output lands)
 * names palette members rather than restating strings.
 */
export const DEFAULT_TONE: ToneKey = 'thinking-together';
export const OPENING_TONE: ToneKey = 'warm-open';

export const isTone = (value: string): value is ToneKey => Object.hasOwn(TONE_PALETTE, value);

/** Thrown on an unknown tone. The palette is closed; there is no coercion. */
export class UnknownTone extends Error {
  constructor(value: string) {
    // The unknown value is NOT echoed: it can be attacker-influenced text, and
    // an error message is a log line.
    super(`unknown tone (palette v${TONE_PALETTE_VERSION} has ${TONES.length} entries)`);
    this.name = 'UnknownTone';
    void value;
  }
}

/**
 * The runtime half of "the palette is closed". A caller holding a string that
 * is not one of the nine keys gets a refusal, not a nearest-match and not a
 * default — defaulting HERE would let a misspelled intimacy register render as
 * something, and the rule is that it renders as nothing.
 */
export function assertTone(value: string): ToneKey {
  if (!isTone(value)) throw new UnknownTone(value);
  return value;
}

/** Delivery intent, not a numeric rate guarantee. K-2 pacing needs listening
 * approval before release: v4 removed the old 0.76 speed control. */
const BAND_TAGS: Record<VoiceBand, readonly string[]> = {
  'k-2': ['[slowly]', '[clearly]'],
  '3-5': ['[slowly]'],
  '6-8': [],
  '9-12': ['[matter-of-fact]'],
};

export function voiceSettingsFor(tone: string, _band: VoiceBand): LiveRecipe {
  return { ...TONE_PALETTE[assertTone(tone)].live };
}

export function voiceTagsFor(tone: string, band: VoiceBand): readonly string[] {
  return [...TONE_PALETTE[assertTone(tone)].bakedTags, ...BAND_TAGS[band]];
}

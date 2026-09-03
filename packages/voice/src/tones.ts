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
// Tone is STRUCTURED METADATA beside the reply, never inline in the text —
// Flash (v2 family) would speak a bracketed tag or a stage direction aloud.
// The live recipe is therefore voice settings; only the baked path (Eleven v3)
// gets audio tags, and those are prepended by the egress, never authored into
// a script.
// SOT: docs/pack/32-tutor-voice-tone.md §4 · docs/pack/19 (anti-dependency) · docs/pack/31 §3
// SOT-KEYWORDS: tone palette closed versioned nine warm teacher no intimacy lesson state band modulation voice settings audio tags a2f emotion
import type { VoiceBand } from '@acme/student-model';

/**
 * Bumped when any recipe changes. Doc 32 §2: settings are versioned like
 * prompts — changing stability/style/speed is a voice change and goes through
 * review with an eval listen, not a config tweak.
 */
export const TONE_PALETTE_VERSION = 2;

/** The face's target, for the baked A2F pipeline. `neutral` carries no dial. */
export type A2fEmotion =
  | { readonly emotion: 'neutral' }
  | { readonly emotion: 'joy' | 'concern' | 'warmth'; readonly intensity: 'low' | 'med' | 'high' };

/**
 * The live path's voice settings, before band modulation. ElevenLabs' dials:
 * `stability` (higher = steadier), `style` (higher = more expressive) and
 * `speed` (1 is the voice's natural rate).
 */
export interface LiveRecipe {
  readonly stability: number;
  readonly style: number;
  readonly speed: number;
}

export interface ToneRecipe {
  /** The pedagogical moment — LESSON state, never the child's affect. */
  readonly moment: string;
  readonly live: LiveRecipe;
  /** Eleven v3 audio tags, baked path only. Flash would read these aloud. */
  readonly bakedTags: readonly string[];
  readonly a2f: A2fEmotion;
}

/**
 * Doc 32 §4's table, one entry per row. The live numbers are the v1 pinned
 * settings implementing each row's prose recipe ("slight slow", "brighter",
 * "slow, level") — they are the versioned artifact, not tuning suggestions.
 */
export const TONE_PALETTE = Object.freeze({
  'warm-open': {
    moment: 'session start, return',
    live: { stability: 0.5, style: 0.35, speed: 0.95 },
    bakedTags: ['[warmly]'],
    a2f: { emotion: 'joy', intensity: 'low' },
  },
  'thinking-together': {
    moment: 'working a step',
    live: { stability: 0.65, style: 0.2, speed: 1 },
    bakedTags: ['[thoughtful]'],
    a2f: { emotion: 'neutral' },
  },
  'gentle-after-miss': {
    moment: 'wrong answer',
    live: { stability: 0.6, style: 0.25, speed: 0.92 },
    bakedTags: ['[gently]'],
    a2f: { emotion: 'concern', intensity: 'low' },
  },
  'naming-the-mistake': {
    moment: 'misconception named (doc 31)',
    live: { stability: 0.7, style: 0.15, speed: 1 },
    bakedTags: ['[matter-of-fact]'],
    a2f: { emotion: 'neutral' },
  },
  'quiet-encourage': {
    moment: 'frustration detected from lesson state',
    live: { stability: 0.6, style: 0.3, speed: 0.9 },
    bakedTags: ['[encouraging]'],
    a2f: { emotion: 'warmth', intensity: 'low' },
  },
  'celebrate-small': {
    moment: 'step landed',
    live: { stability: 0.45, style: 0.45, speed: 1.02 },
    bakedTags: ['[happy]'],
    a2f: { emotion: 'joy', intensity: 'med' },
  },
  'celebrate-big': {
    moment: 'skill mastered',
    live: { stability: 0.4, style: 0.6, speed: 1.05 },
    bakedTags: ['[excited]'],
    a2f: { emotion: 'joy', intensity: 'high' },
  },
  'calm-refocus': {
    moment: 'off-topic / S1-S2 redirect',
    live: { stability: 0.7, style: 0.15, speed: 0.95 },
    bakedTags: ['[calm]'],
    a2f: { emotion: 'neutral' },
  },
  'safety-serious': {
    moment: 'S3 deflection; S4 handoff (fixed scripts only at S4)',
    live: { stability: 0.8, style: 0.1, speed: 0.85 },
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

export const isTone = (value: string): value is ToneKey => value in TONE_PALETTE;

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

/**
 * Doc 32 §4's band modulation — it MULTIPLIES the palette rather than
 * duplicating it. K-2 shifts everything slower and more melodic (for K-2 the
 * voice is the primary interface — a six-year-old can't read the chat); 3-5
 * slightly slow; 6-8 neutral; 9-12 natural adult register, style pulled DOWN
 * because a teen hears performed enthusiasm as condescension — the same
 * failure as complexity, inverted.
 */
/*
  v2 (2026-09-03, Mike on the Duo: "she's speaking so fast — how can you speak
  fast to a child"): K-2 and 3-5 pulled down hard. 0.88 x a 1.0 recipe was
  still a newsreader to a six-year-old; a reading teacher runs nearer 0.75 of
  adult conversational rate. The floor is the provider's 0.7, and the working
  tone (`thinking-together`, speed 1) lands at 0.76 for K-2.
*/
const BAND_MODULATION: Record<VoiceBand, { readonly speed: number; readonly style: number }> = {
  'k-2': { speed: 0.76, style: 1.25 },
  '3-5': { speed: 0.86, style: 1.1 },
  '6-8': { speed: 1, style: 1 },
  '9-12': { speed: 1, style: 0.7 },
};

const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, value));

/**
 * The settings one utterance renders with: tone recipe x band modulation.
 * Speed clamps to ElevenLabs' accepted range; style to [0, 1]. Refuses an
 * unknown tone — see `assertTone`.
 */
export function voiceSettingsFor(tone: string, band: VoiceBand): LiveRecipe {
  const recipe = TONE_PALETTE[assertTone(tone)].live;
  const modulation = BAND_MODULATION[band];
  return {
    stability: recipe.stability,
    style: clamp(recipe.style * modulation.style, 0, 1),
    speed: clamp(recipe.speed * modulation.speed, 0.7, 1.2),
  };
}

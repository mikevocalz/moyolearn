/**
 * THE single face writer. Speech, idle and emotion all want the head's
 * expression vector; exactly one of them writes it, once per frame, and this is
 * that one. Everything else contributes named ARKit weights and the bus merges
 * them by per-channel max — so an emotion baseline holds the brows while
 * speech drives the mouth, instead of the two fighting.
 *
 * THREE CHANGES FROM THE REFERENCE, all forced, all worth knowing:
 *
 * 1. **The mic listener is gone.** The reference fed the idle engine from an
 *    always-on microphone (partner speaking, pause events, falling F0). Doc 22
 *    §3 cuts it: turn-taking comes from the gateway stream, not from a live mic
 *    at a child. Those inputs are now supplied by the caller through
 *    `setConversationCues` — the idle engine's interface is unchanged, so
 *    backchannel nods and anticipation still work; they are just driven by
 *    something we can consent to.
 *
 * 2. **It is a factory, not a module singleton.** The reference kicked off a
 *    `fetch('/gnm/arkit-map.json')` at import time behind a `typeof window`
 *    check. Import-time I/O is wrong on RN and untestable anywhere; the encoder
 *    is now injected, already resolved.
 *
 * 3. **The encoder is injected, not assumed.** After the rebake (doc 22 §6.3)
 *    the head's expression vector may BE the 19 ARKit channels, in which case
 *    there is no matrix multiply per frame at all. See `./speech/encoder.ts`.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §3, §6.3, §7
 * SOT-KEYWORDS: face bus single writer merge max idle emotion speech expression encoder
 */
import { EmotionState, type EmotionCategory } from './emotion.ts';
import { IdleEngine, type IdleFrame } from './idle/engine.ts';
import type { ExpressionEncoder } from './speech/encoder.ts';
import type { SpeechDriver } from './speech/driver.ts';
import type { Shape } from './speech/track.ts';
import { claimFaceWriter, avatarStore } from './store.ts';

/**
 * Conversational cues the idle engine uses for backchannel nods and pre-speech
 * anticipation. The gateway knows all of these; a microphone is not required
 * for any of them.
 */
export interface ConversationCues {
  /** The learner is composing or speaking their turn. */
  partnerSpeaking: boolean;
  /** A turn just ended — fires for one frame. */
  partnerPauseEvent: boolean;
  /** Their turn is trailing off (question mark, send pending). */
  partnerF0Falling: boolean;
  /** A turn was recently completed, so a reply is expected. */
  recentlyEnded: boolean;
}

const IDLE_CUES: ConversationCues = {
  partnerSpeaking: false,
  partnerPauseEvent: false,
  partnerF0Falling: false,
  recentlyEnded: false,
};

export interface FaceBusOptions {
  speech: SpeechDriver;
  encoder: ExpressionEncoder;
  seed?: number;
  /** Injected so a golden run is not at the mercy of the wall clock. */
  clock?: () => number;
}

export interface FaceBus {
  /** Advances every contributor and makes the one expression write. */
  step(dt: number): IdleFrame;
  setEmotion(category: EmotionCategory, intensity?: number): void;
  setSeed(seed: number): void;
  /** Gateway-supplied turn-taking cues; held until replaced. */
  setConversationCues(cues: Partial<ConversationCues>): void;
  /**
   * Reduced motion (doc 22 §7): pins breath, sway, drift, gaze and blink
   * hazard. Speech-driven mouth and a minimal blink survive — this is
   * vestibular accessibility, and a still avatar must be provably still.
   */
  setReducedMotion(reduced: boolean): void;
  /** Dev-only held weights (the reference's `?pose=`), merged over everything. */
  poseWeights: Shape | null;
  readonly emotion: EmotionState;
}

export function createFaceBus(options: FaceBusOptions): FaceBus {
  const { speech, encoder } = options;
  const clock = options.clock ?? (() => Date.now());
  const writeToken = claimFaceWriter();

  let engine = new IdleEngine(options.seed);
  let cues: ConversationCues = { ...IDLE_CUES };
  let reducedMotion = false;
  let hadOutput = false;
  const emotion = new EmotionState();

  const bus: FaceBus = {
    poseWeights: null,
    emotion,

    setEmotion(category, intensity = 1) {
      emotion.set(category, intensity);
    },

    setSeed(seed) {
      engine = new IdleEngine(seed);
    },

    setConversationCues(next) {
      cues = { ...cues, ...next };
    },

    setReducedMotion(reduced) {
      reducedMotion = reduced;
    },

    step(dt: number): IdleFrame {
      const now = clock();
      const sp = speech.sampleSpeech(now);
      const untilOnset =
        speech.scheduledOnsetAt > now ? (speech.scheduledOnsetAt - now) / 1000 : Infinity;
      const processing = !sp.active && (Number.isFinite(untilOnset) || cues.recentlyEnded);

      const frame = engine.step(dt, {
        speechActive: sp.active,
        speechGap: sp.gap,
        processing,
        partnerSpeaking: cues.partnerSpeaking,
        partnerPauseEvent: cues.partnerPauseEvent,
        partnerF0Falling: cues.partnerF0Falling,
        timeUntilOnset: untilOnset,
      });
      // A pause is an event, not a level: clear it after the frame that saw it,
      // or one gateway turn-end produces a nod every frame until the next one.
      cues.partnerPauseEvent = false;

      // Merge order does not matter — max is commutative — but the SOURCES do:
      // speech owns the mouth, idle owns blink and eyes-wide, emotion holds a
      // baseline underneath, and pose weights are a dev override on top.
      const shape: Shape = sp.shape;
      if (!reducedMotion) {
        shape.eyeBlinkLeft = Math.max(shape.eyeBlinkLeft ?? 0, frame.eyeBlinkLeft);
        shape.eyeBlinkRight = Math.max(shape.eyeBlinkRight ?? 0, frame.eyeBlinkRight);
        shape.eyesWide = Math.max(shape.eyesWide ?? 0, frame.eyesWide);
      }
      for (const [name, value] of Object.entries(emotion.step(dt))) {
        shape[name] = Math.max(shape[name] ?? 0, value);
      }
      if (bus.poseWeights) {
        for (const [name, value] of Object.entries(bus.poseWeights)) {
          shape[name] = Math.max(shape[name] ?? 0, value);
        }
      }

      const out = encoder.encode(shape);
      let nonZero = false;
      for (let i = 0; i < out.length; ++i) {
        if (out[i] !== 0) {
          nonZero = true;
          break;
        }
      }
      // Skip the write only while the face has been neutral AND stays neutral.
      // The frame that returns to zero must still be written, or the last
      // expression sticks on the mesh forever.
      if (nonZero || hadOutput) {
        avatarStore.getState().setExpression(out, writeToken);
      }
      hadOutput = nonZero;

      return reducedMotion ? pinFrame(frame) : frame;
    },
  };

  return bus;
}

/**
 * Reduced motion, applied where the BODY reads it. The idle engine keeps
 * running so its PRNG stream — and therefore every seeded golden — stays
 * identical between modes; the channels the body would move are zeroed here.
 * Blink survives at the engine's own rate: a face that never blinks is not
 * restful, it is unsettling.
 */
function pinFrame(frame: IdleFrame): IdleFrame {
  return {
    ...frame,
    breathY: 0,
    breathPitch: 0,
    swayX: 0,
    swayY: 0,
    driftYaw: 0,
    driftPitch: 0,
    nodPitch: 0,
    eyeYaw: 0,
    eyePitch: 0,
    eyesWide: 0,
  };
}

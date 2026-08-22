/**
 * Moyo header block: the emotion bus. One signal drives face posture here and
 * gesture conditioning later. The vocabulary is BEAT's eight categories,
 * expressed as baseline ARKit weights over the 19 channels the face supports,
 * so speech visemes can merge OVER them (per-channel max in the face bus) and
 * the mouth keeps talking while the emotion holds brows, eyes, and corners.
 *
 * The 0.4s smoothstep is not decoration: an instant baseline change reads as a
 * glitch on a face, and doc 22 §7 forbids anything that reads as a mood the
 * child is responsible for.
 *
 * Ported verbatim from the gnm-avatar reference renderer (`src/emotion.ts`);
 * the only edit is the `Shape` import, which follows the speech split.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §7
 * SOT-KEYWORDS: emotion beat categories baseline arkit weights transition smoothstep face
 */

import type { Shape } from './speech/track.ts';

/**
 * §Phase-8 emotion bus: one signal drives face posture (here) and, later,
 * gesture conditioning. Vocabulary = BEAT's eight categories, expressed as
 * baseline ARKit weights over the 19 coefficient channels the face supports.
 * Speech visemes merge OVER these (per-channel max in the face bus), so the
 * mouth keeps talking while the emotion holds brows/eyes/corners.
 */
export type EmotionCategory =
  | 'neutral'
  | 'happiness'
  | 'anger'
  | 'sadness'
  | 'contempt'
  | 'surprise'
  | 'fear'
  | 'disgust';

export const EMOTION_PRESETS: Record<EmotionCategory, Shape> = {
  neutral: {},
  happiness: {
    mouthSmileLeft: 0.55,
    mouthSmileRight: 0.55,
    eyeSquintLeft: 0.25,
    eyeSquintRight: 0.25,
    browInnerUp: 0.1,
  },
  anger: {
    browDownLeft: 0.7,
    browDownRight: 0.7,
    eyeSquintLeft: 0.35,
    eyeSquintRight: 0.35,
    mouthShrugUpper: 0.2,
  },
  sadness: {
    browInnerUp: 0.6,
    mouthLowerDownLeft: 0.25,
    mouthLowerDownRight: 0.25,
    eyeBlinkLeft: 0.15,
    eyeBlinkRight: 0.15,
  },
  contempt: {
    mouthSmileLeft: 0.35,
    browDownRight: 0.3,
    eyeSquintRight: 0.25,
  },
  surprise: {
    browInnerUp: 0.7,
    browOuterUpLeft: 0.6,
    browOuterUpRight: 0.6,
    eyesWide: 0.6,
    jawOpen: 0.15,
  },
  fear: {
    browInnerUp: 0.8,
    eyesWide: 0.7,
    mouthShrugUpper: 0.15,
    mouthLowerDownLeft: 0.15,
    mouthLowerDownRight: 0.15,
  },
  disgust: {
    browDownLeft: 0.5,
    browDownRight: 0.5,
    mouthShrugUpper: 0.5,
    eyeSquintLeft: 0.4,
    eyeSquintRight: 0.4,
  },
};

const TRANSITION_S = 0.4;

export class EmotionState {
  private current: Shape = {};
  private from: Shape = {};
  private target: Shape = {};
  private t = 1;
  category: EmotionCategory = 'neutral';
  intensity = 1;

  set(category: EmotionCategory, intensity = 1) {
    this.category = category;
    this.intensity = Math.max(0, Math.min(1, intensity));
    this.from = { ...this.current };
    this.target = {};
    for (const [k, v] of Object.entries(EMOTION_PRESETS[category])) {
      this.target[k] = v * this.intensity;
    }
    this.t = 0;
  }

  /** Advances the eased transition; returns the current baseline weights. */
  step(dt: number): Shape {
    this.t = Math.min(1, this.t + dt / TRANSITION_S);
    const e = this.t * this.t * (3 - 2 * this.t);
    const out: Shape = {};
    const keys = new Set([...Object.keys(this.from), ...Object.keys(this.target)]);
    for (const k of keys) {
      const v = (this.from[k] ?? 0) * (1 - e) + (this.target[k] ?? 0) * e;
      if (v > 1e-4) out[k] = v;
      this.current[k] = v;
    }
    return out;
  }
}

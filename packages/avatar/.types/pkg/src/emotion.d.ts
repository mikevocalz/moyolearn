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
export type EmotionCategory = 'neutral' | 'happiness' | 'anger' | 'sadness' | 'contempt' | 'surprise' | 'fear' | 'disgust';
export declare const EMOTION_PRESETS: Record<EmotionCategory, Shape>;
export declare class EmotionState {
    private current;
    private from;
    private target;
    private t;
    category: EmotionCategory;
    intensity: number;
    set(category: EmotionCategory, intensity?: number): void;
    /** Advances the eased transition; returns the current baseline weights. */
    step(dt: number): Shape;
}

/**
 * Lipsync from the AUDIO, not from the spelling.
 *
 * What it replaces: `evenTrack` put one keyframe per letter, spaced by
 * character index, jaw 0.5 for a vowel and 0.2 for anything else. Its own
 * docstring calls it the fallback for an aligner that was never wired, and it
 * shows — even spacing means no silence between words, no stress, no pace, and
 * a mouth that runs at a constant rate regardless of what is being said.
 *
 * We decode the whole utterance before we play it (`tutor-audio.ts` has to —
 * `react-native-audio-api` cannot decode a partial body), so the samples are
 * already in hand. Two cheap features carry most of what a mouth does:
 *
 *   ENERGY (RMS)  → how open. Real amplitude, real pauses, real emphasis.
 *   ZERO CROSSINGS → how spread. Sibilants and fricatives cross zero many times
 *                    per window and are made with a nearly closed, spread mouth;
 *                    vowels cross rarely and are made with an open one. So a
 *                    /s/ stops reading as a small /a/, which is the single
 *                    biggest tell in energy-only lipsync.
 *
 * Not a phoneme aligner and not a learned model. It is the honest middle: it
 * costs one pass over the PCM at decode, adds no dependency, and runs in Node,
 * so it is testable without an audio device.
 *
 * SOT: ./driver.ts · packages/app/features/tutor/tutor-audio.ts
 * SOT-KEYWORDS: lipsync audio energy rms zero crossing viseme track jaw spread analysis
 */
import type { Track } from './track.ts';
/**
 * Per-frame `{ open, spread }` for one utterance.
 *
 * `open` is normalised against the utterance's own loud end rather than full
 * scale, so a quietly-mastered sentence still articulates instead of mumbling.
 * The 95th percentile, not the max, because one transient should not flatten
 * everything else.
 */
export declare function analyseSpeech(samples: Float32Array, sampleRate: number): Track;

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

/** Analysis rate. 60/s matches the render loop; finer buys nothing visible. */
const FPS = 60;

/**
 * Loudness below which the mouth is shut. Speech recordings carry room tone,
 * and without a floor she chews quietly through every gap.
 */
const SILENCE = 0.02;

/**
 * Crossings per second spanning "vowel" to "sibilant". Voiced speech sits near
 * 1–2 kHz of crossings, /s/ and /f/ well above 4 kHz.
 */
const ZCR_VOWEL = 1500;
const ZCR_SIBILANT = 5000;

/**
 * Openness is gamma-corrected: linear RMS reads flat, because the loud middle
 * of a vowel is only ~3x the quiet edge and the eye wants more contrast than
 * that.
 */
const GAMMA = 0.62;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Per-frame `{ open, spread }` for one utterance.
 *
 * `open` is normalised against the utterance's own loud end rather than full
 * scale, so a quietly-mastered sentence still articulates instead of mumbling.
 * The 95th percentile, not the max, because one transient should not flatten
 * everything else.
 */
export function analyseSpeech(samples: Float32Array, sampleRate: number): Track {
  const hop = Math.max(1, Math.round(sampleRate / FPS));
  // Two hops, so windows overlap and a short burst cannot fall between frames.
  const window = hop * 2;
  const frames = Math.max(1, Math.ceil(samples.length / hop));

  const energy = new Float32Array(frames);
  const spread = new Float32Array(frames);

  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    const end = Math.min(samples.length, start + window);
    let sum = 0;
    let crossings = 0;
    let previous = samples[start] ?? 0;
    for (let i = start; i < end; i++) {
      const sample = samples[i] as number;
      sum += sample * sample;
      if ((sample >= 0) !== (previous >= 0)) crossings++;
      previous = sample;
    }
    const count = Math.max(1, end - start);
    energy[f] = Math.sqrt(sum / count);
    const zcr = (crossings * sampleRate) / count;
    spread[f] = clamp01((zcr - ZCR_VOWEL) / (ZCR_SIBILANT - ZCR_VOWEL));
  }

  const loud = percentile(energy, 0.95);
  const scale = loud > SILENCE ? 1 / loud : 0;

  const track: Track = [];
  for (let f = 0; f < frames; f++) {
    const level = energy[f] as number;
    const open = level < SILENCE ? 0 : clamp01((level * scale) ** GAMMA);
    track.push([
      (f * hop) / sampleRate,
      // A spread mouth is a less open one — /s/ is loud and nearly shut, and
      // scaling openness down by it is what stops sibilants gaping.
      { open: open * (1 - 0.55 * (spread[f] as number)), spread: open > 0 ? (spread[f] as number) : 0 },
    ]);
  }
  // Shut at the end, so a track that is sampled past its last keyframe holds a
  // closed mouth rather than the final frame's vowel.
  track.push([samples.length / sampleRate, { open: 0, spread: 0 }]);
  return track;
}

function percentile(values: Float32Array, fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = Float32Array.from(values).sort();
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index] as number;
}

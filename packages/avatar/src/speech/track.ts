/**
 * The pure half of the speech driver: track shapes, the keyframe sampler, and
 * the ARKit→GNM coefficient matrix. Split out of the reference renderer's
 * single `src/speech.ts` because that file mixed this — which is arithmetic on
 * typed arrays and runs anywhere — with `HTMLAudioElement`, `new Audio()`, and
 * `fetch('/tts')`, which run in exactly one place.
 *
 * The split is the port (doc 22 §4 row 15). It is NOT a platform seam: the
 * playback half is one shared implementation on `react-native-audio-api`,
 * which is Web Audio on iOS, Android and web alike (web delegates to the
 * browser's own AudioContext), so `ctx.currentTime - startTime` replaces
 * `HTMLAudioElement.currentTime` once, everywhere. The split exists because
 * this half is arithmetic that needs no audio device at all — which is what
 * makes the viseme math unit-testable in Node.
 *
 * A track is authored as `[[t, {shapeName: weight}], ...]` and sampled on the
 * audio clock each frame. The face bus — not this module — owns the single
 * expression write per frame.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §4 row 15
 * SOT-KEYWORDS: speech viseme track sampler arkit mapper coefficients gesture emage lipsync
 */

/** Named ARKit-style blendshape weights, e.g. `{ jawOpen: 0.4 }`. */
export type Shape = Record<string, number>;

/** Authored viseme track: `[timeSeconds, weights]` keyframes, time-ordered. */
export type Track = [number, Shape][];

/** Co-speech gesture for one utterance (EMAGE, 30 fps in the reference). */
export interface GestureTrack {
  fps: number;
  joints: string[];
  frames: number[][];
}

/** One frame's speech contribution, pulled by the face bus. */
export interface SpeechSample {
  shape: Shape;
  active: boolean;
  gap: boolean;
}

/**
 * Keyframe advance by playback time + smoothstep interpolation.
 *
 * `idx` is carried by the caller across frames: playback is monotonic in the
 * common case, so the scan is O(1) amortised, and the backward `while` keeps
 * a seek or a loop correct rather than fast-and-wrong.
 */
export function sampleTrack(
  track: Track,
  t: number,
  idx: number
): { shape: Shape; idx: number } {
  // An empty track is a real case, not a defensive one: a TTS response can
  // carry audio with no alignment, and the caller then falls back to an
  // evenly-spread track. Returning neutral beats propagating NaN into the
  // expression vector, which shows up as a frozen face with no error.
  if (track.length === 0) return { shape: {}, idx: 0 };

  let cursor = Math.min(Math.max(idx, 0), track.length - 1);
  let next = track[cursor + 1];
  while (next && next[0] <= t) {
    cursor++;
    next = track[cursor + 1];
  }
  let current = track[cursor] as [number, Shape];
  while (cursor > 0 && current[0] > t) {
    cursor--;
    current = track[cursor] as [number, Shape];
  }

  const k0 = current;
  const k1 = (track[Math.min(cursor + 1, track.length - 1)] ?? k0) as [
    number,
    Shape,
  ];
  let f = Math.min(1, Math.max(0, (t - k0[0]) / Math.max(1e-3, k1[0] - k0[0])));
  f = f * f * (3 - 2 * f);
  const shape: Shape = {};
  for (const n of new Set([...Object.keys(k0[1]), ...Object.keys(k1[1])])) {
    shape[n] = (k0[1][n] || 0) * (1 - f) + (k1[1][n] || 0) * f;
  }
  return { shape, idx: cursor };
}

export interface ArkitMap {
  names: string[];
  coeffs: number[][];
}

/**
 * name-indexed flat matrix; out = sum(weight_i * coeffs_i) over nonzero weights.
 *
 * Output length comes from the map's own coefficient length, never a constant —
 * the GNM expression dimension is a property of the head container, and a
 * hard-coded width silently truncates the moment the container changes.
 */
export class ArkitMapper {
  readonly dim: number;
  private index = new Map<string, number>();
  private matrix: Float32Array;

  constructor(map: ArkitMap) {
    this.dim = map.coeffs[0]?.length ?? 0;
    this.matrix = new Float32Array(map.names.length * this.dim);
    map.names.forEach((name, i) => {
      this.index.set(name, i);
      const row = map.coeffs[i];
      // A name without a coefficient row leaves that row zeroed, which reads as
      // "this blendshape moves nothing" — the correct behaviour for a partial
      // map, and better than throwing at load and losing the whole face.
      if (row) this.matrix.set(row, i * this.dim);
    });
  }

  map(shape: Shape): Float32Array {
    const out = new Float32Array(this.dim);
    for (const name in shape) {
      const w = shape[name];
      if (!w) continue;
      const i = this.index.get(name);
      if (i === undefined) continue;
      // Non-null assertions: both reads are in-bounds by construction (`out`
      // is allocated at `this.dim`, and `row` is a view of exactly that many
      // elements). Written this way rather than with `?? 0` so the inner loop
      // of every speech frame stays a plain float add.
      const row = this.matrix.subarray(i * this.dim, (i + 1) * this.dim);
      for (let j = 0; j < this.dim; ++j) out[j] = out[j]! + w * row[j]!;
    }
    return out;
  }
}

// The Audio2Face-3D client — Natalie's face, computed from Natalie's audio,
// on Moyo's own GPU host (ADR-112). Server-side only, and inside the voice
// egress on purpose: the performance is an OUTPUT of the learner AI turn and
// travels with the sentence it belongs to (doc 22 §7); no feature ever
// reaches an animation service directly.
//
// WHAT IS SENT. The exact bytes the client will play — the ElevenLabs Flash
// stream for one plane-passed, tag-verified sentence — plus the tone's
// explicit emotion (doc 32 §4: specified, never inferred-only, so face and
// voice cannot disagree). NEVER a learner's audio: this module has no import
// path to learner input (`tooling/check-voice-egress.mjs` rule 3), and the
// Audio2Emotion licence forbids emotion recognition outside the A2F project
// anyway — both lines say the same thing.
//
// WHAT COMES BACK. `{ fps, names, frames, emotion }`: ARKit-named blendshape
// weights per frame, 30 or 60 per second of audio, scheduled by the client on
// its audio clock (`tutor-audio.ts`). `names` is carried rather than assumed
// because the SDK's `mouthClose` deviates from ARKit (it includes jaw opening)
// and several shapes are always zero — the client maps by name, never by index.
//
// EVERY failure is "no face", never "no voice": the audio is already in hand
// when this is called, and a sentence whose face could not be computed still
// plays with the audio-analysis lipsync the client has always had.
// SOT: docs/decisions/adr-112-live-audio2face.md · .claude/skills/audio2face-live/SKILL.md · docs/pack/32 §3
// SOT-KEYWORDS: audio2face a2f client blendshape frames fps names emotion gpu host egress fail open no face
import 'server-only';
import type { A2fEmotion } from './tones.ts';

/** One sentence's face, as the client receives it beside the audio. */
export interface FacePerformance {
  readonly fps: number;
  /** Blendshape names, in the order each frame's values are given. */
  readonly names: readonly string[];
  /** `frames[k][i]` is the weight of `names[i]` at `k / fps` seconds. */
  readonly frames: readonly (readonly number[])[];
  /** What Audio2Emotion read off HER voice, for telemetry; the face already carries it. */
  readonly emotion: string | null;
}

export interface A2fTransportInput {
  readonly audio: Uint8Array;
  readonly contentType: string;
  readonly emotion: A2fEmotion;
  readonly signal: AbortSignal;
}

/** Injectable for tests. Production posts to `AUDIO2FACE_URL`. */
export type A2fTransport = (input: A2fTransportInput) => Promise<Response>;

/**
 * The host wraps NVIDIA's SDK (`libaudio2x.so`, MIT) in one HTTP endpoint:
 * `POST {AUDIO2FACE_URL}/v1/face` with the audio body and the emotion in a
 * header, answering the JSON above. Unset means "no face, ever" — the client
 * never learns the difference between unconfigured and down.
 */
const a2fUrl = (): string | null => process.env.AUDIO2FACE_URL ?? null;

/**
 * How long a face may take. A2F runs faster than real time, so a sentence's
 * frames should arrive in a fraction of its duration; the cap is generous so a
 * cold TensorRT engine does not cost the first sentence its face, and hard so
 * a hung host cannot cost the child the sentence itself.
 */
export const A2F_TIMEOUT_MS = 2500;

const defaultTransport: A2fTransport = async ({ audio, contentType, emotion, signal }) => {
  const base = a2fUrl();
  if (base === null) throw new Error('AUDIO2FACE_URL unset');
  const intensity = emotion.emotion === 'neutral' ? 'none' : emotion.intensity;
  return fetch(`${base.replace(/\/+$/, '')}/v1/face`, {
    method: 'POST',
    headers: {
      'content-type': contentType,
      'x-a2f-emotion': emotion.emotion,
      'x-a2f-emotion-intensity': intensity,
    },
    // A plain `Uint8Array` view is not a `BodyInit` under the current lib
    // typings; the copy also detaches the request from the egress's buffer.
    body: new Blob([audio.slice()]),
    signal,
  });
};

function isPerformance(value: unknown): value is FacePerformance {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.fps !== 'number' || !(v.fps > 0)) return false;
  if (!Array.isArray(v.names) || !v.names.every((n) => typeof n === 'string')) return false;
  if (!Array.isArray(v.frames) || v.frames.length === 0) return false;
  const width = v.names.length;
  for (const frame of v.frames) {
    if (!Array.isArray(frame) || frame.length !== width) return false;
    for (const x of frame) if (typeof x !== 'number' || !Number.isFinite(x)) return false;
  }
  return v.emotion === null || v.emotion === undefined || typeof v.emotion === 'string';
}

export interface RenderFaceOptions {
  readonly transport?: A2fTransport;
  readonly timeoutMs?: number;
}

/**
 * Computes the face for one sentence's audio. `null` on ANY failure —
 * unconfigured, timeout, non-2xx, malformed — and never throws: the caller
 * already holds the audio and plays it either way.
 */
export async function renderFace(
  audio: Uint8Array,
  contentType: string,
  emotion: A2fEmotion,
  options: RenderFaceOptions = {}
): Promise<FacePerformance | null> {
  if (options.transport === undefined && a2fUrl() === null) return null;
  const transport = options.transport ?? defaultTransport;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? A2F_TIMEOUT_MS);
  try {
    const response = await transport({ audio, contentType, emotion, signal: controller.signal });
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      return null;
    }
    const payload: unknown = await response.json();
    if (!isPerformance(payload)) return null;
    return { fps: payload.fps, names: payload.names, frames: payload.frames, emotion: payload.emotion ?? null };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** True when a live face is configured at all. Read once per sentence. */
export const liveFaceConfigured = (): boolean => a2fUrl() !== null;

'use client';
// XR status, as sound. The Rive chrome's `status` text field asked a child's
// eyes to leave the board to learn what the room was doing; a headset has a
// better channel. Each transition that used to be a status line is a short
// synthesized earcon played on the shared `react-native-audio-api` context —
// the same engine the tutor voice runs on, so cues mix with speech rather
// than a second audio session fighting it. Sine tones through a gain
// envelope: no assets, no network, works the moment the module loads.
// SOT: danger-room ConferenceScene audio pattern · tutor-audio-context.native.ts
// SOT-KEYWORDS: xr status audio earcon cue oscillator feedback panel chrome

import { AudioContext } from 'react-native-audio-api';

export type XrStatusCue =
  /** A texture bound — the board or a panel came alive. */
  | 'ready'
  /** A bind failed or an ask could not send. */
  | 'error'
  /** Hold-to-talk opened the mic. */
  | 'askStart'
  /** Hold-to-talk released — the question went in. */
  | 'askEnd'
  /** Pen/eraser/ink changed. */
  | 'tool'
  /** Clear was armed — the second tap destroys, so the cue warns. */
  | 'armed'
  /** The written question was submitted to the tutor. */
  | 'submit';

/** [frequency Hz, seconds]. Steps play sequentially on one oscillator. */
const CUE_STEPS: Record<XrStatusCue, ReadonlyArray<readonly [number, number]>> = {
  /* Rising fifth — "live". */
  ready: [
    [523.25, 0.09],
    [783.99, 0.13],
  ],
  /* Low double — "that did not take". Sine, not buzz: this is a child's room. */
  error: [
    [196.0, 0.11],
    [164.81, 0.14],
  ],
  /* Quick rise — the mic opened. Short enough to feel instant on a hold. */
  askStart: [
    [440.0, 0.05],
    [659.25, 0.07],
  ],
  /* Mirror of askStart, falling — "heard, sending". */
  askEnd: [
    [659.25, 0.05],
    [440.0, 0.07],
  ],
  /* One bright tick — the tool is already visually distinct. */
  tool: [[1046.5, 0.06]],
  /* Held mid tone — "next tap destroys". */
  armed: [[329.63, 0.16]],
  /* Rising triad fragment — "the question went to Natalie". */
  submit: [
    [587.33, 0.07],
    [880.0, 0.14],
  ],
};

/** Cues closer than this merge into noise — keep the last only. */
const MIN_GAP_MS = 90;
/** Never louder than this — cues sit under speech, never over it. */
const PEAK_GAIN = 0.16;
const ATTACK_S = 0.012;
const RELEASE_S = 0.05;

let context: AudioContext | null = null;
let lastAt = 0;

/**
 * Play the earcon for a status transition. Fire-and-forget: every failure
 * path is silent — a missing cue is never worth a crash or a thrown render.
 * Throttled so a flapping state (bind retried twice in a frame) plays once.
 */
export function playXrStatusCue(cue: XrStatusCue): void {
  const now = Date.now();
  if (now - lastAt < MIN_GAP_MS) return;
  lastAt = now;
  try {
    context ??= new AudioContext();
    const ctx = context;
    if (ctx.state === 'suspended') void ctx.resume();

    const steps = CUE_STEPS[cue];
    const t0 = ctx.currentTime + 0.01;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    let t = t0;
    for (const [freq, dur] of steps) {
      osc.frequency.setValueAtTime(freq, t);
      t += dur;
    }
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, t0 + ATTACK_S);
    gain.gain.setValueAtTime(PEAK_GAIN, Math.max(t0 + ATTACK_S, t - RELEASE_S));
    gain.gain.linearRampToValueAtTime(0, t);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t + 0.01);
    /* One-shot nodes are GC'd by the engine after stop — no disconnect dance. */
  } catch {
    /* Silence beats a thrown audio path in XR. */
  }
}

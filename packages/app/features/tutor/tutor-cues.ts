// Tutor conversation cues — the learner's side of the turn, as the avatar
// hears it. Outside React, like the audio queue, and for the same reason: the
// presence writer samples it once per FRAME, and a render loop cannot wait on
// a re-render to learn that a child started typing.
//
// Doc 22 §3 cut the microphone listener: nothing here is audio. `composing` is
// the composer's keystroke cadence or an open recorder; the pause event is the
// send. That is enough for the two listening behaviours that remove most of
// "robot" — backchannel nods while the child is talking, and a turn of the
// body when they stop (idle/engine.ts `partnerSpeaking` / `partnerPauseEvent`).
// SOT: packages/avatar/src/idle/engine.ts · ./tutor-avatar-3d.native.tsx · docs/decisions/adr-113-body-motion-layer.md
// SOT-KEYWORDS: tutor cues composing typing cadence recording pause event partner speaking listening frame sampled

/** Keystrokes stop counting as "composing" this long after the last one. */
export const COMPOSING_HOLD_MS = 1200;

let lastKeystrokeAt = 0;
let recording = false;
let pausePending = false;

/** Called on every composer change. Cheap: a timestamp, no timer. */
export function noteKeystroke(now: number = Date.now()): void {
  lastKeystrokeAt = now;
}

export function setRecording(on: boolean): void {
  recording = on;
}

/** The learner's turn just left the composer. Consumed by the next frame. */
export function markTurnSent(): void {
  pausePending = true;
  lastKeystrokeAt = 0;
}

export interface TutorCues {
  /** The learner is typing or talking into the recorder. */
  partnerSpeaking: boolean;
  /** Their turn just ended — true for exactly one sample. */
  partnerPauseEvent: boolean;
}

/**
 * Sampled per frame by the stage. The pause event is an EVENT: it clears on
 * read, or one send would produce a nod and a torso turn every frame until
 * the next one.
 */
export function sampleCues(now: number = Date.now()): TutorCues {
  const event = pausePending;
  pausePending = false;
  return {
    partnerSpeaking: recording || now - lastKeystrokeAt < COMPOSING_HOLD_MS,
    partnerPauseEvent: event,
  };
}

/** Tests only. */
export function resetCues(): void {
  lastKeystrokeAt = 0;
  recording = false;
  pausePending = false;
}

// Talking to the tutor in the headset — the contract, without the recorder.
// SOT: packages/app/features/tutor/xr-voice.native.ts
// SOT-KEYWORDS: xr voice contract types platform neutral listening transcribe

/**
 * What the Ask button is doing right now.
 *
 * `transcribing` is a state and not a spinner detail: Whisper runs on device
 * and the first call of a session loads the model, so a child can wait a real
 * second or two after they stop talking. A button that says nothing there
 * reads as one that did not hear them.
 */
export type XrVoicePhase =
  | { kind: 'idle' }
  | { kind: 'listening' }
  | { kind: 'transcribing' }
  | { kind: 'blocked'; reason: 'permission' | 'device' | 'silent' };

export interface XrVoice {
  phase: XrVoicePhase;
  /** Press to start listening; press again to stop and send. */
  toggle: () => void;
}

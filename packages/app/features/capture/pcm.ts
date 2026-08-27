// Mixing a decoded capture down to the single channel Whisper accepts.
//
// Pure, and separate from `transcribe.native.ts`, because that file cannot be
// imported outside a native runtime — it pulls in ExecuTorch and the audio
// engine at module scope. The maths is the part that can be wrong in a way
// nobody notices, so it lives where it can be run.
// SOT: packages/app/features/capture/transcribe.native.ts
// SOT-KEYWORDS: pcm mono downmix whisper transcribe audio channels
export function toMono(channels: readonly Float32Array[]): Float32Array {
  const first = channels[0];
  if (first === undefined) return new Float32Array(0);
  if (channels.length === 1) return first;

  /*
    Averaged, not channel 0.

    A phone recording is usually mono, but a shared device or an external mic
    can hand back stereo — and taking the first channel of a stereo capture
    where the child sat nearer the other microphone throws away most of the
    signal. Whisper then transcribes the quiet half of the room.
  */
  const mono = new Float32Array(first.length);
  for (const channel of channels) {
    for (let i = 0; i < mono.length; i += 1) {
      mono[i] = (mono[i] ?? 0) + (channel[i] ?? 0);
    }
  }
  for (let i = 0; i < mono.length; i += 1) {
    mono[i] = (mono[i] ?? 0) / channels.length;
  }
  return mono;
}

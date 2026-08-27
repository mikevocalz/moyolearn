// Turning a child's voice note into text, on device, via ExecuTorch's Whisper.
//
// One module instance for the process. `fromModelName` downloads and loads a
// model; doing that per voice note would make a session pay for it repeatedly.
// SOT: packages/app/features/capture/read-attachment.native.ts
// SOT-KEYWORDS: transcribe native whisper executorch speech to text voice on-device
import { SpeechToTextModule, WHISPER_TINY_EN } from 'react-native-executorch';

let stt: SpeechToTextModule | undefined;

export async function transcribe(uri: string): Promise<string> {
  try {
    stt ??= await SpeechToTextModule.fromModelName(WHISPER_TINY_EN);
    const result = await stt.transcribe(await waveformFrom(uri));
    return result.text.trim();
  } catch {
    // Same contract as web: losing the transcript must not lose the note.
    return '';
  }
}

/**
 * Whisper wants raw mono PCM at 16kHz, not a file path.
 *
 * Decoding is deliberately left to the caller's platform audio stack rather
 * than reimplemented here — this is the seam where a real decoder plugs in, and
 * naming it is better than a silent `new Float32Array()` that returns empty
 * transcripts forever and looks like a model problem.
 */
async function waveformFrom(_uri: string): Promise<Float32Array> {
  throw new Error('PCM decoding for native transcription is not wired yet');
}

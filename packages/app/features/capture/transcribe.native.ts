// Turning a child's voice note into text, on device, via ExecuTorch's Whisper.
//
// One module instance for the process. `fromModelName` downloads and loads a
// model; doing that per voice note would make a session pay for it repeatedly.
// SOT: packages/app/features/capture/read-attachment.native.ts
// SOT-KEYWORDS: transcribe native whisper executorch speech to text voice on-device
import { SpeechToTextModule, WHISPER_TINY_EN } from 'react-native-executorch';
import { decodeAudioData } from 'react-native-audio-api';
import { toMono } from './pcm.ts';

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
 * This threw. The throw was deliberate — a named seam beats a silent
 * `new Float32Array()` that returns empty transcripts forever and reads as a
 * model problem — but it meant every voice note on device transcribed to
 * nothing, and `transcribe()` swallows the error by contract, so it failed
 * quietly and looked exactly like a quiet child.
 *
 * `react-native-audio-api` was already a dependency of this package. It is
 * Web Audio on native, so the decode is the same call the browser makes, and
 * passing the target rate resamples during decode rather than after.
 */
const WHISPER_SAMPLE_RATE = 16_000;

async function waveformFrom(uri: string): Promise<Float32Array> {
  const decoded = await decodeAudioData(uri, WHISPER_SAMPLE_RATE);

  const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) =>
    decoded.getChannelData(i),
  );
  return toMono(channels);
}

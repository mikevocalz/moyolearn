// On-device multilingual Whisper via Transformers.js. Raw recordings never
// leave the student's browser. The model promise is reused across voice notes.
// Failure preserves the original recording for review, not a guessed transcript.
import { whisperLanguageForLocale } from './speech-language.ts';

async function loadWhisper() {
  const { pipeline } = await import('@huggingface/transformers');
  return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
    device: 'webgpu',
  }).catch(() => pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny'));
}

let whisper: ReturnType<typeof loadWhisper> | undefined;

export async function transcribe(uri: string, locale?: string): Promise<string> {
  const language = whisperLanguageForLocale(locale);
  if (language === null) return ''; // Unsupported locale: preserve attachment for manual review.
  try {
    whisper ??= loadWhisper().catch((error) => {
      whisper = undefined; // A transient model-download error may be retried.
      throw error;
    });
    const recognize = await whisper;
    const output = (await recognize(uri, language ? { language } : {})) as
      | { text?: string }
      | Array<{ text?: string }>;
    const text = Array.isArray(output) ? output[0]?.text : output.text;
    return (text ?? '').trim();
  } catch {
    // Losing local recognition must not lose the learner's recorded note.
    return '';
  }
}

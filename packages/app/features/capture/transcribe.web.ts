// Turning a child's voice note into text, in the browser.
//
// Whisper through transformers.js — ONNX, WebGPU where the browser has it,
// falling back to WASM where it does not. On-device like everything else in
// this product's media path: no API, no key, no per-second cost, and a child's
// recorded voice never leaves the machine to be understood.
//
// `tiny.en` rather than `base`. The download lands on a school Chromebook over
// shared wi-fi, and the accuracy difference on a sentence a child speaks into
// their own laptop does not survive that trade.
// SOT: packages/app/features/capture/ocr-web.ts
// SOT-KEYWORDS: transcribe web whisper transformers speech to text on-device voice
export async function transcribe(uri: string): Promise<string> {
  try {
    const { pipeline } = await import('@huggingface/transformers');
    const recognise = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      device: 'webgpu',
    }).catch(() =>
      pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en'),
    );
    const output = (await recognise(uri)) as { text?: string } | Array<{ text?: string }>;
    const text = Array.isArray(output) ? output[0]?.text : output.text;
    return (text ?? '').trim();
  } catch {
    /*
      An untranscribable note must not lose the note. The audio still played and
      still went to the tutor; the transcript is the reviewable copy, and its
      absence is a smaller failure than dropping the turn.
    */
    return '';
  }
}

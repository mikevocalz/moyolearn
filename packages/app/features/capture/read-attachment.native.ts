// Read a photographed problem, on device, via ExecuTorch's CRAFT + CRNN.
//
// The module-level instance is created ONCE. `OCRModule.fromModelName` loads
// two models; doing that per photograph would make a four-image turn pay for
// eight model loads.
//
// AND IT IS SINGLE-FLIGHT, which is the other half of that decision and was
// missing. `handleSend` reads every staged image with `Promise.all`, so a
// two-photo turn called `forward` twice against the one instance and the second
// threw:
//
//   Error: The model is currently generating. Please wait until previous model
//   run is complete.  (code 104)
//
// which the catch below turned into an empty reading. So the second page of a
// child's homework was silently dropped, and a turn sent while an earlier read
// was still running lost its page entirely. The queue serialises them.
// SOT: packages/app/features/capture/ocr-review.native.tsx · ./reading-order.ts
// SOT-KEYWORDS: read attachment native ocr executorch craft crnn homework queue single-flight
import { OCRModule, OCR_ENGLISH } from 'react-native-executorch';
import { readingOrder } from './reading-order.ts';

let ocr: Awaited<ReturnType<typeof OCRModule.fromModelName>> | undefined;

/**
 * The tail of the read queue. Every call chains onto it, so `forward` is only
 * ever entered once at a time — including the model load, which a concurrent
 * first pair would otherwise start twice.
 */
let queue: Promise<unknown> = Promise.resolve();

export async function readAttachment(uri: string): Promise<string> {
  const run = queue.then(
    async () => {
      ocr ??= await OCRModule.fromModelName(OCR_ENGLISH);
      const detections = await ocr.forward(uri);
      /*
        IN READING ORDER. A text detector emits boxes in ITS order — CRAFT's is
        roughly by activation, not by position — so joining them as they arrive
        returns a page's own words shuffled.
      */
      return readingOrder(detections);
    },
    // A failed read must not poison the queue for the pages after it.
    () => '',
  );
  // The queue advances whether this read succeeded or not.
  queue = run.catch(() => undefined);
  try {
    return await run;
  } catch (error) {
    /*
      A silent catch is why "I uploaded my homework and nothing happened" had no
      trace to follow. The contract still holds — an unreadable photo costs the
      reading, not the turn — but it no longer costs the diagnosis.
    */
    if (__DEV__) console.warn('[readAttachment] %s failed:', 'ExecuTorch OCR', error);
    return '';
  }
}

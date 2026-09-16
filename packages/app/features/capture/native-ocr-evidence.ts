// Keep native recognition candidates and uncertainty separate from reviewed evidence.
// SOT: installed react-native-executorch/src/types/ocr.ts; ./reading-order.ts
// SOT-KEYWORDS: native ocr evidence geometry score cancellation queue source preservation
import type { OCRDetection, OCRModule } from 'react-native-executorch';
import { readingOrder } from './reading-order.ts';

const failureReasons = {
  empty: 'empty',
  failed: 'failed',
  unsupported: 'unsupported',
  cancelled: 'failed',
} as const;

function metadata(source: string) {
  return {
    source,
    engine: 'executorch-craft-crnn' as const,
    engineVersion: '0.9.3' as const,
    model: 'ocr-en' as const,
    language: 'en' as const,
    requiresSourceCheck: true,
    // These boxes refer to the decoder's image, not a verified master transform.
    coordinateSpace: 'executorch-decoded-image-pixels' as const,
    masterTransform: 'unverified' as const,
    scoreGranularity: 'detection' as const,
    confidenceMeaning: 'minimum-valid-detection-score-percent' as const,
  };
}

export function nativeOcrFailure(source: string, status: keyof typeof failureReasons) {
  return {
    ...metadata(source),
    status,
    reason: failureReasons[status],
    text: '',
    detections: [] as OCRDetection[],
    confidence: undefined,
    geometryValid: false,
  };
}

export function nativeOcrEvidence(source: string, input: readonly OCRDetection[]) {
  const detections = input.map((detection) => ({ ...detection, bbox: { ...detection.bbox } }));
  const geometryValid = detections.every(({ bbox }) =>
    Object.values(bbox).every(Number.isFinite) &&
    bbox.x1 >= 0 && bbox.y1 >= 0 && bbox.x2 > bbox.x1 && bbox.y2 > bbox.y1,
  );
  const scoresValid = detections.length > 0 && detections.every(({ score }) =>
    Number.isFinite(score) && score >= 0 && score <= 1,
  );
  // A layout projection is only a review aid. Raw detections remain unchanged.
  const text = geometryValid ? readingOrder(detections) : detections.map((detection) => detection.text).join('\n');
  return {
    ...metadata(source),
    status: text.trim() ? 'recognized' as const : 'empty' as const,
    reason: text.trim() ? 'ok' as const : 'empty' as const,
    text,
    detections,
    confidence: scoresValid ? Math.min(...detections.map(({ score }) => score)) * 100 : undefined,
    geometryValid,
  };
}

/** Serialize the installed singleton; cancellation discards results, not native buffers. */
export function createNativeOcrReader(load: () => Promise<Pick<OCRModule, 'forward'>>, available: () => boolean) {
  let queue: Promise<void> = Promise.resolve();
  return (source: string, signal?: AbortSignal) => {
    const run = queue.then(async () => {
      if (signal?.aborted) return nativeOcrFailure(source, 'cancelled');
      if (!source.trim() || !available()) return nativeOcrFailure(source, 'unsupported');
      try {
        const model = await load();
        if (signal?.aborted) return nativeOcrFailure(source, 'cancelled');
        const detections = await model.forward(source);
        if (signal?.aborted) return nativeOcrFailure(source, 'cancelled');
        return nativeOcrEvidence(source, detections);
      } catch {
        return nativeOcrFailure(source, signal?.aborted ? 'cancelled' : 'failed');
      }
    });
    queue = run.then(() => {}, () => {});
    return run;
  };
}

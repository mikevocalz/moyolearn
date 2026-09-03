'use client';
// The staged photo, re-encoded small enough to send to the coach — native.
//
// This exists because the on-device recogniser cannot encode what the page
// plainly shows. `OCR_ENGLISH`'s charset has no `÷` and no `×`, so `12 ÷ 4`
// reaches the tutor as `12 : 4`, `12 + 4`, or a gap — and a repair pass is not
// available, because `+`, `-` and `:` are all real arithmetic and rewriting a
// suspected misread would corrupt the problems it got RIGHT. So the model reads
// the notation itself, from the same photograph the child took.
//
// FORKED, though `expo-image-manipulator` ships a web implementation and one
// call would have covered both. Turbopack cannot bundle that package —
// `./node_modules/expo-image-manipulator/src/index.ts: Unknown module type` —
// so importing it anywhere the Next build can reach breaks `pnpm --filter web
// build`, which typecheck and lint both pass happily. It is the same trap
// `capture-screen` hit with expo-image-picker, and `privacy-process` is already
// forked for it. The web half does the same job with a canvas.
//
// `manipulateAsync` rather than a hand-rolled resize: it is the idiom
// `privacy-process.native` already uses in this folder.
// SOT: docs/pack/24-homework-capture-spec.md §3 · packages/inference/src/types.ts TurnImage
// SOT-KEYWORDS: capture photograph model image base64 resize vision coach ocr operators
import * as ImageManipulator from 'expo-image-manipulator';
import type { TurnImage } from '@acme/inference';

/**
 * The vendor's own ceiling: it downscales anything longer than 1568px on its
 * long edge before it looks at it, so a larger upload buys nothing and costs
 * the child's data plan. Going SMALLER is what would cost something — the whole
 * point of the photo is a `÷` two pixels different from a `+`.
 *
 * A source narrower than this is upscaled rather than left alone, which is a
 * few wasted kilobytes and no lost detail. Not guarded, because the capture
 * path caps every photo at 1600px (`privacy-process`) — the case needs a
 * second decode to detect and does not arise.
 */
const MODEL_IMAGE_MAX_WIDTH = 1568;

/**
 * JPEG, not the PNG `stripExif` writes. A 1568px worksheet is ~3 MB of base64
 * as PNG and ~250 KB as JPEG, over a phone connection, for a page of black ink
 * on white paper that no one will ever look at again. The compression artefacts
 * that would matter are at the stroke level and 0.7 does not reach them.
 */
const MODEL_IMAGE_QUALITY = 0.7;

/**
 * Returns null rather than throwing, and the caller sends the turn anyway.
 *
 * A photo the encoder cannot read costs the model its look at the operators —
 * the OCR text still went, the caveat still goes, and the coach falls back to
 * asking the child what the sign is. It must never cost the child their turn.
 */
export async function photographForModel(uri: string): Promise<TurnImage | null> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: MODEL_IMAGE_MAX_WIDTH } }],
      { format: ImageManipulator.SaveFormat.JPEG, compress: MODEL_IMAGE_QUALITY, base64: true },
    );
    if (!result.base64) return null;
    return { mediaType: 'image/jpeg', data: result.base64 };
  } catch (error) {
    if (__DEV__) console.warn('[photographForModel] could not encode %s:', uri, error);
    return null;
  }
}

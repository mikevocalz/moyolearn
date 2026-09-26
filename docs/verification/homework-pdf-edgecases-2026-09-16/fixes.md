# PDF fixes after the edge-case run

## Fixed behavior

- Inspect PDF image-painting operations even when a text layer exists. A printed header no longer prevents recognition of image questions.
- Preserve both the embedded text and the OCR candidate when the OCR candidate omits embedded text. Do not silently discard known questions or substitute corrected answers. Duplicate candidates may require editing during source review.
- Render OCR pages independently of document length, up to 3× PDF coordinates, a 2,400-pixel edge and 5 million pixels. The 20-page packet now uses the same 1,836×2,376 OCR raster as the isolated page. Small retained previews still share the document pixel budget; each large raster is disposed after recognition.
- Retain PDF-user-space regions alongside OCR-pixel regions and record OCR dimensions. Keep the original text layer when recognition uses OCR.
- Require explicit source comparison for every OCR page, unreadable page, and failed preview. A high average confidence does not excuse a potentially wrong operator. Editing invalidates the source check. The submit handler also enforces the gate.
- Provide an enlarged page preview and instructions for correcting missing handwriting, numbers, signs, and stacked fractions without changing the learner's original answers.

## Verification

- 673 app tests passed (568 regular + 105 server); all 19 cold type-check tasks passed.
- Browser corpus: 22 documents rerun with real PDF.js and Tesseract. `assert-fixes.mjs` checks ten conditions covering hybrid content preservation, required review, document completeness and OCR resolution.
- Actual `/capture` flow in Chrome: injected the hybrid PDF through the file-input change event, opened page review, observed both header and image equation, attempted blocked submission, confirmed source and observed submit enabled, edited and observed submit blocked again, enlarged the preview, re-confirmed and advanced to “Add a little info”. No tutor submission or persisted test homework. This tests the app flow, not the OS file-picker dialog.

## Remaining recognition limits

**This does not solve arbitrary handwriting or mathematical OCR.** The blurred fixture still produces `Solve 2+2+5`, and stacked fraction structure and handwritten marginal notes remain unreliable. They now require explicit comparison/correction before the review flow can proceed. Higher resolution cannot recover information absent from a photograph; Tesseract is not a mathematical handwriting recognizer. The gate records a learner's check, not independently verified mathematical correctness. Existing server assessment-readiness restrictions remain necessary. Native PDF rendering/model upgrades and durable page/region verification are separate unfinished work.

For a recognition-quality acceptance test, use a gold transcription with question/region boundaries and per-operator matching, not a page-average confidence or these routing assertions. Do not report the remaining accuracy cases as passes.

## Repeat the regression assertions

Start the harness using the commands in `README.md`. After `edgeQa.state` becomes `complete`, evaluate in that browser tab (replace the repository path if needed):

```js
const { assertPdfFixes } = await import('/@fs/Users/mikevocalz/MoyoLearn/scripts/qa/pdf/assert-fixes.mjs');
assertPdfFixes(globalThis.edgeQa);
```

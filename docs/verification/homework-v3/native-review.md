# Native homework evidence review — September 16, 2026

SOT: `prompts/ROSTER.md`, `docs/pack/24-homework-capture-spec.md`, installed native symbols cited below.
SOT-KEYWORDS: homework native review OCR evidence geometry resolution PDF compatibility

## Pre-implementation review

Native-rendering and TypeScript seats approved preserving the local image master and exposing existing installed OCR detections, with no new dependency. Learning-science review requires source mistakes to remain unchanged, source comparison even for a high detection score, and no inference that a partial PDF transcript establishes complete evidence. Privacy review distinguishes metadata stripping from face redaction and cropping; neither latter operation is implemented by this slice. Shared review-state changes belong to the parent integration.

## Implemented scope

- `privacy-process.native.tsx` re-encodes through the installed Expo image manipulator without a resize action. This preserves the decoded source resolution. It does not promise retention of every original container property, automatic face redaction, or a selected privacy crop. Keeping more pixels increases native decode/encode memory; no device performance measurement has been made.
- `read-attachment.native.ts` exposes `readAttachmentEvidence`, retaining raw detection text, boxes and scores. Its compatibility `readAttachment` returns the text projection. One model remains serialized across callers.
- Geometry is explicitly `executorch-decoded-image-pixels`; the transform to an original master is **unverified**. Boxes are retained even when invalid; invalid geometry is not used to construct reading order. No word quadrilateral or symbol score is fabricated.
- Review confidence is the minimum valid detection score multiplied by 100. It is a review signal, not page correctness probability, coverage, a token score, or approval for assessment. Any missing/nonfinite/out-of-range score leaves it unavailable. Every recognized result requires explicit source comparison.
- Runtime unavailable, blank, error and cancellation have explicit statuses. Cancellation skips queued work or discards the in-flight result; it cannot interrupt native `forward` or an active model download. This is not the cross-feature resource scheduler required by V3.
- Native PDF transport explicitly returns unsupported until a real page renderer is installed. It cannot pass the legacy unordered stream transcript to review as a complete reading. The shared manual-entry path remains available; DOCX and plain text retain their existing readers.

## Installed-symbol evidence

- `react-native-executorch` package version **0.9.3**.
- `src/index.ts`: `isAvailable`, `OCRModule`, `OCR_ENGLISH`, model registry exports.
- `src/modules/computer_vision/OCRModule.ts`: `fromModelName`, `forward(imageSource)`, `delete`.
- `src/types/ocr.ts`: `OCRDetection` consists of axis-aligned `bbox`, `text`, `score` (0–1).
- `common/rnexecutorch/models/ocr/RecognitionHandler.cpp:57`: detector padding/scale are removed to match the decoded original image. This does not verify app crop/EXIF transforms.
- `src/constants/ocr/symbols.ts`: English alphabet excludes division and multiplication glyphs; English-only OCR remains a capability limitation.
- `react-native-vision-camera` **5.2.3**, Nitro Modules **0.37.0**; retain `patches/react-native-vision-camera.patch` when changing native dependencies.

## Research corrections and dependency review

[Bear Block PR 14](https://github.com/bear-block/vision-camera-ocr/pull/14) added static-image OCR. Registry inspected September 16: stable dist-tag 4.0.3, beta 5.0.0-beta.5. Actual published beta.4 tarball lacks required `nitrogen/generated` files; beta.5 includes them. No Bear Block integration was installed in this slice.

Both examined prereleases declare Nitro `^0.35.10` as a direct dependency, which excludes Moyo's 0.37.0. Resolve this before installation to avoid duplicate Nitro runtimes. Their live native implementations ignore the supplied orientation (iOS `.right`, Android 90 degrees). Static iOS handles EXIF. iOS boxes are normalized Vision bottom-left rectangles; Android boxes are top-left pixels. iOS returns one synthetic block, line observations and no words. An adapter must normalize these facts without inventing equivalent granularity. The Swift request does not expose language configuration or explicitly disable language correction; a reviewed patch is necessary for source-preserving use. Sources: [registry](https://registry.npmjs.org/@bear-block%2fvision-camera-ocr), [Swift implementation](https://github.com/bear-block/vision-camera-ocr/blob/support/v5/ios/HybridOcrProcessor.swift).

ExecuTorch registry currently marks 0.10.2 latest and 0.9.3 legacy. The [new OCR pipeline](https://docs.swmansion.com/react-native-executorch/docs/extensions/optical-character-recognition) uses PP-OCRv6 and oriented quads; those APIs are not the installed 0.9.3 interface. An upgrade requires a separate migration and benchmark.

Installed 0.9.3 already exports Qwen 3.5 text presets in `src/constants/modelRegistry.ts:533–534`. Versioned v0.9.0 artifact URLs responded HTTP 200 to HEAD requests: 0.8B 1,412,986,112 bytes; 2B 3,012,643,072 bytes. No weights were downloaded. Installed presets lack a vision capability flag. The [current model card](https://huggingface.co/software-mansion/react-native-executorch-qwen-3.5) lists additional VL exports, but targets ExecuTorch 1.4.1 and warns about older-runtime incompatibility. Exports exist; successful Moyo loading, accuracy and memory budgets are not established.

Gemini Nano learner routing remains denied without reviewed authorization under the [ML Kit GenAI terms](https://developers.google.com/ml-kit/genai-terms). This does not establish an identical restriction for ordinary ML Kit Text Recognition.

## Validation and remaining limits

Seven pure tests cover raw source/error preservation, geometry and confidence semantics, unsupported runtime, serialization after failure, cancellation during inference and while queued, native PDF magic/MIME rejection, and unaffected text imports. Run with Node24:

```sh
node --test packages/app/features/capture/native-ocr-evidence.test.ts packages/app/features/capture/native-document-policy.test.ts
```

These tests do not run an OCR model. No app build, camera test, physical device benchmark, or multilingual recognition evaluation was performed by this review. Still required: native PDF rendering, Bear Block build/integration, EXIF8-orientation tests against actual native readers, page/crop/master transforms, multi-column/RTL/formula structure, full scheduler/account-switch lifecycle, and physical release memory/thermal/latency measurements. Current minimum-score review is not calibrated as critical-symbol false-accept probability.

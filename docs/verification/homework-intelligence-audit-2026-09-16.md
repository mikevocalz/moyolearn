# Homework intelligence: audit, research, and baseline

Date: 2026-09-16. This records the **pre-implementation baseline**. See [the subsequent implementation checkpoint](./homework-implementation-2026-09-16.md) for changes and checks; native comparative benchmarks remain open.

This report follows the supplied master-build brief. Application code and dependency versions have not been changed. The benchmark script is research tooling, not a new OCR implementation. UX/Mobbin research, the architecture proposal, implementation, and device QA have not yet been completed; they follow the benchmark in the requested sequence.

## Repository and environment

- Audited checkout: `c7865f0`, initially `feat/spatial-whiteboard-xr`; research continues on `feat/homework-intelligence`.
- Fetched `origin/main`: `2c06a96`. Both main and this checkout declare Expo 57.0.15, React Native 0.86.2, React 19.2.8, VisionCamera 5.2.3, Nitro 0.37.0, ExecuTorch 0.9.3, Expo resource fetcher 0.9.1. Installed Expo/RN/ExecuTorch package versions were also checked.
- Worklets: 0.10.1. iOS app deployment target: 17.0. Node 24 is the repository-compatible host runtime.
- ExecuTorch initialization is in `apps/mobile/src/executorch.native.ts`; it registers the Expo resource fetcher before component hooks mount. Removing this while migrating only OCR would also affect speech recognition.
- The public ExecuTorch compatibility table stops at RN 0.85. A broad peer range is not proof of RN 0.86 / Expo 57 compatibility.
- At inspection, Argent had no connected usable USB phone and no Android target. Paired phones without a usable transport do not establish a test environment. No native model inference or physical capture was performed.

## Lifecycle audit

Paths below are relative to the repository root. Findings describe executable code, not promises in comments.

| Stage / entry | Current implementation | Evidence loss or correctness issue |
| --- | --- | --- |
| Dedicated capture | `packages/app/features/capture/capture-screen.tsx`, `types.ts` | Pages have ID, URI, and kind, but no recognition status, region graph, original/cropped revisions, or language context. |
| Live camera | `guided-frame.native.tsx`, `realtime-hints.store.ts` | Closer/steady/light/glare hints cycle from elapsed time. No image measurements drive them. Camera activity is not tied to foreground/focus here. |
| Native crop | `crop-preview.native.tsx` | Confirmation always removes the outside of a fixed central rectangle: x=10%, y=25%, width=80%, height=50%. No detected polygon or draggable corners. |
| Web crop | `crop-preview.tsx` | Passes through the full source; explicitly says cropping is app-only. |
| Camera sheet | `CameraSheet.native.tsx` | Reuses GuidedFrame/crop, including their limitations. Preprocessing can run before crop and replace the source URI. |
| Gallery | `features/schedule/pick-note-image.native.ts` | Single selection, quality 0.8. The capture feature retains only a reduced page object. |
| File picker | `features/editor/pick-file.native.ts`, `.web.ts` | Native uses filesystem picker. Web creates a blob URL. Name survives picker return, but capture reduces the source to URI/kind; MIME can later be guessed incorrectly. Blob URLs alone are not durable across reloads. |
| Image processing | `privacy-process.native.tsx` | Resizes width to 1600 and re-encodes PNG. Does not retain a transform chain or original-image reference; small images may be enlarged. |
| Native attachment OCR | `read-attachment.native.ts` | A serialized singleton CRAFT/CRNN `OCR_ENGLISH` module; returns a flattened string. Errors become empty strings. Geometry/confidence/model evidence is lost. |
| Native review OCR | `ocr-review.native.tsx` | Separate hook/model lifetime. Joins detections into text and averages scores. Loading can take precedence over model errors; hook errors can also prevent the manual phase from rendering. |
| Reading order | `reading-order.ts` | Groups overlapping boxes into left-to-right lines. No language-aware bidi/column/structural model. It discards boxes in its result. |
| Web OCR | `ocr-web.ts`, `ocr-review.tsx` | English Tesseract worker per call; metadata reduced to text/page confidence. Any nonempty output is accepted. Empty output still invokes whole-page TrOCR despite comments saying it does not. |
| Multipage capture | `capture-screen.tsx` | Only `pages[0]` reaches OCR review. A first-page file bypasses that review. Later pages upload but do not become structured tutor evidence. |
| Typed input | `capture-screen.tsx`, `DigitizedTextReview` | Reviewed text becomes one problem string. Source modality/provenance is not retained as a structured document. |
| Voice | `transcribe.native.ts`, `.web.ts`, capture voice review | English-only Whisper configurations. Native module loading is not a shared in-flight promise; web builds a pipeline per call. Both return empty text on failure. Voice evidence is not represented as a recognition revision. |
| Upload | `features/media/upload-queue.store.ts`, `upload-queue.shared.ts`, platform drains | Persisted retry queue and retention clock exist. Capture waits for successful transfer rows and provides retry on failures. This is upload status, not proof that all pages were read. Queue metadata does not persist recognition evidence. |
| Tutor staging | `features/tutor/tutor-screen.tsx`, `packages/ui/tutor-attachment.ts` | Separate image/document/audio paths. Four-image cap is incompatible with the requested ten-page document; the store refuses excess images. |
| Tutor send | `tutor-screen.tsx:380` onward | Filters empty image/document readings; surviving text gets new positional labels. The first surviving reading becomes the problem, but `images[0]` supplies the photograph—even if a different image supplied that reading. |
| Tutor persistence | `tutor-screen.tsx:536` onward, tutor store/session paths | Transcript attachment IDs and upload linkage exist. There is no linked OCR region/revision graph. The generated next-problem path uses `setProblem(data.problem)` without the OCR flag, appropriately for a served problem. Server session records do not carry a region/revision graph. |
| PDF/DOCX/text | `read-document.ts`, `read-document-at.ts` | PDF stream regex ignores page trees, font mappings, rotations, and layout. DOCX regex strips XML and decodes UTF-8 bytes as Latin-1. Plain UTF-8 text is also corrupted. `readDocumentAt` discards the structured reason and returns a string. |
| Tutor inference | `coach.service.ts`, `tutor.store.ts`, `packages/inference/src/*` | OCR flag adds a prompt caveat. It is not an assessment gate. Only one image enters the inference payload. No local Qwen homework semantics implementation was found; the capabilities comment is not evidence of one. |
| Image egress | `photograph-for-model.native.ts`, inference `pseudonymize.ts` | The first photo is resized/recompressed and sent through the model gateway. Text redaction does not redact its pixels. Existing comments claiming capture never leaves the device are incomplete. |
| Evaluation request | `tutor-screen.tsx:345`, `apps/web/app/api/tutor/evaluate/route.ts` | Only problem, answer, and hintDepth travel to evaluation. Neither OCR origin nor source readiness is supplied. |
| Evaluation/student model | `tutor.service.ts`, tutor store `respond`, `packages/student-model/src/distill.ts` | Safety-plane storage permission and arithmetic parsability gate storage, but source uncertainty does not. An OCR error can become a graded turn. Client offline arithmetic fallback can update local mastery too. Distillation skips unstorable turns, but OCR-derived turns are not marked unstorable on that basis. |

### Highest-priority invariants missing today

1. A page must remain present when reading fails, with its ID and actionable status.
2. A photograph, extracted text, and assessment must reference the same source revision.
3. Unresolved source evidence must block grading, incorrect-answer events, mastery, and misconception updates at the server and offline client boundaries.
4. Cropping must preserve the original and record the transform; confirmation cannot silently discard fixed margins.
5. Recognition must preserve a student's incorrect wording and calculations. Semantics and corrections belong in separate, traceable records.

## Bear Block v5 source inspection

Inspected [support/v5 at commit 3282113](https://github.com/bear-block/vision-camera-ocr/tree/328211315fc04e935added52e1d25b12d19e9a59), including Nitro spec, TS wrapper, Swift, Kotlin, C++ buffer bridge, Gradle/podspec, and tests. Package identifies itself as `5.0.0-beta.1`.

- The Nitro call accepts a raw buffer address, dimensions, orientation, and recognition options. Frame ownership stays with the caller. Its sample releases the buffer/disposes the frame only on the normal path; Moyo needs nested `finally` cleanup on every path.
- Swift borrows a `CVPixelBuffer` without retaining ownership and synchronously performs Vision recognition. Frame orientation is ignored: handler uses `.right`. Static images instead inspect EXIF orientation.
- Swift returns Vision normalized rectangles with bottom-left origin, line confidence, no words, and one aggregated block. It does not expose candidate alternatives, per-character confidence, language selection, or language-correction control.
- Kotlin constructs the Latin ML Kit recognizer only (`text-recognition:16.0.1`). Neither other script recognizers nor per-region language output are configured. Calling this build universally multilingual would be incorrect.
- Android's frame path ignores orientation and uses 90 degrees. Boxes are pixel rectangles, unlike iOS. ML Kit corner points are not surfaced. `recognitionLevel` has no Android effect.
- Android locks hardware-buffer planes, copies YUV into a new NV21 byte array, and waits synchronously on the recognizer under a lock. This is neither zero-copy nor a bounded scheduling policy by itself.
- The C++ path assumes three planes and shares U/V stride values; it does not validate the plane count, incoming dimensions, or the byte-array mapping result before access. Locks are released on ordinary success and allocation failure, but caller lifetime discipline remains essential.
- Native frame errors on Android become null, then the TS wrapper converts null to an empty result. This conflates no text and processing failure. Static-image errors reject.
- Static OCR accepts file paths on iOS and file/content URIs on Android. iOS uses a serial static-image queue; Android uses a parallel promise plus a synchronized recognizer. No explicit recognizer-close lifecycle is exposed.
- Tests mock the Nitro object. They verify parameter forwarding and empty-result normalization, not real buffer lifetime, native rotation, geometry alignment, or recognition accuracy.
- It declares Nitro both as a peer `>=0.27.0` and direct dependency `^0.35.10`; Moyo uses 0.37.0. Deduplication/native linkage must be verified before adding it. Android CMake requests API 29, which must be reconciled with the app's actual minimum.

**Disposition:** candidate fast capture sensor, not authoritative homework transcription. Requires orientation/geometry/ownership corrections and device validation before integration. Text coverage is not a document contour; its boxes alone cannot prove all page corners are visible, glare, exposure, blur, or motion.

Apple exposes [recognition configuration](https://developer.apple.com/documentation/vision/vnrecognizetextrequest) and [language correction](https://developer.apple.com/documentation/vision/vnrecognizetextrequest/useslanguagecorrection). Source-preserving recognition should explicitly disable correction and query supported languages for the actual recognition level/OS; the current wrapper exposes neither control. Android requires the [appropriate script-specific ML Kit recognizer](https://developers.google.com/ml-kit/vision/text-recognition/v2/android), not just a language label. Its [language matrix](https://developers.google.com/ml-kit/vision/text-recognition/v2/languages) is not a claim that this wrapper installs every recognizer.

## ExecuTorch / PP-OCRv6 research

Inspected release [v0.10.0, commit ed59957](https://github.com/software-mansion/react-native-executorch/tree/ed59957bb2978a3fdf9718c1227c762998ae5a58), released September 8. This is a real API migration from installed 0.9.3, not a model-name substitution.

- [OCR extension](https://docs.swmansion.com/react-native-executorch/docs/extensions/optical-character-recognition): `createPaddleOcr` / `useOpticalCharacterRecognizer`; registry `models.ocr.PADDLE.PPOCRV6_SMALL` with XNNPACK, Core ML, Vulkan variants.
- `recognizeCharacters(ImageBuffer, options)` returns text, mean character confidence, and an oriented pixel quad. It does **not** return individual critical-token confidence or mathematical syntax. Unknown token confidence must remain unknown, not be invented from the region average.
- The default region confidence cutoff is 0.5. For evidence collection, retain low-confidence candidates rather than silently dropping them; threshold-zero still does not disable the detector's internal candidate/box filtering.
- Pipeline resources expose `dispose()`. New downloads use the new downloader and blob-util; the existing Expo resource-fetcher initialization is a legacy concern. OCR, Whisper, and any local LLM must be migrated coherently or deliberately kept behind supported legacy imports.
- The inspected package adds `react-native-blob-util ^0.24.0` and requires Worklets `^0.10.0`. Moyo's worklets version fits, but native builds/Metro exports remain unproved. iOS podspec declares 17.0, while this particular Core ML OCR export requires iOS 18+. XNNPACK is a necessary candidate for older supported iOS devices.
- The [compatibility table](https://docs.swmansion.com/react-native-executorch/docs/other/compatibility) does not list RN 0.86. Android README guidance and Gradle's fallback minimum are not consistent enough to infer a supported floor; verify built ABI/minimum-OS artifacts rather than adopting the README number blindly.
- [Camera integration](https://docs.swmansion.com/react-native-executorch/docs/extensions/camera-integration) uses v5 frame outputs, worklets and explicit disposal. Drop frames while busy, throttle analysis, and map orientation/aspect-fill transforms explicitly. Native buffers are preferred where supported; a YUV/resizer conversion is a deliberate alternative, not a reason to cast native buffers to RGB.
- PP-OCRv6's upstream [language/version matrix](https://github.com/PaddlePaddle/PaddleOCR/blob/main/docs/version3.x/pipeline_usage/OCR.en.md) distinguishes the unified model from the wider Paddle ecosystem. Do not claim Arabic/Urdu support from a general “100+ languages” banner. Text OCR also does not establish fraction/table/diagram understanding.

### Qwen capabilities and model budget evidence

Installed 0.9.3 already exports `QWEN3_5_2B_QUANTIZED` and `models.llm.qwen3_5_2b`. Its config supplies model/tokenizer paths and **no vision capability**. The shipped accessor is text-only; use it after OCR for region-referencing semantics if it passes the benchmark. Do not add `capabilities: ['vision']` to pretend a different export is supported.

The inspected 0.10.0 release retains those Qwen3.5 definitions under `react-native-executorch/legacy`; the new primary registry does not expose an equivalent Qwen3.5 accessor. Multimodal files existing on Hugging Face do not prove a complete supported Moyo runtime pipeline.

The following are **remote artifact byte counts**, queried from the publisher's Hugging Face tree API on this date. They are not measured installed cache sizes, download times, peak RAM, or inference latency.

| Artifact | Revision | Bytes |
| --- | --- | ---: |
| Qwen3.5 0.8B text 8da4w PTE | v0.9.0 | 1,412,986,112 |
| Qwen3.5 2B text 8da4w PTE | v0.9.0 | 3,012,643,072 |
| Qwen3.5 2B vision PTE, not a proved accessor | v0.9.0 | 4,334,632,448 |
| Qwen tokenizer, per variant | v0.9.0 | 12,807,982 |
| Qwen tokenizer config, per variant | v0.9.0 | 16,709 |
| PP-OCRv6 Small XNNPACK int8-detector PTE | v0.10.0 | 23,890,904 |
| PP-OCRv6 Small XNNPACK fp32 PTE | v0.10.0 | 31,066,200 |
| PP-OCRv6 Small Core ML PTE | v0.10.0 | 8,269,910 |
| PP-OCRv6 Small Vulkan PTE | v0.10.0 | 26,176,856 |
| PP-OCRv6 charset | v0.10.0 | 131,078 |

Sources: [Qwen revision files](https://huggingface.co/software-mansion/react-native-executorch-qwen-3.5/tree/v0.9.0), [OCR revision files](https://huggingface.co/software-mansion/react-native-executorch-pp-ocrv6/tree/v0.10.0). Filenames describe detector precision; the XNNPACK int8 OCR export retains an fp32 recognizer. Do not calculate runtime RAM from parameter-count marketing or the PTE size.

Formal budget must separately record base app bytes, installed models/cache, temporary download/compile space, peak/steady RSS, cold and warm load, p50/p95 inference, battery drain and thermal state. **All device measurements remain unmeasured.** No model is approved for mandatory bundling. Candidate policy to evaluate later: a small OCR baseline, one on-demand semantic model, serialized heavy-model lifetimes, persistent versioned caches, no eviction of a loaded model, disk-space checks before download, and cancellation/recovery. The 2B artifact makes these controls essential.

## Specialist recognition and file parsing research

- [Mathpix image OCR privacy](https://docs.mathpix.com/concepts/privacy): service-improvement sharing defaults on; any permitted integration must explicitly disable it. [Retention differs by endpoint](https://docs.mathpix.com/concepts/data-retention), so a PDF job must not inherit claims made for image endpoints. No student data was sent and no paid benchmark was run.
- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) separates text OCR, structured parsing and document VLMs. Neither its hosted TypeScript SDK nor its desktop Python pipeline is proof of an on-device RN document recognizer. Compare specialist output as a candidate with source provenance, never as a silent replacement.
- [PDF.js](https://mozilla.github.io/pdf.js/examples/) provides page-level text/rendering and viewport transforms for web. Preserve page identities, text items and font/rotation transforms; rasterize only pages/regions that need OCR. A PDF.js browser worker/canvas cannot simply be imported into Hermes. Native PDFKit/Android PdfRenderer or a proven native adapter needs a separate implementation and build test.
- [Mammoth](https://github.com/mwilliamson/mammoth.js) is an OOXML-aware candidate for common DOCX structure, including paragraphs/lists/tables/images. It is not a complete OMML/layout fidelity guarantee and its HTML output must not be trusted or rendered unsanitized. Structured OOXML parts/relationships and math evidence must be retained independently. No final parser dependency was selected.

## Shared internationalization research

No existing common i18n provider or full set of independent homework-language fields was found in the audited product paths.

| Candidate | Fit for this repository | Validation still needed |
| --- | --- | --- |
| i18next + react-i18next | Shared RN/web hooks; request-specific SSR instances; namespaces/lazy loading; typed keys; explicit fallback chain. Avoids a mandatory compiler macro across Metro, Next and Vite. | Locale catalog bytes, interpolation/plural/select strategy, hydration isolation, Hermes Intl support. |
| Lingui | ICU messages, extraction, compiled catalogs, RN support, Metro/SWC/Vite tooling. Strong translator workflow. | Consistent transformer setup across all three build surfaces; version-compatible plugins; actual compiled bundle size. |
| FormatJS/react-intl | ICU plural/select and shared React provider; supported RN/Hermes path. | Required Intl APIs/polyfills, extraction setup, ESM behavior, actual locale payload cost. |

Sources: [react-i18next SSR](https://react.i18next.com/latest/ssr), [i18next TypeScript](https://www.i18next.com/overview/typescript), [Lingui RN](https://lingui.dev/tutorials/react-native), [FormatJS Hermes](https://formatjs.github.io/docs/guides/react-native-hermes/), [Expo localization](https://docs.expo.dev/guides/localization/). Current Expo docs discuss SDK 58 behavior too; Moyo is SDK 57, so use the installed/versioned API when implementing.

Provisional preference for later architecture evaluation: i18next/react-i18next, because this repo spans three bundlers. This is a fit assessment, not a measured bundle-size win. Keep interface, student, tutor, course, assignment, OCR, expected-answer and guardian language independent. Store BCP 47 tags, region-level language/script evidence and explicit overrides. Resolve UI fallback deterministically; never derive OCR language solely from interface locale. Test Arabic/Urdu and bidi math without mirroring source pixels.

## Executed baseline

Run from repo root with Node 24:

```sh
node scripts/benchmarks/homework-baseline.mjs /tmp/moyo-homework-baseline
```

The script renders six synthetic printed fixtures and executes the repository's current `readPrinted()` three times per fixture. It also feeds the exact UTF-8 source into current plain-text and minimal DOCX parsers. It writes source PNG/TXT/DOCX files and raw JSON outside the repository. The math and Arabic raster fixtures were visually inspected for visible glyphs. This is a diagnostic corpus, not an accuracy qualification dataset.

See [raw run](./homework-baseline-2026-09-16.json) and [the actual math fixture](./homework-baseline-2026-09-16/critical-math.png). All six input PNGs are saved beside it and SHA-256-linked from the run. Each OCR call creates and destroys a worker, as production does today. These are macOS Node/WASM timings, not browser/phone performance, and do not include camera capture, realistic glare or handwriting. First-run asset/cache effects are not controlled; three repetitions do not support a meaningful p95.

| Input | Observed current output / result |
| --- | --- |
| `2 + 2 = 5` | OCR retained the incorrect answer but removed spaces. Do not count formatting differences as semantic math errors. |
| `Yo tieno dos hermanos.` | OCR and document parsing preserved the student's error. |
| `¿Cuántos lápices?` / `12 ÷ 4 = 3` | OCR lost accents and read division as addition. Plain-text and DOCX parsers corrupted UTF-8 but returned `reason: ok`. |
| Critical math sheet | Division became addition; superscripts lost structure; `1/(x + 1)` lost part of the expression. |
| Arabic / Urdu | English OCR returned unrelated Latin/punctuation strings; both document parsers corrupted UTF-8. |

### Benchmark gate: outstanding

No comparative accuracy, memory, thermal or device-latency claim is justified yet. Required next evidence:

1. Connected USB iPhone and Android device with usable native development builds.
2. Current CRAFT baseline versus PP-OCRv6 Small XNNPACK/fp32, Core ML on supported iOS, and Vulkan on supported Android, using the same source corpus. Native dependency migration must first build in an isolated benchmark configuration; no production upgrade is approved by research alone.
3. Synthetic and consented non-private handwriting, critical-symbol, fraction/table/diagram, multilingual, rotated/glare/blur, mixed-PDF, DOCX/OMML, and 1/2/10-page cases. Record exact source/revision and failure status for every page.
4. Qwen text semantic-reference validity, source-copy fidelity, hallucinated region-ID rejection and question-group accuracy, plus actual load/download/RAM budget. Its result cannot overwrite OCR.
5. Orientation matrix and leak/backpressure checks for camera-time OCR; measured quality signals must be evaluated independently of text recognition.

After that gate: conduct the requested Mobbin flow research, propose architecture using measured results, implement, run automated tests, profile physical devices, and perform visual QA. No claim of completing those phases is made here.

## Repository checks

`pnpm typecheck --force` completed successfully: 19 tasks, zero cached results. The baseline runner completed 18 OCR calls and 12 document extractions; saved image hashes match the JSON record. No application changes, dependency upgrades, native benchmark results, or implementation-completion claims are included.

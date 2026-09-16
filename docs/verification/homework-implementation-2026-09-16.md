# Homework rebuild: implementation checkpoint

Branch: `feat/homework-intelligence`. This is a source-preservation and assessment-safety checkpoint, not the completed master build.

## Implemented

- Removed timer-generated camera quality claims. Camera capture now has a duplicate-shutter guard, error feedback, foreground lifecycle control, and gallery/cancel exits when camera access is unavailable.
- Removed automatic fixed-margin cropping. Native review preserves the full page and supports rotate/reset/retake/confirm with failure recovery. Four-corner detection and perspective editing are not implemented yet.
- Unified native/web OCR review lifecycle. Native review reuses the serialized attachment reader instead of loading a second model. Loading/failure both offer manual entry and cancellation; source changes invalidate late results. Empty confirmation is disabled.
- Dedicated capture reviews every page in order, including documents. Image sources stay visible above the reading. File extraction failure offers manual entry rather than silently skipping the source.
- Tutor context retains a labeled entry for each unreadable image/document. All source readings participate in the problem context. The provider still receives only one photograph; the multi-image contract remains outstanding.
- UTF-8 TXT/DOCX extraction preserves multilingual text. This fixes decoding, not the larger PDF/OOXML parser limitations.
- Whole-page TrOCR fallback is removed. It remains callable as a separate line-recognition function.
- Missing/unresolved source readiness returns no grade from the authenticated evaluation service and writes no assessment transcript or distilled facts. Client recognition paths skip evaluation before the offline fallback. Legacy locally stored problems without an explicit origin marker fail closed; typed/generated origins persist explicitly.

## Validation

- `pnpm typecheck --force`: **19/19 successful, zero cached**.
- `pnpm --filter @acme/app test`: **542 normal tests + 105 server tests passed**.
- New tests exercise multilingual UTF-8, student-error preservation, legacy source migration, readiness combinations, and the authenticated evaluation service's no-write path.
- [After-change diagnostic baseline](./homework-after-2026-09-16.json): all six expected source strings survive both text and DOCX extraction. OCR output still demonstrates the original math/script failures. Eighteen OCR calls are a reproducibility check, not a representative accuracy benchmark.
- iOS simulator build attempted using existing workspace/pods. Corrected an ignored generated `.xcode.env.local` entry pointing to a removed Node 26 executable. Build then failed at `RNSentry.h` importing missing `Sentry/Sentry.h`. No native visual/camera QA is claimed.
- Physical native model/thermal/latency benchmarks remain unavailable: no usable connected iPhone or Android target was present.

## Important limitations

The readiness field is a transitional client declaration, not server-validated region evidence. Recognized homework remains ungraded even after the current text review, because that review does not establish verified critical-token/structural evidence. Conversational tutoring continues. A durable server-owned document/region/revision model and targeted source confirmations are still needed.

The existing models remain pinned. PP-OCRv6, Bear Block camera-time OCR, Qwen semantic inference, measured camera CV, automatic polygon detection, perspective correction, proper page-aware PDF/OOXML parsing, model cache/budget enforcement, full i18n/RTL rollout, and specialist-policy routing are **not implemented or validated in this checkpoint**. The architecture and research documents describe the required direction, not completed features.

## Document parser follow-up

The DOCX path now uses pinned `@xmldom/xmldom` 0.9.12 rather than XML tag-stripping. It resolves the package's main document relationship, understands Word/Office Math namespaces (including alternate prefixes), preserves paragraph/table-cell order and Unicode, and projects fractions, roots, subscripts and exponents with explicit grouping. The returned reading retains each equation's XML separately. Unhandled equations, embedded content, fields, tracked changes, automatic numbering and note references produce source-review notices. External relationships are never fetched. DTDs, malformed XML, oversized XML parts and oversized documents fail closed.

This is **main-body extraction**, not a Word layout engine: it does not paginate DOCX, render embedded media, resolve note/header/footer content, or reproduce all OMML layouts. Those limitations remain visible in source-review notices where referenced. The legacy PDF stream parser is unchanged and still requires replacement.

Native picked documents now use Expo `File.bytes()`; browser/remote sources use fetch. The shared boundary retains failure/unsupported/empty/scanned reasons, and capture review shows specific messages. Plain text no longer collapses source indentation or blank lines. All recognized documents still remain behind the unresolved-assessment gate.

Sources consulted for these changes: [xmldom parser documentation](https://github.com/xmldom/xmldom), [0.9 parser error handling](https://github.com/xmldom/xmldom/discussions/435), and [Expo File API](https://docs.expo.dev/versions/latest/sdk/filesystem/), checked against installed Expo 57 source declarations.

The missing Sentry framework was a broken cache reference under `Pods/sentry-xcframeworks/9.24.0`. Running the installed SDK's `ensure_sentry_xcframework("9.24.0")` restored the checksum-verified binary without changing Sentry versions or tracked iOS configuration. The build passed the former missing-header failure; its final outcome is recorded below.

Follow-up checks: **657 tests passed** (552 normal + 105 server), and **19/19 cold typecheck tasks passed with zero cache hits**. Logs: `/tmp/moyo-homework-docx-tests-final.log` and `/tmp/moyo-homework-docx-typecheck-verified.log`. Tests cover namespace-aware tables, equations and raw equation XML, package relationships, malformed XML/DTD rejection, tracked changes, native transport boundaries, Unicode, whitespace and student mistakes. These are synthetic fixtures, not a representative teacher-document accuracy benchmark.

## Native validation and source-entry corrections

- **Native Debug build succeeded** for iPhone 17 Pro simulator / iOS 26.4 after restoring the Sentry cache. Installed and launched through Argent; the capture entry screen rendered.
- **iOS production export passed**, producing a Hermes bundle in `/tmp/moyo-homework-docx-export`.
- Simulator QA exposed an additional source-corruption bug: keyboard entry of `2 + 2 = 5` became `2 + 2 =4 5` with the native control's default correction settings. The shared Expo input bridge had discarded `autoCorrect` and `autoCapitalize`. These now reach native controls; the web bridge maps correction settings to DOM attributes. Homework typing and review explicitly disable correction/capitalization.
- Both source-entry forms now compose the existing `KeyboardAwareScroll`, with actions immediately below the field. The previous bottom-aligned Done button was hidden behind the keyboard. Verified the final review text, full field and confirmation controls with keyboard open; confirmation reached “Your work is ready.” No tutor submission or assessment was made in this test.
- A synthetic DOCX was created in the running app's cache, read by the actual native `readDocumentEvidenceAt` / `File.bytes()` path, and deleted in `finally`. Result: `{ reason: "ok", text: "2 + 2 = 5\nحل ٣ + ٢", equations: [] }`. This is an iOS runtime integration check, not file-picker or physical-camera QA.
- Final keyboard changes passed **19/19 cold typecheck tasks**, zero cached (`/tmp/moyo-homework-keyboard-typecheck-final.log`). The 657 app tests passed for the parser/transport commit; keyboard behavior was checked in the running simulator.
- Runtime logs recorded eight Natalie preload GLTF texture failures (`baseColor`, `specular`, `normal`, `metallicRoughness`) and a Blob-copy warning. These remain unresolved; this is not a clean avatar/XR validation.

Evidence: [before: altered text and hidden Done](./homework-native-2026-09-16/typing-before.png), [after: preserved text and keyboard-visible review](./homework-native-2026-09-16/review-keyboard-after.png), [completed typed review](./homework-native-2026-09-16/ready-after.png). Screenshots are from a simulator with synthetic input. Physical OCR/model benchmarks, multipage camera QA, persistent region revisions and page-aware PDF parsing remain outstanding.

Final source-entry layout retest: [typing with keyboard open](./homework-native-2026-09-16/typing-after.png) preserves `2 + 2 = 5` and exposes Done. Final iOS production export also passed (`/tmp/moyo-homework-keyboard-export.log`). Simulator test input was abandoned without submitting it to the tutor; temporary DOCX and runtime test globals were removed.

## Browser PDF checkpoint

Browser file reading now uses PDF.js 6.3.289 with a version-matched, self-hosted
worker, CMaps, standard fonts, and WASM codecs. Assets are copied by the Next.js
dev/build scripts. Native document reading does not load PDF.js.

- Follow the actual PDF page tree, retain page numbers, text-item transforms,
  dimensions and direction, and keep blank/failed pages in the result.
- Render each page independently; failed text extraction can still yield a
  preview. Preview failure does not erase successfully extracted text, and
  cleanup failure does not discard page evidence.
- Run the existing English Tesseract reader on pages without usable text,
  retaining line boxes/confidence in preview-pixel coordinates. PDF text regions
  explicitly use PDF user-space coordinates.
- Review every PDF page separately alongside its preview. A page with no text
  cannot be confirmed normally; a visible original allows explicit learner
  confirmation that it has no work, recorded as a page-specific marker.
- Page preview and editable text share one scrolling container. File labels and
  original filenames distinguish attachments from pages within a PDF.
- Bound inputs to the existing 32 MiB limit and 100 PDF pages; refuse oversized
  page counts instead of truncating. Preview rasterization is capped at 1,200
  pixels per edge, 1.44 million pixels per page, and 12 million pixels divided
  across the document. These are workload bounds, not measured peak-RAM claims.

### Verification

- App tests: **559 regular + 105 server = 664 passing**. Seven new PDF tests use
  the actual PDF.js parser: 1/2/10-page trees whose logical order differs from
  object order, blank middle pages, failed pages, failed text extraction with
  surviving previews, cleanup failures, and over-limit rejection.
- Cold repository typecheck: **19/19 successful, zero cached**.
- Chrome 152, Argent CDP, isolated Vite harness importing the production reader:
  1/2/10-page extraction and PNG rendering passed with the self-hosted worker.
- Actual Next.js `/capture`: two-page file reviewed in order, both previews
  loaded, and original mistakes `2 + 2 = 5` and `4 + 4 = 9` remained unchanged.
- Mixed three-page PDF: text page, JPEG scan, and blank page all reached review.
  Tesseract returned `Solve2+2=5` from the scan (spaces were lost), with one line
  region. The original preview remained visible. Explicitly confirming the blank
  third page advanced to “Add a little info.” No tutor submission or save was
  performed. File selection used a synthetic File/DataTransfer injected into
  the picker; the OS file dialog itself was not tested.
- Browser verification exposed a pre-existing ButtonBase crash: spreading a
  style array into an object produced numeric CSS properties. Passing the array
  through the existing recursive DOM decoder fixed the crash; capture and menu
  buttons then rendered and worked.
- Evidence: `homework-pdf-2026-09-16/scanned-page-review.png` and
  `homework-pdf-2026-09-16/all-pages-reviewed.png`.

### Remaining limits

This is a browser PDF checkpoint, not completion of the OCR master build.
Native PDF still needs a page renderer/parser adapter. Page evidence remains
in-memory, not the durable server-owned provenance model. Tesseract remains
English-only and is not a handwriting/mathematical-layout guarantee. Mixed
content within one page with a nonempty text layer still needs region-level
coverage detection. Cancellation ignores stale results but does not immediately
abort all parser/OCR work. Large files and real-device RAM, thermal and latency
budgets have not been benchmarked. Source readiness remains unresolved, so this
recognition does not authorize assessment or mastery writes.

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

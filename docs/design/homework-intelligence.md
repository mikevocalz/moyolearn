# Homework evidence architecture

Status: implementation in progress. The user authorized continuing after the audit/host baseline; native model selection remains unqualified pending physical benchmarks. See the 2026-09-16 audit for version and source evidence.

## UX research

Actual Mobbin preview images inspected:

- [Apple Notes scanning](https://mobbin.com/flows/2e8a3323-9acd-42a7-8514-5ea837aebee2): prominent shutter, compact secondary camera controls, scanned document returns to its parent note.
- [Dropbox add scanned page](https://mobbin.com/flows/8fee3032-15d4-4621-a66f-ea9a6a815660): explicit page position, separate retake/add-page actions, edit/delete/arrange toolbar.
- [Craft scanning](https://mobbin.com/flows/1f8ffe12-12f6-4d4c-8f26-a488b191f8a0): large document preview, capture thumbnail, save count, multipage review.
- [Google homework search](https://mobbin.com/flows/fe68a6fc-7407-458e-b570-f127d1e4a1c2): clear camera mode and persistent gallery access. Moyo must add verification before assessment; search results alone are not source evidence.
- [Google photo translation](https://mobbin.com/flows/5bd6d1b5-907d-44c9-9892-2dc63427c6ad): source and target languages are separate visible choices. Translations must not replace homework source text.

Apply existing rounded-card/control tokens, quiet secondary actions and one primary action. Keep source pixels unmirrored. Page review retains every page and shows position, source preview and explicit failure/retry. Never represent an unmeasured camera condition as a detection. Additional Adobe/Teams/signing flows and physical visual QA remain outstanding.

## Boundaries

1. Capture retains original media identity. Normalization creates a derivative with rotation/polygon/transform metadata.
2. Recognition yields candidates with page/region IDs, geometry, recognizer/model revision, raw text and confidence. Failures remain page records.
3. Confirmation adds an immutable revision; it does not overwrite the recognizer's source text.
4. Local semantic inference may reference existing region IDs and group questions. It cannot edit recognition evidence. Unknown references invalidate its result.
5. Question readiness is derived independently for tutoring and evaluation. All relevant source regions—including student work—must be verified before assessment. Missing evidence is unresolved.
6. Evaluation checks readiness before arithmetic or persistence. The client applies the same rule before any offline fallback. Server-side persisted evidence must eventually replace client declarations as the authority.
7. Upload lifecycle is independent of recognition readiness. A successful transfer is not a successful reading.

## Delivery sequence

- Close immediate destructive paths: false live hints, automatic fixed crop, Unicode corruption, lost page positions and unguarded grading.
- Add durable documents/regions/revisions and shared review adapters, then server-authoritative evidence lookup and region confirmation.
- Replace document parsing with page-aware PDF and OOXML adapters; failed/unsupported pages remain visible.
- Select and integrate native OCR only after builds and comparative device measurements. Keep 0.9.3 pinned until then; do not pretend its English CRAFT model is multilingual.
- Add independent language settings, translation catalogs, Qwen semantics and policy-controlled specialists, with device-budget enforcement.

A transitional assessment-readiness declaration closes known client paths but is not tamper-resistant evidence verification. Until persisted region confirmations exist, photographic/document/voice/board sources remain unverified for grading. Tutor conversation remains available.

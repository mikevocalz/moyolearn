# Homework V3: documentation audit and implementation status

Date: 2026-09-16. This is an incremental implementation record, not V3 release acceptance.

## What the repository actually authorizes

- `docs/pack/18-tutor-ai-stack.md` records Mike's accepted Claude-primary architecture, explicitly marked **routing evidence pending**. Section 2 requires no-training/retention terms verified at contract. Section 3 requires passing subject×band evaluations before shipping a cell.
- `docs/pack/01-ai-tutoring-platform-plan.md` requires provider contracts and a subprocessor registry; it is a requirement, not a signed agreement or approval record.
- `docs/pack/07-security-child-ai-safety-spec.md` defines the Safety Plane, data separation and review requirements.
- `docs/verification/homework-intelligence-audit-2026-09-16.md` and the PDF verification reports document observed failures and prior tests. They do not supply provider-contract approval or model subject-evaluation results.

A search of repository docs, decisions, verification reports, prompts and local project skills found no recorded contract approvals or passing model subject evaluations. This does not establish that external records do not exist. Claude remains the architecture choice; no approval or evaluation references were invented.

## Implemented in this working change

- Provider product catalog and per-call approval checks at inference gateway dispatch; production approval registry empty. No refusal-triggered cross-vendor fallback. Gemini learner lanes remain disabled.
- Exact capability lookup: unknown subject/task, missing language/model/safety evidence, unavailable tools or grounding, and unevaluated cells deny generation. Safety screening precedes fixed text-only recovery.
- Strict exact-rational arithmetic and fraction reveal checks; see `docs/decisions/adr-homework-exact-math.md`.
- Client readiness claims cannot authorize grades. Authenticated assessment requires a server evidence transaction port and rejects mismatched learner, organization, question, revision, source text, expiry or readiness. **No production repository is wired to that port yet, so the current evaluate endpoint is ungraded.** Tests of the port contract do not prove database locking or queued-job invalidation.
- Removed client network-failure grading/mastery fallback.
- Native captures retain their full-resolution re-encoded master. Native OCR preserves raw detections, geometry and score meaning, serializes calls, and suppresses cancelled results. Unsupported native PDFs explicitly request recovery instead of treating a regex extraction as a complete document.
- Shared OCR review uses instance-scoped Zustand, displays the source photograph, requires source comparison even without an available OCR score, and aborts reads on cancellation/source replacement.

## Source-review design pass

Inspected Mobbin preview images (2026-09-16):

1. [Apple Notes Quick Look](https://mobbin.com/flows/22a448fc-fb46-47d5-b1d9-b0c39d233a0d): page occupies the main reading area; page count remains visible.
2. [Speechify Edit Text](https://mobbin.com/flows/208579eb-8a5a-4c99-93a1-f81beadc76e8): original document and editable text are available in the same review flow; cancel/save are explicit.
3. [LINE Scanning Text](https://mobbin.com/flows/575c875e-96ed-4b25-8927-c92bb2d22d64): recognized text is anchored to the retained image. Translation shown in the reference is not adopted for assessed language assignments.

Handoff: use existing Moyo tokens, rounded-card source previews, band-sized buttons, labeled textarea and keyboard-aware scroll. Original pixels remain unmirrored. Correction resets source confirmation. No score is presented as a probability of correctness. Review cancellation must prevent a late result from replacing manual work. Screen-reader, RTL, large text and physical-device review remain acceptance work.

Named user-research, mobbin-pass, design-handoff and accessibility-review skills were not found in the installed catalog. This document records the manual output contract; it is not a claim of conducted participant research or specialist endorsement.

## Outstanding V3 acceptance work

- Durable immutable document/page/region/question revisions, retained source assets, server evidence repository, atomic grade/current-revision check, revision-bound queued jobs and deletion cascade.
- Question grouping and source-to-answer association; bounded evidence bundles and retrieval/tool orchestration.
- Native PDF rasterization, Bear Block native build/integration and geometry transforms, real crop/redaction, multilingual OCR and calibrated critical-symbol recovery.
- Executable physics/units/graphs, ELA passages/rubrics, Spanish independent language dimensions, chemistry and sandboxed code tools.
- Local Qwen executor, resource scheduler/download lifecycle, eligibility-gated Apple/Nano research paths, specialist recovery and evaluated cloud orchestration.
- Complete i18n migration and age/role/responsive flows; remaining legacy state migration outside the capture screen.
- Authentic consented student-handwriting corpus, subject/model evaluation records, provider approvals, physical iOS/Android release benchmarks and the final V3 end-to-end scenario.

Baseline `ae8fdcc` was pushed before implementation. Baseline root typecheck passed 19/19 tasks; tests passed 12/12 tasks. Baseline lint first stopped at an unused capture store, now removed. Subsequent lint exposed existing missing design references outside the capture review surface; these are tracked separately from functional tests.

## Checkpoint validation

- Root tests: 12/12 task suites passed with Homebrew Node 24.21.0. Latest app rerun: 576 regular and 110 server tests passed; latest inference rerun: 45 passed. Exact student-model suite: 114 passed.
- Cold root typecheck: 19/19 tasks passed. Edited capture/review/service/pedagogy files pass targeted ESLint; inference and student-model package lint pass.
- All 20 root invariant scripts were run individually after the root lint chain stopped: 16 passed. Existing failures remain in design references, art registry (84 XR image references), joint ownership, and absent material-tool references. App-wide ESLint also finds two existing missing SOT headers in permission resolution anchors. No lint pass is claimed.
- iPhone 17 Pro simulator / iOS 26.4: selected a stock flower photo through the actual photo picker, reviewed the page, reached OCR failure/manual recovery, and verified one uncropped source preview with empty confirmation disabled. See `ios-source-review.png`. This is UI recovery evidence, not homework OCR accuracy or physical-camera evidence.
- CodeRabbit completed with three findings; all were addressed. The delayed-dispatch approval check was additionally hardened and regression-tested locally.

The first full test rerun used a different local Node build (24.19.0 with a different zlib), changing the avatar PNG compression hash. Re-running on the baseline's Homebrew runtime passed; the golden asset was not changed.

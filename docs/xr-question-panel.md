# XR Learning Question Panel

The dynamic question surface for the spatial scene — one Rive-framed panel that can present arbitrary Moyo questions across subjects, content types and answer interactions. Spec: `~/Downloads/moyo-xr-rive-dynamic-questions-prompt.md`.

## Composition

```
XrQuestionPanel (apps/mobile/src/native-3d/xr-question-panel.tsx)
  carrier ViroNode ── persists drag pose, amber grip (dragTransform="parent")
    └─ slot ViroNode ── worldSlot pose, carrier child
        ├─ ViroRivePanel ── moyo_learning_question.riv
        │     artboard LearningQuestion (1280×800), state machine QuestionFlow
        │     owns: chrome, phase animation, choice rail (≤6), footer, loader
        └─ ViroQuad ── XR_MATERIAL.questionLive at QUESTION_CONTENT_BAND
                    (x40 y80 w760 h660 artboard units, the transparent hole)
```

`BoardTextureHost` parks a plain RN view — `XrQuestionContent` — in the 2D tree and re-parents it into the `questionLive` texture, the same capture path the Quickdraw board uses. Rive never renders block content; the hosted surface never touches the renderer.

## State ownership

- **Truth:** `useXrQuestionFlow` (`packages/app/features/tutor/xr-question.store.ts`) — question, answer draft, phase, feedback, evidence, `transitionToken`.
- **Chrome:** Rive VM `Question` (59 props). JS → Rive via `bindQuestionChrome.push`; Rive → JS via `command`/`commandArg`/`commandSeq` decoded by `decodeQuestionCommand` (`packages/ui/xr/question-commands.ts`).
- **Mapping:** `questionPresentationOf` (`apps/mobile/src/native-3d/xr-question-present.ts`) is the one place store state becomes VM snapshot — labels, selection indices, phase number.

## Phase machine

`loading-initial → entering → idle → submitting → feedback → exiting → (loading-next) → entering → idle`, `error` reachable with retry. `rivePhaseOf` maps to the authored `phase` numbers 0–11; `idle` becomes `selecting` (3) once a draft exists. Transitions are timer-matched to the RML (`EXIT_MS` 550 / `ENTRANCE_MS` 900 in the probe wiring) because the runtime does not call JS back on animation completion.

Async is token-guarded: `submit()` returns a token; `resolveSubmit(token, …)` drops stale/out-of-phase resolutions. `commitNext()` swaps the buffers only at the hidden midpoint (`exiting`/`loading-next`).

## Content blocks

`QuestionContentBlock` (`packages/ui/xr/question-content.ts`) — the 18-block union from the spec. Media is `QuestionMediaSource` (attachment-shaped, URIs only — never bytes). Math is `MathJsonExpression`, rendered structurally by the content surface over the repo's bounded allowlist (Add/Subtract/Multiply/Divide/Rational/Negate); anything outside renders its text form, visibly.

`resolveQuestionLayout` (`question-layout.ts`) is a pure function → one of 15 layout kinds. Interaction outranks content (`board-work` → `board-focus`); media aspect picks left/top; over-capacity content pages (the texture has no scroll input).

`normalizeXrQuestion` (`question-normalize.ts`) parses untrusted payloads: no `id`/`prompt` → `null`; unknown blocks drop and are counted; unknown subject/interaction/direction fall back honestly; evidence only survives as a complete `{questionId, revision}` pair. There is no answer-key field to smuggle.

## Evaluation

Server-authoritative only. `evaluateXrAnswer` (`packages/app/features/tutor/xr-question-evaluator.ts`) POSTs `/api/tutor/evaluate` with issued evidence for `server-objective`; `coach-review`/`teacher-review`/`ungraded` resolve `ungraded` — never a fake verdict. Drafts the wire cannot express (ordering, diagram labels, board work) return `null` and resolve `ungraded`.

## Subject capabilities

`SUBJECT_CAPABILITIES` / `interactionSupported` (`question-capabilities.ts`) — per-subject `full | fallback | unsupported`. Rail interactions are full everywhere; richer interactions are per-subject; `fallback` means shown + recorded, resolved `ungraded`.

## Media readiness

`criticalMediaOf` / `secondaryMediaOf` (`question-ready.ts`) — images/diagrams/maps/document-regions and the first image-grid page gate the entrance loader; audio/video and extra media stream in behind. Unresolvable media renders skeleton + alt text, never a stretched or absent image.

## Acceptance surface

`question-fixtures.ts` holds the acceptance-matrix fixture set (18 questions) and `XR_FIXTURE_SEQUENCE` — the five-question mixed run (EN math MC → ES science image → EN reading → board-work → RTL). Probe route: `moyo://xr-question-probe` (`app/xr-question-probe.tsx`).

## Limitations (honest, current)

- **Locales:** `uiLocale`/`questionLocale`/`sourceLocale`/`tutorLocale` are carried end-to-end and RTL direction renders, but the chrome's button labels are an English table (`xr-question-present.ts`); full copy localization is a seam, not a claim.
- **Fixture media:** `fixture:` URIs resolve through the injected `resolveMedia`; the probe ships none, so media blocks render their skeleton+alt state until real assets land.
- **In-window input:** the content surface does not take rays yet — choices ride the Rive rail; diagram-label/ordering input is semantic but has no XR pointer path yet.
- **Grading:** the server evaluator is exact-arithmetic on `problem`/`answer` strings; richer interactions resolve `ungraded` by design.
- **Paging:** `paged` layouts paginate but the page-turn control is not wired into the Rive footer yet (vocabulary is fixed; needs a command or content-side affordance).
- **Voice/board:** footer verbs exist; voice input and live board interop inside the question panel are seam-only in the probe.
- **Physical verification:** not yet run on the Quest — acceptance is open.

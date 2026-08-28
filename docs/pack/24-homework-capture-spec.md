# Homework Capture — point, frame, crop, coach: the camera flow that feeds Natalie
**Doc 24 · Moyo platform pack · Date:** Aug 21, 2026
**Scope:** how a learner attaches or photographs homework to be tutored on — the end-to-end flow, the realtime capture-coaching layer (tailored from Margelo's [react-native-vision-camera-realtime skill](https://github.com/margelo/react-native-skills/blob/main/skills/react-native-vision-camera-realtime/SKILL.md)), the crop-as-privacy architecture, band-adapted UX, and the handoff into the doc-18 tutoring stack. One positioning line governs everything: **Photomath vends answers; Natalie coaches.** The capture flow must feel like showing your work to a tutor, not feeding a vending machine.

---

## 1. The flow — five steps, two research-backed models reconciled
The market runs two capture models: **Photomath's scan-window-first** (a resizable scanning rectangle in the live viewfinder — drag the corner to size it before capture) and **Socratic's crop-after** (shoot the page, then drag corner handles to isolate "only the section you want to ask about," then Go). The field-tested rule both serve: **isolate a single question** — capture a full page of 20 problems and the model "panics and spits out a jumbled response." Our flow uses both, band-adapted:
1. **Entry** — from the session screen and Today's Path: `Camera` · `Photo library` · `File (PDF/worksheet page)` · `Type it` · `Say it` (doc-15 STT, but see the note below). Never camera-only — Socratic ships keyboard and voice entry as peers, and so do we (access, broken cameras, shy kids).

   > **`Say it` — doc/code divergence, unresolved (flagged 2026-08-28).** Doc 33
   > §8.2 lists it as a v1 **non-goal**: *"No voice input v1 — mic capture of
   > child's speech separate PRD; direction is on-device STT so children's audio
   > (personal info under amended COPPA) never leaves device."*
   >
   > **It is nevertheless built and reachable today.** `(learner)/(tabs)/capture`
   > renders `CaptureScreen` → `CaptureEntryRow`, which offers "Record your
   > voice"; `age-band.ts` carries band-specific copy for it.
   >
   > **The audio does not leave the device**, so the COPPA reasoning behind the
   > non-goal is satisfied: `transcribe.native.ts` runs Whisper on-device via
   > `react-native-executorch`, and `transcribe.web.ts` runs
   > `@huggingface/transformers` in the browser. Neither uploads. The code built
   > precisely the on-device direction doc 33 named — it is ahead of doc 33's
   > *schedule*, not across its *line*.
   >
   > **Someone must decide**, because a third artifact already assumes the
   > non-goal: the marketing copy deck is forbidden to describe voice input, so
   > the product currently ships an affordance the site may not name. Either
   > doc 33 §8.2 is amended to admit the shipped on-device path, or the entry is
   > withdrawn until the separate PRD lands. Do not resolve this by editing one
   > document — all three have to agree.

2. **Frame** — live guided frame with realtime coaching (§2): page-edge quad, tilt/parallel hint, light/glare/blur hints, and a "one problem at a time" nudge when many text blocks are detected. Auto-capture fires on stability (manual shutter always present).
3. **Capture** — `takePhoto()` still at capped resolution (the general `react-native-vision-camera` skill owns setup/capture; this doc's realtime layer follows its specialized companion).
4. **Crop & confirm** — crop-after refinement with corner handles (Socratic pattern); on-device text-block detection pre-suggests problem regions to tap (doc-18 detection models); then the **digitized-text review**: show what OCR read and let the learner fix it — field testing's specific failure is a cut-off negative sign or an exponent misread as a smudge, which makes the AI "perfectly solve the wrong equation."
5. **Handoff** — the confirmed crop + text enters the session as a message card; Natalie opens with the work, not the answer ("Show me how you started" / "Let's do the first step together") per the doc-18 pedagogy contract.
Multi-page worksheets: an "add another page" tray; HS band gets batch mode (tap several detected problems across pages).

## 2. The realtime coaching layer — the v5 skill, applied
Margelo's skill classifies paths by final consumer, and ours splits exactly in two:
- **Hint detection is "state-only ML or scanning":** per the skill, benchmark the platform runtime across **ANE/NPU, GPU, and CPU** backends and return compact state — and "normal React state is fine after a scan that has no frame-coupled overlay." So blur/glare/light/tilt/multi-block detection runs at a few fps (not frame rate), on the backend the benchmark picks, emitting a tiny hint enum the React layer renders as chips. Tilt/parallelism combines device gyro with detected page-edge geometry — research calls the parallel angle "the single most critical step" since 45° perspective distortion ruins recognition.
- **The page-edge/problem-region overlay is frame-coupled:** per skill invariant 6, frame-coupled overlays draw from the same `Frame` with **Skia** — never routed through React state or Reanimated shared values. The guide quad renders on the camera's GPU timeline (`<SkiaCamera />` path).
Hot-path rules adopted wholesale: orientation stays metadata (`enablePhysicalBufferRotation: false`, invariant 1); pipelines/models/resizers **warmed once** per session, never per frame (5); every `Frame` released exactly once (7); async work bounded — one in-flight task, stale input replaced, "never build an unbounded FIFO queue," with `useAsyncRunner()` disposal rules followed (accepted frames disposed in-task, rejected immediately). Budgets tracked per the skill's production checklist: capture-timestamp→hint latency at p50/p95/p99, dropped frames, allocations per frame, thermal behavior on sustained use — validated on release builds per device class, with the Mac Catalyst loop for functional iteration only. **Product latency target: ≤2s from shutter to Natalie's first token at p50** — the 2026 standard the scanning market has converged on (older apps took ~8s). Exact APIs pinned against [visioncamera.margelo.com/llms.txt](https://visioncamera.margelo.com/llms.txt) at the PR, per both the skill's own instruction and our standing rule.

## 3. Crop is the privacy mechanism
A homework photo is a photo of a child's desk: a name on the paper margin, a sibling in the background, the living room. The architecture makes the crop do the privacy work:
- **The full frame never leaves the device by default.** What uploads is the confirmed crop region + extracted text — nothing else. EXIF/GPS stripped unconditionally.
- **On-device redaction pass before upload:** background face detection (doc-18 vision models) auto-blurs any face in the crop; the review step shows exactly what will be sent.
- **Retention inherits the doc-19 rule:** an image of learner work *is* learner content — captured crops live under the transcript TTL and erasure cascade, visible to guardians via S27's "what Natalie remembers," never used for training (doc 07). Market context makes this a selling point: 2025's policy overhauls happened precisely because scanning apps were saving photo history to cloud servers and training on submissions.
- **Permissions, band-appropriate:** camera permission requested in-context at first use with band-voiced copy ("Natalie needs to see your paper to help"), guardian-visible in settings; the attach path prefers the limited photo picker (selected-photos access, not full library); the camera never runs off the capture screen; the OS indicator is never worked around.
- **Compliance framing (US):** the amended COPPA rule's minimization posture is the design bar — collect the crop, not the room. FERPA/state student-privacy postures per doc 07.

## 4. Band-adapted UX (doc 08)
- **Elementary:** full-screen guided frame, auto-capture on stability (no shutter hunting), voice prompt option ("Point at the tricky one!"), one problem auto-suggested with a single confirm tap, giant retake, hints spoken in band voice ("A little darker — try the light!").
- **Junior high:** standard flow — guided frame, crop handles, text review.
- **High school:** speed-first — batch multi-problem selection, keyboard-quick corrections, recent-captures rail for re-asking.
Failure states are coached, not dead-ended: unreadable → the specific hint (flatten the page, kill the shadow — the tested framing routine: flat on a dark surface, flashlight for hand shadows), low OCR confidence on handwriting (engines hit ~85–90% on messy writing; faint pencil fails) → route the crop *image* to the vision-eval-passed provider cell instead of text-only (doc 18 multimodal cell); non-homework or inappropriate image → on-device classifier gate, gentle band-voiced redirect, doc-07 screens apply; offline → queued with an honest "when we're back online" card.

## 5. Components & wiring
`features/capture` in `packages/app`: `CaptureSession` (screen), `GuidedFrame` + `ProblemRegionOverlay` (Skia, frame-coupled), `HintChips` (React state, band-voiced copy from i18n catalogs), `CropHandles`, `DigitizedTextReview`, `MultiPageTray`, `CaptureEntryRow` (camera/library/file/type/voice). Types in `packages/types` (`CaptureHint`, `ProblemRegion`, `CapturePayload = { crop, text, ocrConfidence, pageIndex }`). The capture surface is a candidate resident of the doc-20 `natalie-runtime` (it feeds the same session), decided by profiler evidence per PR-63's rule. Capability manager (doc 18) downloads the detection/OCR models on first capture use — zero bundled weights holds.

## 6. PRs
- **PR-78 · Capture flow core:** entry row, guided frame, takePhoto, crop-after handles, review step.
- **PR-79 · Realtime coaching:** state-only hint pipeline (backend benchmark per skill), Skia edge overlay, budgets instrumented.
- **PR-80 · Privacy pass:** crop-only upload, EXIF strip, redaction pass, limited picker, permission copy per band, retention wiring.
- **PR-81 · Handoff & routing:** OCR-confidence router (text vs vision cell), pedagogy-contract opening moves, offline queue.
- **PR-82 · Bands & polish:** elementary auto-capture/voice mode, HS batch, failure coaching, a11y (VoiceOver labels on every hint and handle).

## 7. Sources (linked)
[react-native-vision-camera-realtime SKILL.md](https://github.com/margelo/react-native-skills/blob/main/skills/react-native-vision-camera-realtime/SKILL.md) · [VisionCamera docs index](https://visioncamera.margelo.com/llms.txt) · [performance](https://visioncamera.margelo.com/docs/performance) · [async frame processing](https://visioncamera.margelo.com/docs/async-frame-processing) · [Skia frame processors](https://visioncamera.margelo.com/docs/skia-frame-processors) · [Socratic capture & crop help](https://support.google.com/socratic/answer/9413931?hl=en) · [Photomath scan/edit help (scan window)](https://support.google.com/photomath/answer/14333327?hl=en) · [Photomath](https://photomath.com/) · [2026 scanning-app field test (single-question isolation, framing routine)](https://thinkassist.app/blog/app-where-you-can-scan-questions-and-get-answers) · [capture-angle & privacy-policy landscape](https://thinkassist.app/blog/take-a-picture-of-your-homework-and-get-answers-app) · [OCR handwriting accuracy & failure modes](https://thinkassist.app/blog/best-app-to-scan-questions-and-get-answers) · Pack docs 07/08/15/18/19/20.

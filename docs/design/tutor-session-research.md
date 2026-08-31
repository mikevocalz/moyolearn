# Tutor Session — Research Notes
**Date:** 2026-08-31  
**Source of truth:** `docs/pack/18-tutor-ai-stack.md`, `docs/pack/22-embodied-tutor-avatar-spec.md`, `docs/pack/23-tutorstage-handoff.md`, `docs/pack/24-homework-capture-spec.md`, `docs/pack/32-tutor-voice-tone.md`, `docs/pack/33-moyo-learn-prd.md`  
**Research method:** Pack-document audit, public product documentation, and direct repository inspection. The Mobbin browser plugin and several named skills (`personal-context`, `deep-research-work`, `mobbin-pass`, `control-browser`) were not available in this environment; those slots are marked explicitly rather than fabricated.

---

## 1. Research goals

- Confirm how leading tutoring and capture products handle the learner→work→tutor loop.
- Extract patterns that Moyo should adopt (single-task focus, visible progress, immediate feedback, crop-as-privacy) and patterns to reject (answer vending, streak pressure, emotional surveillance).
- Ground the `TutorPresencePreference`, responsive layout, and voice/capture architecture in observed behavior rather than invention.

## 2. Skills and tools available

| Requested skill | Available | Substitution |
|---|---|---|
| `personal-context` | No | Direct pack-doc and repository inspection |
| `deep-research-work:deep-research` | No | Targeted `web_search` + manual source evaluation |
| `/user-research` | No | Pack-doc persona and FR review |
| `/mobbin-pass` | No | Public Mobbin URL list captured; no screen images returned |
| `control-browser` / `vercel:agent-browser` | No | Pack docs and web search only |
| `visualize` | No | Existing `docs/site/critique/shots` used where present |
| `frontend-design` | No | Direct inspection of `packages/ui` components |

## 3. Product pattern analysis

### Khanmigo / Khan Academy
- Single-task focus: one exercise, one hint ladder, mastery context visible.
- Hints sit *near* the exercise, not in a separate chat.
- Minimal distraction; no celebratory fireworks for correct answers.
- **Adopt:** first-paint presence, task proximity, mastery context.
- **Reject:** none for the tutor session; the public site is not the app.

### Duolingo / Duolingo Max
- Short interaction loops, visible progress, immediate feedback.
- Voice mode is a clearly labeled state with a waveform.
- **Adopt:** short loops, unmistakable listening/speaking states.
- **Reject:** streak loss, guilt, artificial urgency — banned for minors (doc 19, doc 33 §6).

### ChatGPT Voice
- Waveform replaces the input field during recording.
- Transcript is continuous and visible.
- Interrupt is a tap.
- **Adopt:** recording replaces typing surface; transcript continuity; barge-in.

### Google Lens / Photomath / Socratic
- Fast camera entry, scan/crop step, problem isolation.
- Photomath leans toward answer vending; Socratic asks the learner to pick the region.
- **Adopt:** fast camera entry, one-problem-at-a-time, crop-after refinement, review low-confidence OCR.
- **Reject:** answer vending, full-page upload.

### Quizlet
- Capture guidance and review before committing scanned content.
- **Adopt:** staged review of what was captured before it becomes a message.

### IXL / ALEKS / DreamBox / Carnegie MATHia
- Mastery-based progression, diagnostic questions, adaptive scaffolding.
- **Adopt:** mastery-aware scaffolding, hint ladder, independent retry.
- **Reject:** adult-dashboard aesthetic on child surfaces.

### Synthesis Tutor
- Manipulatives-first, concept-first math.
- **Adopt:** canvas modules for concrete representation.
- **Reject:** price tiering visible to learners.

### SchoolAI
- Teacher-configurable guardrails and visibility.
- **Adopt:** educator/guardian-facing status and controls.
- **Reject:** emotional or sentiment surveillance of children.

## 4. Mobbin references (requested)

The following Mobbin flows were requested but could not be inspected because the Mobbin plugin was unavailable. URLs are recorded for a later pass:

- [Khan Academy — Taking quizzes and challenges](https://mobbin.com/flows/c774d336-7b1d-435a-b84a-d4a4ba7be446)
- [Khan Academy — Course summary](https://mobbin.com/flows/1ca2ec76-c590-4b36-8ad5-10dfc90342d9)
- [Duolingo — Completing a story lesson](https://mobbin.com/flows/1ff832eb-e370-438f-960e-b19609d66685)
- [Duolingo — Completing a rapid review](https://mobbin.com/flows/3505a113-3e0a-4d21-93ba-7b6bd438aa7b)
- [Google — Searching for homework help](https://mobbin.com/flows/fe68a6fc-7407-458e-b570-f127d1e4a1c2)
- [Quizlet — Scanning a document](https://mobbin.com/flows/dbe7f0e8-fc55-4e59-a984-aa569addf6fc)
- [ChatGPT — Voice chat](https://mobbin.com/flows/8a834128-d249-425a-8bc6-029504038e5f)
- [ChatGPT — Asking through voice chat](https://mobbin.com/flows/e513c0fe-fd2a-4f92-b7e7-756c9a8e9996)

## 5. Pattern adoption matrix

| Pattern | Adopt | Reject | Notes |
|---|---|---|---|
| Single-task, mastery context | x | | Khanmigo + Khan Academy |
| Short loops + visible progress | x | | Duolingo |
| Voice replaces input field | x | | ChatGPT Voice, Composer already does this |
| Waveform + elapsed time | x | | Composer already does this |
| Transcript continuity | x | | Captions in `TutorStage` |
| One-problem crop | x | | Socratic, Photomath scan window |
| Review low-confidence OCR | x | | Quizlet, Socratic |
| Streak / loss / urgency | | x | Banned for minors |
| Answer vending | | x | Brand differentiator |
| Emotional surveillance | | x | Doc 19/32 |
| Engagement-pressure mechanics | | x | Doc 19/33 |

## 6. Findings that shape this build

1. **Presence is a decision, not an accessory.** The avatar state (visible / compact / audio-only) must be typed and central, because K–2 needs voice-first, high-school needs workspace-first, and reduced-motion needs a still face or no face.
2. **The composer already captures the right patterns.** `packages/ui/Composer.tsx` implements the flat attachment list, recording-replaces-field, and waveform. This work extends it rather than replaces it.
3. **Crop is the privacy boundary.** Doc 24 already encodes this; the implementation must keep the full frame on device and upload only the confirmed crop + text.
4. **One voice is non-negotiable.** Doc 32 pins ElevenLabs Natalie; the only degraded mode is text.
5. **Tutor identity must be continuous across 2D/3D/audio-only.** The `TutorStage` handoff (doc 23) and avatar package (doc 22) already provide the 2D→3D controller and face bus. The audio-only path must still drive the same speaking/listening state.

## 7. Limitations

- No live product screenshots were collected because the Mobbin and browser-control skills were unavailable.
- The competitive analysis is drawn from public documentation, pack docs, and existing repository research (`docs/design/mobbin/capture-flow.md`, `docs/design/mobbin/ocr-review.md`).

## 8. SOT Keywords

SOT-KEYWORDS: tutor session research khanmigo duolingo chatgpt voice photomath socratic quizlet capture crop presence audio-only

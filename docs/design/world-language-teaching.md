# Moyo world-language teaching — first implementation slice

Status: draft 2026-10-15. The course catalog, shared Natalie prompt policy and pronunciation evidence guards are implemented in packages/app/features/world-language. A world-language tutor route, student screens, course persistence and live pronunciation grading are NOT yet activated.

## One learner-facing identity

Natalie remains the same voice and pedagogy across subjects. Claude Opus 5 is the current server tutoring route; one Qwen3.8-Max candidate is evaluated as a possible fallback, not activated. Do not introduce another language LLM. Use on-device multilingual Whisper to transcribe speech and a separate verified phoneme-assessment capability only after meeting privacy and evaluation gates. ElevenLabs v4 voice identity is shared; never auto-switch the child's tutor voice when a provider fails.

## Course catalog

Start with Spanish (Mexico/Spain), French, Mandarin (Simplified), Modern Standard Arabic and US English learning. Each course has a BCP 47 locale and Whisper language code. Specific Arabic dialects, Traditional Chinese, regional French and other courses need separately verified curricula and speech support; do not label all accents interchangeable. Proficiency tracks ACTFL-aligned novice through advanced stages with independent listening, speaking, reading and writing observations.

## Lesson experience

1. Parent/student picks course, regional variety and level, enters consent-aware microphone flow.
2. One short listening or reading prompt from a vetted skill objective.
3. Learner speaks, types, points to text or writes. Raw speech stays on-device for recognition where supported.
4. The learner confirms the transcript. Natalie gives one useful correction and one next question, not a complete assignment answer.
5. Store attempts and rubrics with source provenance. Track grammar, vocabulary and comprehension separately. Do not treat a transcript as pronunciation evidence.
6. Parent sees dated and domain-specific observations, not fabricated fluency/phoneme scores.
7. After approved phoneme analysis is available, let learner replay the precise syllable or sound and try again.

## Next PRs / acceptance

- [ ] Native and web Whisper multilingual migration with locale control, cached model loading, device QA and recording privacy.
- [ ] Connect trusted subject and locale from server-owned course enrollment; remove hard-coded math in coach API without allowing unreviewed world-language cells.
- [ ] Vetted listening/reading/grammar exercises, progress persistence in existing Payload/education store, and parental report integration.
- [ ] Tablet/foldable adaptive source pane, transcript/correction inspector and voice playback; phone remains single-pane and fully functional.
- [ ] Approved multilingual Natalie voice evals, pronunciation model feasibility on-device and per-phoneme human validation.
- [ ] Unit/integration/E2E with code-switching, Spanish dialect variants, Arabic right-to-left, CJK, captions, hearing/speech accommodations and text-only fallback.
- [ ] Tests for privacy, age and subject x grade safety gates, refusal preservation, retention/erasure and correction-to-mastered transitions.

Reviewer roster: language pedagogy researcher, native-speaker content reviewers per locale, bilingual accessibility specialist, senior Expo/Solito engineer, adaptive/foldable designer, on-device speech/phonetics engineer, privacy and student-data specialist, senior Payload/Postgres engineer, red-team/evaluation engineer and device QA. Follow existing repo skill stack: expo/skills, mattpocock/skills, Argent/agent-device, FWC swiftui-iphone-duo transferable principles, Anthropic frontend-design, Google Stitch, Mobbin, pbakaus/impeccable, petergyang/no-ai-slop. Use Kinetrell only for animation, Zustand for state, and semantic @acme/ui.

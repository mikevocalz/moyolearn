# Moyo multilingual Whisper — native + web

Draft implementation, 2026-10-15. Speech transcription remains local to the student's device. This PR replaces the English-only Tiny checkpoint on mobile and in browsers with **one multilingual Whisper Tiny** model per platform, not another Qwen model.

- Native: react-native-executorch WHISPER_TINY, one cached SpeechToTextModule, 16kHz mono audio, optional validated ISO language hint.
- Web: Xenova/whisper-tiny via @huggingface/transformers, WebGPU first and WASM fallback; cache one model promise per process, use validated optional language hint.
- Language options for the first courses: en, es, fr, zh, ar. Unsupported or malformed explicit locale yields an empty transcript, never a silent translation guess. With no locale, Whisper may auto-detect.
- The audio attachment is never discarded if transcription fails; student text verification remains required.
- Transcription is not pronunciation accuracy. A separate consent-aware and evaluated phoneme scorer is required for fluency feedback.

## Release gates

- [ ] Verify that the installed 0.9.3 ExecuTorch model and Transformers 4.2.0 accept locale hints on real hardware/browsers.
- [ ] Benchmark model footprint, cold download, runtime memory, speech quality, battery and offline mode on iOS/Android/iPad/Chromebook.
- [ ] Test English, Spanish Mexico/Spain, French, Mandarin and Modern Standard Arabic, with code-switching, short clips and noisy classrooms. Human transcripts required as references.
- [ ] Consent screen, microphone permissions, accessible recording controls, transcripts correction, no raw audio sent to external inference.
- [ ] Wire server-owned course locale into capture and tutor flows, not untrusted subject labels.
- [ ] Run web/native build, Expo device QA and all capture/tutor regressions before release.

Required reviewers: multilingual ASR engineer, native Expo/React Native engineer, platform performance specialist, educational language assessor, privacy/security reviewer, accessibility reviewer and QA. Use the Moyo monorepo's existing skills and no new backend or Qwen runtime.

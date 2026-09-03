# Tutor Voice & Tone — one voice, two render paths, an enumerated tone palette
**Doc 32 · Moyo platform pack · Date:** Aug 27, 2026
**Decision (Mike's, binding):** the tutor speaks with **one ElevenLabs voice and nothing else** — the same voice in text-chat playback and in the 3D embodiment, so the tutor is *familiar*: one voice, one person, everywhere. Tone is a first-class system, not a TTS afterthought, because the audio is paired with NVIDIA Audio2Face-3D + Audio2Emotion — **the face is driven by the audio, so flat audio is a dead face.**
**Builds on:** doc 07 (sentence-window pipeline), doc 18 (AI stack; amended below), doc 19 (no emotion-recognition of the child; anti-dependency), doc 24 (≤2s latency bar), doc 31 (bands, S-ladder, fixed S4 scripts).

---

## §1 · The provider landscape, researched (what constrains the design)
- **Eleven v3 went GA March 14, 2026** with **audio tags** — inline bracketed cues like `[excited]`, `[whispers]`, `[sighs]` that direct emotion, pacing and delivery (v3 has no SSML; tags replace it). 70+ languages, dialogue mode, a claimed 68% reduction in complex-text errors. **But v3 explicitly cannot do realtime** — ElevenLabs' own guidance is to stay on Flash/Turbo v2.5 for conversational use; v3 is a larger model with a higher-fidelity codec that "takes longer to run," and it demands more prompt engineering. ([v3 launch](https://elevenlabs.io/blog/eleven-v3) · [audio tags guide](https://elevenlabs.io/blog/v3-audiotags) · [GA review](https://inworld.ai/resources/elevenlabs-v3-review) · [2026 guide](https://aividpipeline.com/blog/eleven-v3-guide-2026))
- **Flash v2.5 is the realtime model: ~75ms TTFB**, websocket streaming. In the v2 family there are **no audio tags** — emotion comes from *textual cues and punctuation*, and a critical gotcha: **descriptive text ("she said excitedly") is spoken aloud** unless trimmed. Voice settings (Stability/Similarity/Style) control consistency; models are nondeterministic (seed helps); and for streamed chunks the API supports **`previous_text` / previous-request stitching to keep prosody continuous across chunk boundaries**. ([ElevenLabs TTS docs](https://elevenlabs.io/docs/overview/capabilities/text-to-speech) · [2026 cheat sheet](https://www.webfuse.com/elevenlabs-cheat-sheet))
- The tension in one line, from the GA review: **"the best quality and the lowest latency live in different models, and you have to choose."** We don't choose — we route (§3).
- **NVIDIA open-sourced the Audio2Face stack Sept 24, 2025**: pre-trained A2F models (regression v2.3, diffusion v3.0), **Audio2Emotion models (production v2.2, experimental v3.0) that infer emotional state from audio**, a real-time C++ SDK, a training framework, and Maya/UE5 plugins. Output is **ARKit blendshapes at 30 inferences/sec of audio**, with emotional expression — and **emotion can be auto-detected from the audio *or explicitly specified* as input**. Two honest limits from the docs: A2F does **not** animate head, eyes, or (fully) tongue — several blendshapes are always zero, and `mouthClose` deviates from standard ARKit by including jaw opening. ([A2F-3D hub](https://github.com/NVIDIA/Audio2Face-3D) · [samples](https://github.com/NVIDIA/Audio2Face-3D-Samples) · [microservice docs](https://docs.nvidia.com/ace/audio2face-3d-microservice/latest/text/getting-started/overview.html) · [open-sourcing](https://gadgetbond.com/nvidia-audio2face-ai-voice-animation-open-source/))

## §2 · The voice is an asset, not a call
**One voice ID — "Natalie" — designed once** (Voice Design or Professional Voice Cloning of a licensed performance; decide at PR with rights review) and pinned in the registry: `{ voiceId, modelId per path, voiceSettings per band, version }`. The same ElevenLabs voice ID renders under different models, which is exactly what makes one-voice-everywhere possible: **Flash v2.5 and Eleven v3 speak with the same voice** — verify voice/model compatibility for the chosen voice at PR.

Hard rules that follow from "familiar":
1. **No other TTS ever renders the tutor.** Degraded/offline mode is **text-only, not a substitute voice** — to a six-year-old, a different voice is a different person, and the trust transfer doesn't survive it.
2. **Settings are versioned like prompts.** Changing stability/style/speed is a voice change; it goes through the registry with an eval listen, not a config tweak.
3. **A monthly drift check:** render a fixed 10-line script on both paths, compare against the golden render by ear and embedding distance. Nondeterminism is fine; drift is not.
4. This supersedes doc 18's Phase-3 note: **Gemini Live's native speech output is out** — it speaks with its own voices, which breaks the one-voice rule. The realtime path is and remains **STT → tutor LLM → ElevenLabs Flash stream**. (Gemini's other lanes in doc 18 are untouched.)

## §3 · Two render paths, one voice, one tone system
| | **Path A — Live** (chat playback + live 3D session) | **Path B — Baked** (Natalie's set-piece moments) |
|---|---|---|
| TTS | **Flash v2.5**, websocket streaming, ~75ms | **Eleven v3** with audio tags, full expressiveness |
| Tone control | Text shaping + punctuation + per-tone voice settings (no tags — v2 family; and never descriptive text, it gets spoken) | Audio-tag recipes per tone |
| Face | The existing live runtime lip-sync layer (per the standing decision that A2F is **not** the live path) | **A2F-3D diffusion + Audio2Emotion offline → ARKit blendshape clips → baked animation**, per the standing decision |
| Emotion into face | — | **Explicitly specified** to A2F from the tone palette (the docs support direct specification) — never inferred-only, so face and voice can't disagree |
| Used for | every tutoring turn | welcome/return greetings, celebrations, lesson openers, and **all S4 safety scripts** (doc 31: human-written, human-reviewed audio, baked — never generated live) |

Chunking on Path A rides the **same sentence window** doc 07 uses for safety and doc 31 uses for readability — one windowing mechanism now carrying three checks plus TTS dispatch, with `previous_text` stitching so prosody doesn't reset at every boundary. Latency budget: reply-first-token → first-audio must fit doc 24's ≤2s bar; Flash's 75ms leaves the budget to the LLM, where it belongs.

**Flagged, not decided:** NVIDIA's Sept-2025 open-sourcing includes a **real-time C++ SDK** (~2.2GB VRAM/stream on a 4090). That's new since the pre-bake-only decision was made. The decision stands — but re-evaluate live A2F at Phase 3, because the cost that justified "baked only" has changed.

> **SPEC-002 (2026-09-03, Mike's direction, ADR-112):** re-evaluated. **Live A2F/A2E is IN SCOPE on Moyo's own GPU host.** Path A's "Face" row above becomes: *A2F-3D + Audio2Emotion computed server-side from the same Flash bytes the client plays, shipped beside the audio as one performance and scheduled on the client's audio clock; the audio-analysis mouth is the fallback when no face host is configured or the face fails.* The rule that A2E reads **Natalie's** audio only is unchanged and is now also a licence term. The hosted `build.nvidia.com` endpoint was deprecated in April 2026, so the SDK is self-hosted; the host is not yet stood up — see ADR-112 §Blocked for the cost line that goes in doc 12 §7.

## §4 · The tone palette — enumerated, because tone is where two failure modes hide
The tutor LLM emits `tone: <key>` as **structured metadata beside the reply — never inline in the text** (Flash would read tags aloud; v2 speaks descriptive text). The palette is closed and versioned; each entry defines both paths' recipes plus the face emotion:

| Key | Pedagogical moment | Live recipe (text/settings) | Baked recipe (v3 tags) | A2F emotion |
|---|---|---|---|---|
| `warm-open` | session start, return | easy phrasing, medium-slow rate | `[warmly]` | joy·low |
| `thinking-together` | working a step | even, unhurried, commas over periods | `[thoughtful]` | neutral |
| `gentle-after-miss` | wrong answer | soft opener, no exclamation, slight slow | `[gently]` | concern·low |
| `naming-the-mistake` | misconception named (doc 31) | plain declarative, steady | `[matter-of-fact]` | neutral |
| `quiet-encourage` | frustration detected *from lesson state* | short sentences, warm, slower | `[encouraging]` | warmth·low |
| `celebrate-small` | step landed | one exclamation max, brighter | `[happy]` | joy·med |
| `celebrate-big` | skill mastered | two short bright sentences | `[excited]` | joy·high |
| `calm-refocus` | off-topic / S1–S2 redirect | flat-warm, no reproach in the sound | `[calm]` | neutral |
| `safety-serious` | S3 deflection; S4 handoff | slow, level, caring; **fixed scripts only at S4** | `[softly]` `[serious]` | concern·med |

Band modulation multiplies the palette rather than duplicating it: **K–2** shifts everything slower and more melodic (pin the exact speed/style mechanism at PR) — and for K–2 **the voice is the primary interface, on by default**, because doc 31's whole premise is that a six-year-old can't read the chat; **3–5** slightly slow; **6–8** neutral; **9–12** natural adult register — a teen hears performed enthusiasm as condescension, which is the same failure as complexity, inverted.

**The two lines that make this palette safe, drawn explicitly:**
1. **No intimacy tones exist.** Nothing whispered-affectionate, nothing longing, no "I missed you" register. The tutor is a warm *teacher*, not a companion — doc 19's anti-dependency rule and the FTC's companion-bot inquiry (doc 31 §3.1) are enforced *here*, in the enumeration, because tone is exactly where dependency-farming would otherwise creep in. A closed palette can't drift; that is why it's closed.
2. **Tone responds to the lesson, never to the child's affect.** `quiet-encourage` fires on *lesson state* (third miss on the same step), not on voice/face analysis of the child. Audio2Emotion runs on **Natalie's output audio only** — never on the child's input. The no-emotion-recognition-of-minors decision (doc 19, on US-law grounds) stands with zero exceptions, and this sentence is the CI-reviewable form of it.

## §5 · Cost & ops
TTS joins doc 12 §7's per-learner-day cost model as its own line: Flash for every live turn (K–2 always-on doubles spoken volume — budget it, don't discover it), v3 only for baked assets (rendered once, cached on Bunny/Stream per doc 29, replayed forever). Per-band daily voice budget rides the same graceful session-length UX as the inference budget. Pricing/credits move often — pin at PR, and note ElevenLabs is a Shipaton Ship Kit partner (doc 27), so the **Devpost video narration** is a legitimate free first use of the baked path even while demo scope keeps live voice cut.

## §6 · What changes where
- **Doc 18:** Phase-3 realtime voice amended per §2.4 — ElevenLabs-only supersedes Gemini Live's native voices.
- **Doc 07/31:** sentence window gains TTS dispatch; S4 scripts gain their baked-audio requirement.
- **Doc 12 §7:** TTS cost line + voice-budget shed order (voice degrades to text before tutoring degrades at all).
- **PRs:** PR-119 voice asset + registry pinning + rights review · PR-120 tone palette + LLM structured-tone output · PR-121 Flash streaming on the sentence window with prosody stitching · PR-122 baked pipeline (v3 → A2F/A2E → blendshape clips → Bunny) · PR-123 K–2 voice-on-by-default UX + budgets · PR-124 drift check + band listen-evals.

## §7 · Sources
[Eleven v3 launch](https://elevenlabs.io/blog/eleven-v3) · [Audio tags 101](https://elevenlabs.io/blog/v3-audiotags) · [ElevenLabs TTS docs — Flash 75ms, textual-cue emotion, previous_text stitching](https://elevenlabs.io/docs/overview/capabilities/text-to-speech) · [v3 GA developer review](https://inworld.ai/resources/elevenlabs-v3-review) · [Eleven v3 2026 guide](https://aividpipeline.com/blog/eleven-v3-guide-2026) · [ElevenLabs 2026 cheat sheet](https://www.webfuse.com/elevenlabs-cheat-sheet) · [ElevenLabs 2026 review/pricing](https://gaga.art/blog/elevenlabs-review/) · [NVIDIA Audio2Face-3D hub](https://github.com/NVIDIA/Audio2Face-3D) · [A2F-3D samples — emotion auto-detect or specified](https://github.com/NVIDIA/Audio2Face-3D-Samples) · [A2F microservice architecture — 30fps blendshapes, limits](https://docs.nvidia.com/ace/audio2face-3d-microservice/1.0/text/architecture/audio2face-ms.html) · [A2F open-sourcing coverage](https://gadgetbond.com/nvidia-audio2face-ai-voice-animation-open-source/) · Pack docs 07/12/18/19/24/27/29/31.

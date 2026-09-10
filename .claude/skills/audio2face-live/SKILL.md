---
name: audio2face-live
description: Drive a 3D avatar's face from TTS audio in real time with NVIDIA Audio2Face-3D and Audio2Emotion — server-side inference producing 52 ARKit blendshape frames plus emotion, shipped alongside the audio and scheduled on the client's audio clock, with alignment-viseme and calm-idle fallbacks. Use this whenever a task mentions Audio2Face, A2F, Audio2Emotion, A2E, NVIDIA ACE, audio-driven facial animation, lip sync that "looks fake/robotic/evenly spread", ARKit blendshapes from speech, or making an avatar's face react to what it says — even if the user only says "the face should follow the voice" or "she doesn't emote".
---

# Audio2Face Live

Text-aligned visemes move the mouth. Audio2Face moves the **face** — brows, lids, cheeks, corners, jaw — timed to the actual audio, with emotion inferred from the voice. That is the gap between a puppet and a person, and since NVIDIA open-sourced the SDK (MIT) with open-weight models, it is a server component you can own.

## What it is, precisely (verify against the repos before citing)
- **Audio2Face-3D SDK** — C++/CUDA/TensorRT, streaming, multi-track, faster than 60 fps. **MIT.** https://github.com/NVIDIA/Audio2Face-3D-SDK
- **Models** — lip-sync: regression v2.3 (faster) and diffusion v3.0 (richer); **Audio2Emotion** v2.2 (production) and v3.0 (experimental). Index: https://github.com/NVIDIA/Audio2Face-3D · A2E weights https://huggingface.co/nvidia/Audio2Emotion-v2.2 · samples https://github.com/NVIDIA/Audio2Face-3D-Samples
- **Output** — ARKit blendshape weights per frame (the 52-name set) + emotion state. If the avatar's morph targets are ARKit-named, the mapping is identity; otherwise build a matrix once.
- **Licences differ:** A2F models under the NVIDIA Open Model License; **Audio2Emotion under a custom licence "for use with the Audio2Face project"**; training framework Apache-2.0. Read and cite each before production.
- **Runs on NVIDIA GPUs only.** The hosted `build.nvidia.com` endpoint was deprecated in April 2026 — self-host.

## Where it goes in a TTS avatar pipeline
```
text → TTS (streamed audio) ──┬──► client audio queue ──► speaker
                              └──► A2F/A2E (server GPU) ──► blendshape frames @30/60 fps + emotion ──► client face bus
```
- **Same audio buffer feeds both.** Compute A2F from the exact bytes the client will play; ship frames **with** the audio for that sentence so they never race.
- **The client's audio clock is the master.** Schedule frame `k` at `sentenceStart + k / fps` on `AudioContext.currentTime`; delay the whole frame timeline by the platform's reported output latency per route (Bluetooth adds 150–300 ms).
- **Pipeline, don't serialize.** A2F is faster than real time; prefetch sentence N+1's audio + frames while N plays. Target: frames arrive no later than the audio.
- **Keep the product's safety layer in the loop.** The avatar's performance (visemes, emotion, gesture) is an *output of the assistant's turn*; a UI feature never calls A2F directly.
- **Emotion is a modulation, not a mood.** Map A2E categories onto the product's existing emotion baseline (e.g. BEAT's eight) and smooth transitions (~0.4 s smoothstep). Emotion for a child-facing tutor comes from **lesson state**, never inferred from the child — A2E reads the **avatar's** voice only. Never feed a user's or a child's audio to A2F/A2E.

## Fallback chain (fail closed, never frozen)
1. A2F frames present → full performance.
2. A2F unavailable → **alignment visemes** from the TTS provider's character timestamps (mouth-only, still timed).
3. No alignment → evenly-spread visemes (last resort; visibly worse).
4. No audio → calm idle with mouth closed; captions carry the words. Never a frozen face, never an error screen on a child-facing surface.

## Do this when the skill fires
1. Confirm the target mesh's morph names (dump `extras.targetNames` / `morphTargetDictionary`). ARKit-named → identity map.
2. Decide regression vs diffusion **by measurement** on the product's real TTS voice; record end-to-end added latency p50/p95.
3. Stand up the SDK on a GPU host inside the existing gateway; cost the instance and write it into the ADR.
4. Return `{ audio, frames[], fps, emotion }` per sentence; implement the client scheduler on the audio clock with per-route offset.
5. Re-render any pre-baked speech through the same path so live and baked faces match.
6. Measure audio↔face offset per output route (≤ 40 ms; ITU-R BT.1359 thresholds ≈ +45 ms audio-leading / −125 ms lagging).
7. Write the licence citations into the ADR.

## Stop and ask
The A2E licence does not clearly permit the intended commercial use · A2F cannot be pipelined inside the voice latency budget without a serial hop · any design would send a user's voice to the model · the mesh's morph set lacks bilabial closure or the range the emotion palette needs.

## In this repository

`references/repo-anchors.md` maps every step above onto a real file and symbol —
the client contract, the audio sink to tee from, the tone palette, and the baked
crisis pieces A2F must never sit in front of. Read it before wiring anything;
the mapping question the body leaves open ("if the morph targets are ARKit-named")
is already answered for this asset, and the answer changes the work.

## References
NVIDIA ACE overview https://developer.nvidia.com/ace-for-games · A2F-3D SDK https://github.com/NVIDIA/Audio2Face-3D-SDK · model index https://github.com/NVIDIA/Audio2Face-3D · samples https://github.com/NVIDIA/Audio2Face-3D-Samples · Audio2Emotion v2.2 https://huggingface.co/nvidia/Audio2Emotion-v2.2 · ARKit blendshape names https://developer.apple.com/documentation/arkit/arfaceanchor/blendshapelocation · ElevenLabs alignment (fallback 2) https://elevenlabs.io/docs/developers/websockets · ITU-R BT.1359 https://www.itu.int/rec/R-REC-BT.1359 · Web Audio clock https://www.w3.org/TR/webaudio/

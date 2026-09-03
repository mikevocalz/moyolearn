# Where the face travels — clocks, hops, fallbacks (system-design pass)

SOT-KEYWORDS: audit motion pipeline a2f frames audio clock gateway safety plane fallback onset lead

```
coach turn (Safety Plane) ──► sentence window + tone + MAC tag
        │
        ▼  POST /api/tutor/voice  (tag verified; refused → 403, never rendered)
  @acme/voice egress ── ElevenLabs Flash v2.5 ──► mp3 bytes
        │                                          │
        │  AUDIO2FACE_URL set?  ── yes ──► drain to bytes ──► POST {host}/v1/face (audio, tone.a2f) ──► { fps, names, frames }
        │                                          │                                   │
        │                                          └── fail / timeout 2.5 s ───────────┘ → audio only
        ▼
  200 application/json { audio, audioContentType, face }      or      200 audio/mpeg
        │
        ▼  tutor-audio.ts (client, outside React)
  decode ──► first sentence of the turn: source.start(now + 0.3 s)  ── later sentences: start(now)
        │
        ├── isSpeaking(): source && now ≥ start
        ├── timeUntilOnset(): start − now while scheduling            → idle engine anticipation
        ├── sampleFace(): frames[t·fps], name-mapped, interpolated     → 3D writer face / 2D face bus
        └── sampleSpeech(): face if present, else analyseSpeech track → mouth
        │
        ▼  tutor-avatar-3d.native.tsx (frame loop, refs only)
  presence.step(dt, { speaking, phase, mouth, face, emotion, partnerPauseEvent, timeUntilOnset, reducedMotion })
        │
        ▼  humano.ts — ONE pose per frame: idle engine (seeded) + beats + face + emotion → DEF-* bones + morphs
```

**The clock.** `AudioContext.currentTime` is the master on every platform (react-native-audio-api is Web Audio). Frame `k` is at `start + k/fps`; the stage samples at render time, so the audio↔face offset is the render loop's latency plus the platform's output latency. The per-route output offset (speaker / wired / Bluetooth) is **not yet applied** — `AudioContext.outputLatency` is the value to subtract when it is exposed on native; measure per route per the bar.

**Cues, the other input.** `tutor-cues.ts` (typing cadence with a 1.2 s hold, open recorder, send) is read per frame by the stage. Not audio; no microphone; doc 22 §3 stands.

**Fallbacks.** frames → analysis mouth → (no audio) 2D mark or calm idle. A missing face is never logged to a child; the route's 204 contract is unchanged.

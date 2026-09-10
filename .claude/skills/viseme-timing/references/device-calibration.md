# Per-device, per-route offset calibration

## Why this table exists and why it is empty

`AudioContext.currentTime` is the audio **graph** clock. Everything downstream of the graph — the mixer, the DAC, the speaker driver, a wired jack, a Bluetooth codec's buffer — is invisible to it. The graph reports a perfect schedule while the sound comes out later.

The repo already knows this. From the `packages/avatar/src/speech/backend-audio-api.ts` header:

> `currentTime` is the graph clock, not the speaker clock, so a Bluetooth route's 150-300ms is invisible to it. If a per-route offset proves necessary, it belongs here, fed by AudioManager's `routeChange`.

No offset is applied anywhere in `packages/` or `apps/` today — verified by grep, 2026-09-10. Every route currently runs at offset 0.

**This table ships with no measurement rows.** The 150–300 ms in that header comment is a note about Bluetooth in general, not a measurement of any device Moyo runs on, and it must not be copied into the table as if it were one. A calibration table with invented rows is worse than an empty one: it applies a wrong correction confidently, and the resulting error is untraceable because it looks like data.

## How to fill a row

1. Render a known utterance from the fixed test set through the real live path — same voice ID, same `model_id`, same `voice_settings`, same `output_format`. Save the decoded PCM as the source WAV.
2. Put the device on the target route (built-in speaker, wired, or the specific Bluetooth codec — SBC, AAC and aptX buffer differently and are separate rows).
3. Play it and capture through a loopback: an external mic in a quiet room for a speaker route, a line capture for wired. Save as the capture WAV.
4. `node .claude/skills/viseme-timing/scripts/measure-offset.mjs <source.wav> <capture.wav>`
5. Run it three times. Record the median and the spread. A spread above ~15 ms means the capture is contaminated — re-do it before recording anything.
6. Add the row below with the date, the exact OS build, and the operator.

The measurement is a normalized cross-correlation of the two amplitude envelopes, so it is insensitive to level and to the codec's frequency response. It is sensitive to clock drift over long captures — keep the clip under 10 seconds.

## Route classes

Measure each separately. They do not interpolate.

| Class | Why it is its own row |
|---|---|
| `speaker` | Built-in path. Lowest latency, but varies by chassis. |
| `wired` | 3.5 mm or USB-C DAC. Adds the DAC's own buffer. |
| `bt-sbc` | SBC's buffer is the largest of the three codecs. |
| `bt-aac` | iOS default for most headsets. |
| `bt-aptx` | Android, where the headset supports it. |
| `receiver` | Earpiece. Different mixer path from `speaker` on both platforms. |

Re-measure on: a new device model, an OS major version bump, a change to the iOS audio-session category/options, and a `react-native-audio-api` upgrade. Any of those can move the buffer.

## The table

| Device | OS build | Route | Offset (ms) | Spread (ms) | Measured | By |
|---|---|---|---|---|---|---|
| _(none measured)_ | | | | | | |

## Applying an offset

Subtract it from the playback position before sampling, in the backend — not in the scheduler and not per call site:

```
t = audio.currentTime() - playbackStartAt - routeOffsetSeconds
```

The scheduler at `packages/app/features/tutor/tutor-audio.ts:373` computes the first two terms today. The third belongs where the header says it does, fed by `routeChange`, so exactly one place knows about routes.

An unmeasured route gets offset 0 and stays marked unmeasured. Zero is a known-honest state; a guessed correction is not.

## What the offset does and does not fix

It fixes a constant delay. It does not fix jitter, and it does not fix a device whose buffer changes size mid-session — a route change during playback needs the schedule re-based, not just re-offset.

ITU-R BT.1359-1's asymmetry is the reason the sign matters: sound advanced (mouth late) is detectable at 45 ms, sound delayed (mouth early) at 125 ms. An over-correction that makes the mouth early is roughly three times more forgiving than an under-correction that leaves it late. When a measurement is uncertain, err toward over-correcting. <https://www.itu.int/rec/R-REC-BT.1359>

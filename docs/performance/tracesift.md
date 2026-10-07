# TraceSift performance workflow

TraceSift is the default local analyzer for React Profiler, Hermes, and JavaScript CPU captures in Moyo.

## Setup

Requires macOS or Linux and Node.js 22.19 or newer.

```sh
pnpm perf:tracesift:init
pnpm perf:tracesift
```

TraceSift runs locally. Do not place provider credentials or TraceSift auth files in the repo.

## Moyo scenarios

Profile one user flow at a time, with the same device/build and comparable data:

- Tutor Room entry, scene changes, and AI tutor UI updates;
- whiteboard/drawing interactions and inspector/split-view changes;
- conference-room participant grid, chat, screen/file/whiteboard updates;
- OCR/camera result presentation after capture;
- Rive tutor/HMI state changes;
- tablet/foldable pane transitions;
- XR scene entry and panel updates;
- student dashboard/list rendering with realistic data.

Use React Profiler exports for render/commit churn. Use Hermes/JS CPU profiles for expensive JavaScript work.

If the bottleneck is inside ViroCore, VisionCamera, Skia, WebGPU, video, or another native/GPU layer, continue with that platform's profiler. TraceSift is the triage/handoff layer, not a replacement for native traces.

## Performance PR evidence

For meaningful performance fixes, include:

1. exact scenario and device/simulator;
2. build mode;
3. TraceSift finding/handoff summary;
4. before/after measurement from the same scenario;
5. native/GPU evidence too when the hotspot crosses out of JS.

Do not commit raw profiles by default; they may contain source paths, interaction details, or session data.

# ADR-121: one GPU device for Natalie, Skia and inference — or siblings

Status: proposed. The decision needs Scenario J/K numbers from physical devices,
which this branch cannot produce. What is settled here is the starting point,
which is not what the migration brief assumes.
Date: 2026-09-17

## Context

The brief frames this as a choice between **A** — everything on Skia Graphite's
device via `importDevice(Skia.getNativeDevice())` — and **B** — Graphite for
Natalie and Skia, a sibling device for inference. Both options assume a single
shared device exists to build on.

It does not. Read against the installed source, the tree has **at least three
independently requested devices and no sharing at all**:

| Site | What it does |
|---|---|
| `packages/app/features/tutor/tutor-avatar-3d.native.tsx:410` | `new THREE.WebGPURenderer({ antialias, alpha, canvas: context.canvas, context })` — **no `device` option** |
| `apps/mobile/components/splash/hearts-gpu.tsx:395-396` | `navigator.gpu?.requestAdapter()` then `adapter?.requestDevice()` |
| `apps/mobile/src/native-3d/webgpu-smoke.tsx:133-135` | the same pair again |

The first line is the one that matters. Three's `WebGPURenderer` requests its own
device when the option is omitted, and that device is then unreachable — it
cannot be handed to TypeGPU, it cannot be shared with Skia, and it cannot be torn
down in coordination with anything else. **Natalie's device is currently out of
reach**, so neither A nor B is implementable as written until she is handed one.

Nothing interoperates with Skia today either: `getNativeDevice`,
`MakeImageFromNativeTexture`, `MakeNativeTextureFromImage` and `adoptTexture`
appear in zero files outside `node_modules`. Skia and WebGPU are separate stacks
in this repo, not a shared one.

And `device.lost` is handled in **zero** files; `uncapturederror` in one. Whatever
topology is chosen, a lost device today is an unhandled failure.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| **0. Stay as-is** | Every consumer requests its own device | `tutor-avatar-3d.native.tsx:410` — no `device` passed | No work | Dawn's per-device mutex buys nothing across devices; no zero-copy anywhere; Natalie's device unreachable for teardown or profiling; `runntime` has no device to attach to |
| **A. One device** | Adopt Graphite's: `importDevice(Skia.getNativeDevice())`, pass it to `WebGPURenderer({ device })`, `tgpu.initFromDevice({ device })` | `node_modules/react-native-webgpu/.../importDevice` (exported at 0.9.0); `node_modules/@shopify/react-native-skia/lib/typescript/src/skia/types/Skia.d.ts:getNativeDevice(): bigint`; `ImageFactory.d.ts` for the texture factories | Zero-copy camera→inference and Three→Skia; one queue to reason about; one device-loss listener | Every consumer shares Dawn's per-device mutex and one queue; Skia treats loss of its device as fatal, so an inference-induced loss takes the whiteboard with it |
| **B. Two devices** | Graphite's device for Natalie and Skia; a sibling from `navigator.gpu.requestDevice()` for `runntime` | same seams; sibling via the `requestAdapter`/`requestDevice` pair already used at `hearts-gpu.tsx:395` | Separate queue and mutex; a lost inference device does not kill Skia | Same physical GPU — this is scheduling isolation, not hardware isolation; vision inference wanting camera textures needs `importSharedTextureMemory` on the sibling or a copy |

Option 0 is listed because it is the status quo and the brief does not acknowledge
it. It is not a straw man: it is what ships today.

## Decision

**Proposed: B, and it is blocked on a prerequisite the brief does not name.**

Before A or B can be measured, `tutor-avatar-3d.native.tsx` must pass a `device`
into `WebGPURenderer`. That is a precondition, not part of the choice — under
Option 0 Natalie's device cannot be shared *or* isolated, because nobody else can
name it.

B is the default hypothesis for the reason the brief gives and the evidence
supports: the inference inputs Moyo would run first are text and PCM, which
originate on the CPU and gain nothing from texture sharing, so isolation costs
nothing there. Vision workloads are the case that would argue for A, and they are
gated behind `shader-f16` and consent and are not in the near path.

## Consequences

- **Easier:** one named device per concern, so teardown, `device.lost` handling
  and GPU profiling have somewhere to live. `runntime` has a device to attach a
  TypeGPU root to without touching Skia's queue.
- **Harder:** two devices mean two loss listeners and two capability snapshots,
  and any future camera→inference path has to cross a device boundary with
  `importSharedTextureMemory` or pay a copy. The splash's own device
  (`hearts-gpu.tsx`) becomes a third one that this ADR does not cover and should.
- **Follow-ups:**
  1. Pass `device` into the native `WebGPURenderer` — the prerequisite above.
  2. Bump `react-native-webgpu` 0.9.0 → 0.10.2. The installed pair is skewed:
     `dawn: "chrome-m152"` against Skia 2.12.0's Graphite `154.0.0`
     (`docs/compute/versions.md`). Neither option is testable on a mismatched Dawn.
  3. Add `device.lost` and `uncapturederror` handling on the main JS runtime —
     the only runtime where they fire — since today there is none.
  4. Measure Scenario J and K for A and B and record Natalie's p50/p95/p99. This
     ADR moves to `accepted` on those numbers and not before; emulators are
     excluded because they fall back to a software adapter.
  5. Decide whether the splash's device folds into this topology or stays
     deliberately separate, and write the reason down either way.

## Constraints honored

Zustand-only for any new capability/topology state · no invented APIs — every
seam above is cited to an installed `.d.ts` or a repo file and line · no
measurement is claimed that was not taken.

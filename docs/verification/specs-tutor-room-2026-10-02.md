# Moyo Learn → SPECS 27 Tutor Room proof

This branch adds the first product-level consumer of the Viro SPECS build-time
compiler.

Source:

`packages/app/features/tutor/tutor-specs-scene.native.tsx`

It is intentionally a small static Tutor Room composition, not a fork of the
live XR screen. The goal is to prove that Moyo's existing Viro vocabulary can
be compiled into the validated Lens Studio backend:

- root teaching-space transform;
- board slot;
- Natalie GLB;
- reference panel;
- text;
- ViroPolyline focus rail.

## Why this file is static

SPECS does not run React Native. The Viro compiler reads this source at build
time and emits the portable scene manifest that the Lens runtime consumes.

The real Tutor Room's live data stays in Moyo's existing stores. A later
state/action bridge sends only portable lesson/tutor updates to the Lens
runtime; it does not move React itself onto the glasses.

## Current dependency boundary

Moyo currently vendors an older Viro build. The local `ViroSpecsScene` marker
in this proof keeps it type-safe today.

After the public Viro SPECS stack lands:

- viro #30 — public runtime/CLI
- viro #31 — JSX bridge
- viro #32 — animation + AR facade
- viro #33 — cross-platform Platform Lab
- viro #34 — build-time static compiler
- viro #35 — generated Lens Studio host

the local marker can be replaced by the public export without changing the
child scene.

## Final validation

Once the Viro release candidate is vendored into Moyo:

```bash
viro-specs compile \
  --entry packages/app/features/tutor/tutor-specs-scene.native.tsx \
  --out "/path/to/Viro Specs Platform Lab/Assets/ViroSpecs/generated/MoyoTutorRoomGenerated.ts" \
  --format lens-ts
```

Then sync that manifest into the already-validated SPECS 27 Lens project and
run the CLAD/LEAF loop.

The only remaining acceptance after simulator validation is physical-device
certification.


The generated component applies the scene through the validated runtime hosts,
enables Natalie select/drag intent through SIK, plays the title pulse through
Lens AnimationPlayer, and presents the focus rail through VolumetricLine.

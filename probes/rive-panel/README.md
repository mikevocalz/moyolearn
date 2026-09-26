# Native Rive panel probe

Engineering route: `moyo://rive-panel-probe` (Android XR build). This scene
isolates the native Surface material, artboard input, and parent grip drag.
It is not yet embedded into the full Tutor Room composition.

`rive/scene.rml` is the editable source. Build and exercise it with Rive CLI
1.1.1: `python3 probes/rive-panel/verify-rive.py` from the repository root.
The script verifies/inspects the scene and saves nine pointer-driven cases
in `evidence/`. Copy the resulting `rive/build/moyo_fractions.riv` to
`apps/mobile/assets/rive/moyo_fractions.riv` after authoring changes.
These captures are Rive CLI evidence, not headset captures.

Artboard `Fractions`, state machine `Lesson`, default view model `Lesson`:

| Binding | Type | Purpose |
|---|---|---|
| lessonTitle | string | Lesson heading |
| selectedCount | number | Rive-authored selected piece count (observed by JS) |
| hintVisible | boolean | Show/hide hint |
| grabbed | boolean | Moving-panel state |
| reducedMotion | boolean | Use immediate state changes instead of 160 ms fades |
| lastAction | string | Last authored interaction |
| piece0–piece3 | number | Selected state, 0 or 1 |
| hover0–hover3, down0–down3 | number | Authored pointer states |
| revision | number | Interaction revision |

The four equal pieces toggle independently. Two selected pieces show
`2 / 4 = 1 / 2`. Pointer cancellation exits the artboard before release.
The amber grip moves the native parent; canvas input is suspended while held.

Font: unchanged `SpaceGrotesk-Variable.ttf` copied from Moyo's
`packages/assets/fonts`; copyright 2020 The Space Grotesk Project Authors.
The included `rive/OFL.txt` is the upstream SIL OFL 1.1 license from
https://github.com/google/fonts/blob/main/ofl/spacegrotesk/OFL.txt.

See `docs/handoffs/2026-09-25-rive-viro-panel.md` for build provenance,
validation results, limitations, and the device checklist.

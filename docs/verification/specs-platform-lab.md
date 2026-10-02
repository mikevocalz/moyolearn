# Moyo SPECS cross-backend smoke scene

Moyo now has a deliberately small Viro-authored scene at:

`packages/app/features/tutor/moyo-specs-platform-lab.native.tsx`

It is not a second tutor-room implementation. It is a renderer proof that uses
the same public Viro JSX that the shipping spatial tutor already relies on.

## Scene contents

The scene contains only the first portable Viro/SPECS component set:

- `ViroARScene`
- `ViroNode`
- `ViroText`
- `Viro3DObject` using Moyo's existing Natalie XR GLB
- `ViroPolyline`
- normal `onClick` and `onDrag` callbacks

There is no Specs/Lens Studio API in Moyo application code and no duplicate
tutoring state.

## Purpose

This gives us one concrete application scene that can be:

1. mounted normally through ViroCore on existing XR targets;
2. passed through Viro's portable JSX compiler;
3. mounted through the validated `@viro-external/specs` backend;
4. exercised in Lens Studio SPECS 27 Preview.

The asset resolver maps Natalie's React Native asset reference to the stable
Lens registry ID:

`moyo:tutor:natalie`

## Dependency order

The final Lens validation should run after these upstream PRs are green:

- `mikevocalz/viro` #21 — runtime/capability API
- `mikevocalz/viro` #22 — portable JSX compiler
- `mikevocalz/viro` #23 — Viro Specs CLI and Platform Lab
- `mikevocalz/viro` #24 — runtime bridge
- `mikevocalz/viro-external` #20 — publishable SPECS 27 backend 0.2.0
- `mikevocalz/virocore` #34 — backend semantic parity contract

Until the updated Viro package is vendored into Moyo, this PR only adds the
one-source smoke scene using Viro APIs already present in Moyo's current fork.
That keeps the app build independent of the still-open public integration stack.

## Final Lens Studio acceptance

With Lens Studio open, the final test should compile this scene via
`compileViroSpecsJSX()` with a resolver that returns
`moyo:tutor:natalie`, register the Natalie prefab in the Specs asset registry,
and verify:

- root appears at -1.5 m / -150 cm in Lens;
- prompt/title are readable;
- Natalie renders and can be dragged;
- Ask Natalie pinch/select reaches the Viro callback;
- working line renders with 0.008 m diameter / 0.004 m radius;
- no Lens/Viro runtime exceptions;
- the generic Platform Lab regression suite remains green.

That Lens pass is intentionally the last software validation step.

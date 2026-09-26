# rive-icons

Deterministic Lucide → Rive RML converters for the BoardChrome chrome scene
(`probes/rive-panel/rive-board-chrome/`). Vector path, not the PNG atlas —
icons stay crisp at any panel scale and inherit the scene's stroke styling.

## convert.mjs

Parses the `node:` arrays out of
`node_modules/lucide-react-native/dist/cjs/icons/*.js` and emits RML
`<Node>/<Shape>` fragments (`PointsPath` + `StraightVertex`/`CubicDetachedVertex`,
`Ellipse` for circle nodes). Handles M/L/H/V/C/S/Q/T/A/Z; quads are elevated to
cubics and elliptical arcs converted to cubics (endpoint→centre, ≤90° splits).

```bash
node tooling/rive-icons/convert.mjs                    # fragments → build/icons.frag.rml
node tooling/rive-icons/convert.mjs --inject <scene.rml>
node tooling/rive-icons/convert.mjs --list
```

`--inject` replaces `<!-- @icon:Name -->` markers (or existing
`<!-- @icon:Name:begin/end -->` regions) in the scene. Icon placement lives in
the `ICONS` table at the top of the script — artboard-unit centres and scale
against the 24-unit Lucide viewBox.

## fill-scene.mjs

Fills the remaining `<!-- @... -->` markers in `scene.rml` with the mechanical
blocks driven by `packages/ui/xr/board-chrome-layout.ts`: ink swatches, the
grouped hit-rect nodes (`ToolsHits`/`InksHits` — slid 3000u off-artboard by the
Palette layer because opacity does not gate Rive hit-testing), state machine
layers, pointer listeners (`command` + `commandSeq` writes), the `Is index i`
formula converters, and the `BoardChrome` view model.

```bash
node tooling/rive-icons/fill-scene.mjs          # rewrite marker regions
node tooling/rive-icons/fill-scene.mjs --check  # diff-check only
```

Run order: `convert.mjs --inject` then `fill-scene.mjs`, then
`rive . --verify` in `probes/rive-panel/rive-board-chrome`.

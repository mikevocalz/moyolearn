# Forge toolbar Rive asset

Five original Forge glyphs are compiled from the pinned SVG tuples into one
script-free vector file. Source is `mikevocalz/nitro-forge` commit
`3c79e3d4c2dbd0c42d7fdccea40eb0a7162b6c48`, `packages/icons/src/glyphs.js`.
The generator checks that file's SHA-256 before writing `scene.rml`.

The component artboards are `ForgePen`, `ForgeHighlighter`, `ForgeEraser`,
`ForgeUndo` and `ForgeRedo`. Each has the `ForgeIconStates` state machine and
the `ForgeIcon` view model:

| Property | Type | Host contract |
| --- | --- | --- |
| `selected` | Boolean | False = original outline; true = original filled glyph. |
| `reducedMotion` | Boolean | Selects a zero-duration transition. Normal selection blends for 140 ms. |
| `color` | Color | ARGB icon color, default `FF18202D`; the host resolves theme/selected/status colors. |
| `surfaceColor` | Color | ARGB background under knockout details, default `FFFFFFFF`. |
| `opacity` | Number | Presentation opacity, 0–1; the host resolves disabled/loading visibility. |

Each mounted icon needs its own runtime view-model instance. The asset owns no
tool selection, input router, document or operation status. The host's semantic
button supplies its label, touch target, focus, selected/disabled/busy state and
press/hover feedback. There is no loading loop or invented success animation.

The original SVG paths, paint modes, stroke width and ordering are preserved.
SVG ellipse arcs use the standard endpoint-to-center conversion into cubic
segments of at most 45 degrees. The conversion test measures less than 0.00001
glyph units of circular radius error; the headless render check also compares
every outline/filled variant with the original SVG renderer. Knockout paths
retain the source's explicit surface paint.

Regenerate with the repository dependencies installed and Rive CLI 1.6.0:

```sh
node probes/forge-icons/generate.mjs
node --test probes/forge-icons/svg-path.test.mjs
rive probes/forge-icons --verify
rive probes/forge-icons --once
node probes/forge-icons/verify-render.mjs
cp probes/forge-icons/build/moyo_forge_icons.riv apps/mobile/assets/rive/moyo_forge_icons.riv
```

`scene.rml` is generated; edit the generator/converter, then regenerate.
`verify-render.mjs` runs the five source tests, renders ten variants, compares
them to SVG, checks a real intermediate selection frame and verifies immediate
reduced-motion selection plus theme colors. Its screenshots and report go to
ignored `build/`; the checked-in evidence records the run for this asset.

The `.riv` is an **unsigned `--once` build with no scripts**. Rive's signing
service is not needed for script-free vector files. CLI compilation, inspection
and headless rendering passed. Native Rive loading, view-model binding,
interaction, accessibility and performance are **NOT RUN** for this asset;
the existing installed SVG fallback remains the verified source-level UI path.

Skills applied: the pinned Expo animation skill's routine-feedback tier
(140 ms, opacity, no spatial movement); Impeccable's Operate guidance and
existing identity; no-ai-slop's evidence/status rules. Rive API details came
from CLI 1.6.0 `format`, `drawing`, `data`, `state-machines`, `easing`,
`publishing` docs and the `SolidColor` / `CubicDetachedVertex` schemas.

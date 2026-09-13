// The scene's colours, as plain values.
//
// Two kinds of colour exist in a Viro scene: the ones that become MATERIALS
// (registered by name, used by geometry) and the ones that are ordinary props —
// `ViroText.style.color`, `borderColor`. The first kind needs the renderer; this
// second kind does not, which is why it lives in a file with no Viro import and
// the web fork can answer with the same values.
//
// Both kinds come from `packages/theme/tokens.ts`. `CLAUDE.md` §UI: no hex
// literals, and a missing token gets added to that file. The first pass here
// carried the spatial design system's stock palette — generic headset-demo
// colours that had never met Moyo's — which is the drift a spatial surface is
// most prone to, because nobody ever holds it up next to the 2D product.
//
// `dark` values throughout, deliberately. A headset scene is a dark room with
// panels floating in it; the light scheme's cream chrome would glow in it. The
// paper is the one exception and keeps its light value, because the board is
// always light paper (`whiteboard.types.ts`).
// SOT: packages/theme/tokens.ts · packages/ui/xr/spatial-materials.native.ts
// SOT-KEYWORDS: xr colours tokens text colour focus ring disabled void spatial no viro

import { palette, semantic } from '@acme/theme';

/**
 * The scene's text and stroke colours, for the props ViroCore takes as a colour
 * rather than as a material — `ViroText.style.color`, `borderColor`.
 *
 * Same rule and same reason as the materials above: the token file is where a
 * colour is decided, and a spatial surface is the easiest place in the codebase
 * for a stock palette to creep in unnoticed.
 */
export const XR_COLOR = {
  /** On the dark rail and card. */
  onPanel: semantic.surface.light,
  onPanelMuted: palette.ink[300],
  /** On a selected (light) key. */
  onKey: semantic.surface.dark,
  focus: semantic['border-strong'].dark,
  disabled: semantic['surface-sunken'].light,
  /** The scene's own ground, behind the passthrough layer. */
  void: semantic.surface.dark,
} as const;


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
// `dark` values throughout, deliberately — with two named exceptions below. A
// headset scene is a dark room with panels floating in it; the light scheme's
// cream chrome would glow in it. The paper is the first exception and keeps its
// light value, because the board is always light paper
// (`whiteboard.types.ts`). The key's selected fill and the focus ring are the
// second, and `XR_SURFACE` says why on each line: both are drawn ON a key, so
// the adjacent colour they have to clear is the key, not the room.
//
// EVERY SURFACE COLOUR IN THE SCENE IS HERE AND NOT IN THE MATERIAL FILE, so
// the ratios between them can be asserted (`xr-colors.test.ts`). They used to
// live beside `ViroMaterials.createMaterials`, which imports the renderer, so
// no test in this package could read them — which is how three of them came to
// resolve to one colour without anything going red.
// SOT: packages/theme/tokens.ts · packages/ui/xr/spatial-materials.native.ts
// SOT-KEYWORDS: xr colours tokens text colour focus ring disabled void spatial no viro

import { palette, semantic } from '@acme/theme';

/**
 * The fills every spatial material is registered with.
 *
 * THE THREE KEY COLOURS ARE THREE COLOURS. `key`, `keySelected` and the focus
 * ring all resolved to `palette.ink[100]` for one release — 1.00:1 between
 * every pair — so a rail key's resting fill, its selected fill and its hover
 * ring were pixel-identical and a child could not see which tool was chosen or
 * where their ray was pointing (`06-a11y.md` F1, F2). The ratios that fix it
 * are asserted next door rather than written in a comment.
 */
export const XR_SURFACE = {
  rail: semantic['surface-raised'].dark,
  card: semantic['surface-raised'].dark,
  /** A resting key: 13.94:1 on the rail, so the control has a visible body. */
  key: semantic['surface-sunken'].light,
  /*
    SELECTED IS INVERTED INK, and it is the 2D tray's own rule rather than a
    spatial invention: `Whiteboard.tsx` draws its chosen tool as `bg-text` with
    `text-text-inverse` on it, having tried and rejected `bg-highlighter` —
    "one action wearing two accents … it dressed a MODE as the primary action".
    So the spatial key inverts too: `text` against the resting key's
    `surface-sunken` is 17.59:1, and the light step is the one that inverts the
    light fill the key actually has.

    `highlighter` cannot be used here even setting that argument aside. It is
    the product's selection teal, but `lagoon[500]` is 2.67:1 against the
    resting key and NO colour clears 3:1 against a key that light — pure white
    reaches 2.99:1. A fill that light has only one legal partner, and it is ink.
  */
  keySelected: semantic.text.light,
  frame: semantic['surface-sunken'].dark,
  paper: semantic['surface-raised'].light,
  onDark: semantic.surface.light,
  /*
    `focus.light`, not `focus.dark`, and this is the one prop in the scene that
    takes a light-scheme step for a reason other than the paper.

    The ring is drawn ON a key, so the adjacent colour it has to clear is the
    key and never the room. `focus.dark` (`gold[400]`) is 2.89:1 against the
    resting key — the obvious fix, and it misses 1.4.11. `focus.light`
    (`gold[500]`) is 4.02:1 there and 4.38:1 against the inverted-ink selected
    fill, which is the only value in the pair that clears both.
  */
  focus: semantic.focus.light,
} as const;

/**
 * The scene's text and stroke colours, for the props ViroCore takes as a colour
 * rather than as a material — `ViroText.style.color`, `borderColor`.
 *
 * Same rule and same reason as the surfaces above: the token file is where a
 * colour is decided, and a spatial surface is the easiest place in the codebase
 * for a stock palette to creep in unnoticed.
 */
export const XR_COLOR = {
  /** On the dark rail and card. */
  onPanel: semantic.surface.light,
  onPanelMuted: palette.ink[300],
  /** On a resting (light) key: 16.28:1. */
  onKey: semantic.surface.dark,
  /**
   * On a selected key, whose fill is that ink inverted: 19.21:1.
   *
   * `text-inverse`, not `onPanel`, though today they resolve to neighbouring
   * steps of one ramp. The pair `keySelected`/`onKeySelected` is `text` and
   * `text-inverse`, which is the pair the 2D tray uses and the pair
   * `check-contrast.mjs` already gates — so the two cannot drift apart without
   * something going red.
   */
  onKeySelected: semantic['text-inverse'].light,
  focus: XR_SURFACE.focus,
  disabled: semantic['surface-sunken'].light,
  /** The scene's own ground, behind the passthrough layer. */
  void: semantic.surface.dark,
} as const;


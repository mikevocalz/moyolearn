// The named materials the spatial surfaces draw with, registered once.
//
// ViroCore resolves `materials={['name']}` against a global registry, so this
// runs at module load rather than per component: a `createMaterials` call
// inside a render re-registers the same names every frame, and a name looked up
// before its registration renders untextured.
//
// WHY THE PAPER IS NOT GLASS. Everything else here is restrained and
// translucent, because that is what keeps a headset UI out of the way of the
// room. The board is the exception on measured grounds already recorded in
// `whiteboard.types.ts`: the paper is always light and always opaque, in both
// colour schemes, because a child reading their own pencil working through a
// translucent panel with a bookshelf behind it is reading two things at once.
// SOT: packages/ui/whiteboard.types.ts · packages/theme/tokens.ts
// SOT-KEYWORDS: xr materials viro spatial paper frame glass rail card registry

import { ViroMaterials } from '@reactvision/react-viro';
import { COLOR_IDS, THEMES } from '@quickdrawjs/core';
import { semantic } from '@acme/theme';
import { XR_SURFACE as chrome } from './xr-colors.ts';
import { XR_MATERIAL, inkMaterial } from './material-names.ts';

/*
  THE COLOURS COME FROM THE TOKEN FILE, not from this one. `CLAUDE.md` §UI: no
  hex literals, and if a token does not exist it gets added to
  `packages/theme/tokens.ts`. The first pass here carried the spatial design
  system's stock palette (`#1a1d24`, `#7dd3fc`, `#22262f`) — generic headset-demo
  colours that had never met Moyo's, which is exactly the drift a spatial
  surface is prone to because nobody puts it side by side with the 2D product.

  THEY ARRIVE FROM `xr-colors.ts` rather than being declared here, and the move
  is the point: this module imports the renderer, so nothing in the package
  could read the values it was registering. `key`, `keySelected` and the focus
  ring all resolved to `palette.ink[100]` — 1.00:1 between every pair — through
  a whole release, with the ratios asserted nowhere. They are asserted now
  (`xr-colors.test.ts`), which is only possible with the colours in a file that
  has no Viro import.
*/


/*
  The ink names and the material table are generated from the vendor's own
  `COLOR_IDS` and light theme rather than from a table copied here, which is what
  keeps spatial ink the same colour as 2D ink when either changes.
*/
export { XR_MATERIAL, inkMaterial } from './material-names.ts';

ViroMaterials.createMaterials({
  /*
    `Constant` lighting, not PBR. The paper's job is to be the same white
    everywhere on its surface; a lighting model would put the room's key light
    across a child's homework as a gradient and shade one corner of their
    working darker than the other.
  */
  [XR_MATERIAL.paper]: {
    diffuseColor: chrome.paper,
    lightingModel: 'Constant',
  },
  /* The frame reads as the edge of a sheet of paper, not as a window chrome. */
  [XR_MATERIAL.frame]: {
    diffuseColor: chrome.frame,
    lightingModel: 'PBR',
    roughness: 0.7,
    metalness: 0,
  },
  [XR_MATERIAL.rail]: {
    /* `e6` is 90% alpha — the rail is a panel in a room, not a cut-out. */
    diffuseColor: `${chrome.rail}e6`,
    lightingModel: 'PBR',
    roughness: 0.6,
    metalness: 0,
    blendMode: 'Alpha',
  },
  [XR_MATERIAL.card]: {
    diffuseColor: chrome.card,
    lightingModel: 'PBR',
    roughness: 0.75,
    metalness: 0,
  },
  /*
    `chrome.key`, not `chrome.frame`. It was the frame's near-black, which put a
    key at 1.26:1 against the rail it sits on — a control with no visible body,
    its label floating on the panel. The declared token measures 13.94:1.
  */
  [XR_MATERIAL.key]: {
    diffuseColor: chrome.key,
    lightingModel: 'PBR',
    roughness: 0.55,
    metalness: 0,
  },
  [XR_MATERIAL.keyPressed]: {
    /*
      A 20% white wash, the spatial equivalent of the 2D pressed state. Setting
      it as a `ViroFlexView`'s material REPLACES the resting one, so it
      composites over the rail (`#262420`) rather than over the key it
      succeeds: `#514F4B`. `RailKey` reads that and takes the light label there,
      which is 8.03:1 — the dark label it used to keep was 2.21:1.
    */
    diffuseColor: `${chrome.onDark}33`,
    lightingModel: 'Constant',
    blendMode: 'Alpha',
  },
  /*
    THE SELECTED FILL IS THE RESTING ONE INVERTED, at 17.59:1, and it is carried
    by an inset outline and an inverted label as well as by the colour — a tool
    picked out by colour alone is a tool a colour-blind child cannot find.

    It was `chrome.focus`, which was the same `ink[100]` as `chrome.key`, so
    `selected` swapped a key's fill from `#F6F3E8` to `#F6F3E8`.
  */
  [XR_MATERIAL.keySelected]: {
    diffuseColor: chrome.keySelected,
    lightingModel: 'Constant',
  },
  [XR_MATERIAL.keyDisabled]: {
    diffuseColor: `${semantic['surface-sunken'].dark}80`,
    lightingModel: 'Constant',
    blendMode: 'Alpha',
  },
  [XR_MATERIAL.focusRing]: {
    diffuseColor: chrome.focus,
    lightingModel: 'Constant',
  },
  /*
    THE ONE MATERIAL NOBODY EVER SEES. `XrPanel` puts a quad over the paper to
    catch the pointer (see its pointer block); it must be invisible without
    being hidden, because ViroCore skips hit testing on anything whose node
    opacity is at or below 0.02 — `opacity={0}` would make the board
    undrawable rather than making the quad transparent.

    So the node stays fully opaque and the MATERIAL carries the alpha: `00` on
    the paper's own colour, which blends to exactly the pixels already there.
    It writes no depth either, or a surface in front of the ink would cull the
    child's strokes.
  */
  [XR_MATERIAL.pointer]: {
    diffuseColor: `${chrome.paper}00`,
    lightingModel: 'Constant',
    blendMode: 'Alpha',
    writesToDepthBuffer: false,
  },
  /*
    THE ROOM THE BOARD IS IN, when it is not the child's own room.

    Passthrough puts the board in the real room, which is the placement ADR-117
    argued for and is still what `immersive={false}` gives. What it does not
    survive is a dark one: on the headset this was first run on, the room read
    as black, the panels floated in nothing, and the honest reaction to it was
    "why am I not in an XR space?".

    So the fallback is a surface rather than an absence — `Constant`, because a
    backdrop that takes the scene's key light gains a bright pole exactly where
    a child is asked to look past it, and unlit is also the cheapest possible
    fragment on a tiled mobile GPU covering the whole field of view.
  */
  [XR_MATERIAL.environment]: {
    /*
      `surface-raised`, NOT `surface-sunken`. Sunken is `ink[950]`, and on a
      headset that is not a dark room — it is the absence of one. The first pass
      used it and the result, photographed off the device, was a black field with
      a reticle floating in it: every depth cue gone, which is the exact thing
      "why am I not in an XR space" was asking about.

      Raised is `ink[800]`: far enough below the paper to leave the board the
      brightest thing in the scene, far enough above black to be a surface the
      eye can find.
    */
    diffuseColor: semantic['surface-raised'].dark,
    lightingModel: 'Constant',
  },
  /*
    THE FLOOR, WHICH IS WHAT MAKES THE BACKDROP A ROOM.

    A single-tone sphere has no horizon, so it reads as a void however light it
    is — nothing in it says which way is down or how far away anything is. One
    quad at standing floor height, a step darker than the walls, is the cheapest
    cue that fixes it, and it gives the board's shadowless paper something to sit
    above rather than hang in.
  */
  [XR_MATERIAL.environmentFloor]: {
    diffuseColor: semantic.surface.dark,
    lightingModel: 'Constant',
  },
});

/*
  Ink is `Constant` for the same reason the paper is: a stroke must be the colour
  the child chose at every point along itself, not a colour the room's key light
  shades across.
*/
ViroMaterials.createMaterials(
  Object.fromEntries(
    COLOR_IDS.map((id) => [
      inkMaterial(id),
      { diffuseColor: THEMES.light.colors[id].stroke, lightingModel: 'Constant' as const },
    ]),
  ),
);

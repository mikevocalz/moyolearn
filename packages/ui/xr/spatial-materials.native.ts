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

/*
  THE COLOURS COME FROM THE TOKEN FILE, not from this one. `CLAUDE.md` §UI: no
  hex literals, and if a token does not exist it gets added to
  `packages/theme/tokens.ts`. The first pass here carried the spatial design
  system's stock palette (`#1a1d24`, `#7dd3fc`, `#22262f`) — generic headset-demo
  colours that had never met Moyo's, which is exactly the drift a spatial
  surface is prone to because nobody puts it side by side with the 2D product.

  `dark` in both cases, deliberately, for everything EXCEPT the paper. A headset
  scene is a dark room with panels floating in it; the light scheme's cream
  chrome would glow. The paper is the exception and keeps its light value,
  because the board is always light paper (`whiteboard.types.ts`).
*/
const chrome = {
  rail: semantic['surface-raised'].dark,
  card: semantic['surface-raised'].dark,
  key: semantic['surface-sunken'].light,
  frame: semantic['surface-sunken'].dark,
  paper: semantic['surface-raised'].light,
  onDark: semantic.surface.light,
  focus: semantic['border-strong'].dark,
} as const;

/** Names, so nothing string-literals a material at a call site. */
export const XR_MATERIAL = {
  paper: 'moyoPaper',
  frame: 'moyoFrame',
  rail: 'moyoRail',
  card: 'moyoCard',
  key: 'moyoKey',
  keyPressed: 'moyoKeyPressed',
  keySelected: 'moyoKeySelected',
  keyDisabled: 'moyoKeyDisabled',
  focusRing: 'moyoFocusRing',
} as const;

/**
 * The ink materials, one per colour the board can draw in.
 *
 * ViroCore resolves materials by NAME from a global registry, so a stroke's
 * colour cannot be a prop — it has to be a registered material. They are
 * generated from the vendor's own `COLOR_IDS` and light theme rather than a
 * table copied here, which is what keeps spatial ink the same colour as 2D ink
 * when either changes.
 */
export const inkMaterial = (colourId: string): string => `moyoInk_${colourId}`;

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
  [XR_MATERIAL.key]: {
    diffuseColor: chrome.frame,
    lightingModel: 'PBR',
    roughness: 0.55,
    metalness: 0,
  },
  [XR_MATERIAL.keyPressed]: {
    /* A 20% white wash, the spatial equivalent of the 2D pressed state. */
    diffuseColor: `${chrome.onDark}33`,
    lightingModel: 'Constant',
    blendMode: 'Alpha',
  },
  /*
    Selection is carried by position and a ring as well as this fill — a tool
    picked out by colour alone is a tool a colour-blind child cannot find.
  */
  [XR_MATERIAL.keySelected]: {
    diffuseColor: chrome.focus,
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

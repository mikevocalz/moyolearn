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
    diffuseColor: '#fdfdfb',
    lightingModel: 'Constant',
  },
  /* The frame reads as the edge of a sheet of paper, not as a window chrome. */
  [XR_MATERIAL.frame]: {
    diffuseColor: '#d7dae1',
    lightingModel: 'PBR',
    roughness: 0.7,
    metalness: 0,
  },
  [XR_MATERIAL.rail]: {
    diffuseColor: '#1a1d24e6',
    lightingModel: 'PBR',
    roughness: 0.6,
    metalness: 0,
    blendMode: 'Alpha',
  },
  [XR_MATERIAL.card]: {
    diffuseColor: '#22262f',
    lightingModel: 'PBR',
    roughness: 0.75,
    metalness: 0,
  },
  [XR_MATERIAL.key]: {
    diffuseColor: '#2f3441',
    lightingModel: 'PBR',
    roughness: 0.55,
    metalness: 0,
  },
  [XR_MATERIAL.keyPressed]: {
    diffuseColor: '#ffffff33',
    lightingModel: 'Constant',
    blendMode: 'Alpha',
  },
  /*
    Selection is carried by position and a ring as well as this fill — a tool
    picked out by colour alone is a tool a colour-blind child cannot find.
  */
  [XR_MATERIAL.keySelected]: {
    diffuseColor: '#7dd3fc',
    lightingModel: 'Constant',
  },
  [XR_MATERIAL.keyDisabled]: {
    diffuseColor: '#4b525e80',
    lightingModel: 'Constant',
    blendMode: 'Alpha',
  },
  [XR_MATERIAL.focusRing]: {
    diffuseColor: '#7dd3fc',
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

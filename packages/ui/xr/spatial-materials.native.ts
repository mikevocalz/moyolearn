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

const SURFACE_MATERIALS = {
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
      A 20% white wash, the spatial equivalent of the 2D pressed state. A key
      is ONE quad and this material REPLACES the resting one on it, so the wash
      composites over the rail (`#262420`) rather than over the key it succeeds:
      `#514F4B`. `XrKey` reads that and takes the light label there, which is
      8.03:1 — the dark label it used to keep was 2.21:1.
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
    `Constant` for the outlines too: a ring's whole job is to be a flat edge
    whose contrast against its neighbour was measured, and a lighting model
    would shade one side of it out of the ratio it was chosen for.
  */
  [XR_MATERIAL.ringKey]: {
    diffuseColor: chrome.ringKey,
    lightingModel: 'Constant',
  },
  [XR_MATERIAL.ringKeySelected]: {
    diffuseColor: chrome.ringKeySelected,
    lightingModel: 'Constant',
  },
  [XR_MATERIAL.ringMuted]: {
    diffuseColor: chrome.ringMuted,
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
    THE LIVE PAGE'S MATERIAL, filled from Kotlin (`board-texture`) with the
    WebView's own texture rather than from here.

    WHITE, NOT CLEAR, and the difference is not cosmetic: ViroCore's diffuse
    colour MODULATES the diffuse texture, so a transparent placeholder would
    multiply the board to nothing the moment the texture landed. White is the
    identity for that multiply — the page arrives at the colours it drew.

    `Constant` for the reason the paper and the ink are: this surface is a
    picture of a light board, and a lighting model would shade one side of a
    child's homework out of the contrast it was measured at. `Alpha`, because
    the page's own background is transparent and the paper quad behind it is
    what the board is written on.
  */
  [XR_MATERIAL.boardLive]: {
    diffuseColor: '#FFFFFFFF',
    lightingModel: 'Constant',
    blendMode: 'Alpha',
  },
  /*
    The question panel's hosted surface — same contract as `boardLive`:
    Kotlin fills the diffuse channel, white is the multiply identity, Alpha
    because the content's own background composites over the chrome's dark
    window backing.
  */
  [XR_MATERIAL.questionLive]: {
    diffuseColor: '#FFFFFFFF',
    lightingModel: 'Constant',
    blendMode: 'Alpha',
  },
} as const;

/*
  Ink is `Constant` for the same reason the paper is: a stroke must be the colour
  the child chose at every point along itself, not a colour the room's key light
  shades across.
*/
const INK_MATERIALS = Object.fromEntries(
    COLOR_IDS.map((id) => [
      inkMaterial(id),
      { diffuseColor: THEMES.light.colors[id].stroke, lightingModel: 'Constant' as const },
    ]),
);

/**
 * Registers every spatial material. Called once, from this module's own body.
 *
 * WHY IT IS A FUNCTION, AND WHY THAT REASON DID NOT SURVIVE CONTACT.
 *
 * It was split out of the module body on a hypothesis: that `VRActivity` — a
 * SECOND Activity with its own `ViroViewOpenXR`, sharing one JS context with
 * `MainActivity` — came up long after this module was evaluated, so the
 * module-load `createMaterials` calls had gone to a renderer that is not the
 * one drawing, and the spatial scene resolved every `materials={['moyo…']}`
 * against an empty registry.
 *
 * The renderer's own source says there is no such registry to miss.
 * `ViroMaterials.createMaterials` ends in
 * `MaterialManager.setJSMaterials(result)` on the single `VRTMaterialManager`
 * native module — no view tag, no renderer handle in the call at all — and
 * that module reference is resolved ONCE, when `ViroMaterials` itself is
 * evaluated. A second call from inside a scene reaches exactly where the first
 * one did.
 *
 * The headset symptom that motivated the split — reticle drawing, nothing else
 * — turned out to be a `ReferenceError` thrown on the scene's first render,
 * which meant no geometry was ever submitted to ask for a material in the
 * first place.
 *
 * So it is back to being a module-load side effect with a name. Every
 * `Xr*.native.tsx` component imports this module directly for `XR_MATERIAL`,
 * which is what guarantees the registration has run before anything can name a
 * material — no scene has to remember to do it, and `index.native.ts` no
 * longer offers a way to.
 */
export function registerXrMaterials(): void {
  ViroMaterials.createMaterials(SURFACE_MATERIALS);
  ViroMaterials.createMaterials(INK_MATERIALS);
}

// The phone path still gets them at module load, which is where every non-XR
// caller (and every test that imports this module) expects them to be.
registerXrMaterials();

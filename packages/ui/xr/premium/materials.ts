// Shared spatial materials — registered ONCE on first import (module side
// effect). Import this file from any spatial component; ViroMaterials keys are
// global, so registering twice would warn. The `registered` guard makes it safe
// to import from every component.
import { ViroMaterials } from '@reactvision/react-viro';

let registered = false;

export function registerSpatialMaterials(): void {
  if (registered) return;
  registered = true;
  // Pokédex identity, tuned for MR passthrough. Every UI surface is `Constant`
  // (self-lit): PBR panels need strong IBL and render muddy under the scene's
  // ambient+directional-only lighting with HDR/bloom off, and a UI must stay
  // legible over ANY real-world background the passthrough camera shows — the
  // same reason decax9's visible orb core is emissive/Constant.
  //   paper  #F5F0E1  bezel/screen body      red   #D8232A  brand header/accent
  //   steel  #2B2F3A  utility scroll rail    ink   #17150F  detail
  //   amber  #F2B705  focus + active thumb (reads on both red and paper)
  ViroMaterials.createMaterials({
    // Panel body — opaque WHITE screen. Must be fully opaque so passthrough
    // never shows through the card (incl. behind a transparent artwork PNG).
    solidPanel: { diffuseColor: '#FFFFFF', lightingModel: 'Constant' },
    // Header grab-strip + accents — Pokédex red.
    softCard: { diffuseColor: '#D8232A', lightingModel: 'Constant' },
    // Utility scroll-rail housing — dark steel, distinct from the red brand bar.
    steelRail: { diffuseColor: '#2B2F3A', lightingModel: 'Constant' },
    glassPanel: {
      diffuseColor: '#F5F0E1CC',
      lightingModel: 'Constant',
      blendMode: 'Alpha',
    },
    holographicPanel: { diffuseColor: '#D8232A30', lightingModel: 'Constant', blendMode: 'Add' },
    // Faint ink hairline behind rows on paper — barely-there separation, not a
    // dark wash (a dark wash over paper would fight the ink text).
    backplateTextWash: { diffuseColor: '#17150F0D', lightingModel: 'Constant', blendMode: 'Alpha' },
    // Focus + active thumb — amber; high-visibility on red and on paper alike.
    focusRing: { diffuseColor: '#F2B705', lightingModel: 'Constant' },
    disabledSurface: { diffuseColor: '#B9B2A0AA', lightingModel: 'Constant', blendMode: 'Alpha' },
    dangerSurface: { diffuseColor: '#D8232A', lightingModel: 'Constant' },
    successSurface: { diffuseColor: '#2FA85A', lightingModel: 'Constant' },
    pressedFlash: { diffuseColor: '#17150F22', lightingModel: 'Constant', blendMode: 'Alpha' },
    // Pokéball reveal (card-anchor-scene). Constant-lit for the same reason as
    // every other surface here: it has to stay legible over whatever the
    // passthrough/AR camera is showing behind it. The shell is the brand red
    // with an ink equator band and a white release button; a two-tone
    // red-over-white shell needs a textured sphere or a GLB, neither of which
    // exists in the repo yet — this composition reads as a Pokéball from the
    // front-and-above angle a user holds a card at.
    pxrPokeballShell: { diffuseColor: '#D8232A', lightingModel: 'Constant' },
    pxrPokeballBand: { diffuseColor: '#17150F', lightingModel: 'Constant' },
    pxrPokeballButton: { diffuseColor: '#F5F0E1', lightingModel: 'Constant' },
    // Invisible hit surface (repo standard: additive black + no depth write) —
    // renders nothing, still hit-tests. Front any icon/text stack: this fork
    // ignores ignoreEventHandling on ViroImage/ViroText.
    hitSurface: {
      diffuseColor: '#000000',
      lightingModel: 'Constant',
      blendMode: 'Add',
      writesToDepthBuffer: false,
    },
  });
}

registerSpatialMaterials();

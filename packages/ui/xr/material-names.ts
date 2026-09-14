// The names the spatial surfaces ask ViroCore for, with no renderer attached.
//
// They live apart from `spatial-materials.native.ts` for the reason the colours
// do (see `xr-colors.ts`): that module imports `ViroMaterials`, so every name it
// declares was reachable only from a file that had already pulled the renderer
// in. A caller that merely needs to SAY which material a quad draws with — the
// scene picking the environment backdrop, a test asserting a stroke's name —
// had to choose between a deep import and dragging Viro along.
//
// Strings, so the web entry point can export them too: naming a material is not
// rendering one.
// SOT: packages/ui/xr/spatial-materials.native.ts · packages/ui/xr/xr-colors.ts
// SOT-KEYWORDS: xr material names registry viro pure no-renderer web entry ink

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
  pointer: 'moyoPointer',
  environment: 'moyoEnvironment',
  environmentFloor: 'moyoEnvironmentFloor',
} as const;

/**
 * The ink materials, one per colour the board can draw in.
 *
 * ViroCore resolves materials by NAME from a global registry, so a stroke's
 * colour cannot be a prop — it has to be a registered material.
 */
export const inkMaterial = (colourId: string): string => `moyoInk_${colourId}`;

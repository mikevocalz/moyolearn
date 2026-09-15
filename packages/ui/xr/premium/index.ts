// The poke-xr spatial panel, vendored whole.
//
// WHY IT IS COPIED AND NOT REWRITTEN. `PremiumXRMediaPanel` already solves the
// three things this route kept getting wrong: a panel that SNAPS to a named
// slot on a comfort arc, a panel a child can DRAG and have snap back, and a
// scrolling row list with a real rail (channel, thumb sized by the visible
// fraction, page zones, arrow keys). It has been through seven revisions
// against a PICO — the header margins, the tilt sign, the crisp-text scale,
// the "scroll is a direct commit, not a tween" fix — and every one of those is
// a bug this codebase would otherwise have had to find again.
//
// TWO TOKENS CHANGED, AND NOTHING ELSE. `TITLE_FONT` (poke-xr ships
// `PokemonSolid`; this app does not) and `TITLE_COLOR`. The palette, the
// layout, the motion table and the rail are the original.
//
// THE ARC IS HEAD-RELATIVE, WHICH IS THE WHOLE POINT. `SLOTS` places the three
// panels on a cylinder of radius 1.9 m around the ORIGIN at `SLOT_Y = -0.1` —
// just below eye level — so the parent node must sit at the child's head. On a
// floor-referenced runtime (PICO) that means the head pose, not `[0,0,0]`; see
// `XrTriPanel`.
// SOT: ~/poke-xr/packages/ar/spatial · packages/ui/xr/XrTriPanel.native.tsx
// SOT-KEYWORDS: premium xr media panel poke-xr vendored slots arc drag snap scroll rail

export { PremiumXRMediaPanel, type MediaPanelRow, type MediaPanelTransition } from './PremiumXRMediaPanel.tsx';
export { SLOTS, SLOT_ORDER, panelSize, type PanelSlot } from './spatialTokens.ts';

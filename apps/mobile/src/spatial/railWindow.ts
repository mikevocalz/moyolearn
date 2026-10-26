// Geometry and placement of the shell rail's own Horizon window.
// SOT: packages/theme/tokens.ts (navChrome, targets) · Harlem Might docs/spatial-layout/adr/0005
// SOT-KEYWORDS: spatial rail window size anchor quest navigation
import { navChrome, radius, targets } from '@acme/theme';
import type { MetaWindowProps } from './metaWindowTypes.ts';

/**
 * Where Horizon OS 207 puts the far edge of a window attached OUTSIDE the
 * main window's left or right edge, in dp past that edge. Measured by Harlem
 * Might on a Quest 3S (its docs/spatial-layout/adr/0005): the child's far
 * edge sat 0.152 m (160dp) out for widths 300, 400 and 440dp, and the window
 * grows back toward the main one from there. Measured with `z: 1` only; with
 * no offset Harlem's rail sat flush (gap -0.4dp, its ADR 0006), so re-measure
 * before relying on the gap. Meta's offsets cannot correct it: the SDK clamps
 * them to ±5 steps of about 2dp.
 */
export const OUTWARD_FAR_EDGE_DP = 160;

/**
 * The gap in dp between the main window and a window of `widthDp` attached
 * outside its left or right edge. Negative means they overlap by that much.
 */
export function outwardWindowGapDp(widthDp: number): number {
  return OUTWARD_FAR_EDGE_DP - widthDp;
}

function px(value: string): number {
  if (!value.endsWith('px')) throw new Error(`Expected a px token, got ${value}.`);
  return Number.parseFloat(value);
}

/** rem tokens resolve at 14 on device (NativeWind's native rem). */
const DEVICE_REM_DP = 14;

function remDp(value: string): number {
  if (!value.endsWith('rem')) throw new Error(`Expected a rem token, got ${value}.`);
  return Number.parseFloat(value) * DEVICE_REM_DP;
}

/**
 * The rail window's geometry in dp, from `@acme/theme`'s tokens: px tokens
 * as written, the one rem token (the radius) at the device's 14dp rem. Every
 * spatial platform reads this one spec: Quest through `railWindow()`, PICO
 * through the same props (`panelLaunchSizeDp` in panelWindowsCore.ts).
 *
 * - width: the collapsed rail, `navChrome.rail`.
 * - item: one fixed slot per destination, `targets.young`. The tallest item
 *   any band draws is the K–2 Snap slab at 72, and a labelled item (40dp
 *   indicator, label, padding) lands just under it, so every band fits.
 * - padding: the indicator's side clearance inside the rail, repeated top and
 *   bottom so the window's margins match its sides.
 */
export const RAIL_WINDOW_DP = (() => {
  const width = px(navChrome.rail);
  return {
    width,
    item: px(targets.young),
    padding: (width - px(navChrome.indicator)) / 2,
    /*
      The rail's corner radius, drawn by the rail's own content on every
      platform. Horizon OS rounds a window in its chrome and the Meta layout
      SDK takes no radius; PICO OS 5 rounds third-party windows not at all
      (AppRecord.sIsSupportRoundedCorner is an allowlist of PICO packages),
      but it composites a window's alpha, so the rounded content over a
      transparent window is the same shape on both. `radius.sheet`, the
      window-surface radius.
    */
    cornerRadius: remDp(radius.sheet),
  };
})();

/** Window height for `itemCount` rail slots: the slots plus top and bottom padding. */
export function railWindowHeightDp(itemCount: number): number {
  return itemCount * RAIL_WINDOW_DP.item + 2 * RAIL_WINDOW_DP.padding;
}

/**
 * The shell's navigation rail as its own Horizon window outside the main
 * window's PHYSICAL left edge, like Harlem Might's (its DECISIONS S18). Same
 * depth as the main window (no offset) and centred on it vertically. Priority
 * 20 so navigation wins a slot over any content window. `itemCount` is the
 * shell's rendered destinations plus its overflow-menu slot, so the window is
 * exactly as tall as the rail it hosts.
 */
export function railWindow(itemCount: number): MetaWindowProps {
  return {
    label: 'rail',
    windowWidth: RAIL_WINDOW_DP.width,
    windowHeight: railWindowHeightDp(itemCount),
    priority: 20,
    promotable: true,
    fallback: 'drop',
    anchor: { parent: 'left', child: 'right' },
  };
}

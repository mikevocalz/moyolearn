import type { WindowSizeClass } from './adaptive-panes/constants';
import type { FoldLayout } from './adaptive-panes/fold-layout';

export type AdaptiveNavigationKind =
  | 'bottom-compact'
  | 'bottom-medium'
  | 'rail-collapsed'
  | 'rail-expanded'
  | 'apple-hardware-rail'
  | 'apple-sidebar';

export interface HardwareEdgeColumn {
  edge: 'left' | 'right';
  width: number;
}

export interface AdaptiveNavigationPlacement {
  kind: AdaptiveNavigationKind;
  position: 'bottom' | 'left' | 'right';
  rail: boolean;
  expanded: boolean;
  /** Physical column width when Apple has reserved an outer-edge control column. */
  hardwareWidth: number;
}

export interface ResolveAdaptiveNavigationPlacementInput {
  platform: 'android' | 'ios' | 'other';
  sizeClass: WindowSizeClass;
  /** Current window height in dp/points. Android compact height is <480dp. */
  heightDp: number;
  /**
   * Current window width in dp/points. Needed because a single panel of a
   * wide foldable (Surface Duo panel = 540dp) lands in the compact width
   * class but is NOT phone-sized — it must keep the rail, while a narrow
   * tall-foldable cover or phone (<480dp) drops to the bottom bar.
   */
  widthDp: number;
  folds: readonly FoldLayout[];
  hardwareEdge?: HardwareEdgeColumn | null;
  isRTL: boolean;
}

function logicalStart(isRTL: boolean): 'left' | 'right' {
  return isRTL ? 'right' : 'left';
}

/**
 * Primary shell navigation policy.
 *
 * Android follows Material 3 Adaptive navigation semantics:
 * - compact width that is genuinely narrow (<480dp) -> short bottom
 *   navigation; a compact-width window that is still panel-wide keeps the rail
 * - tabletop or compact height (<480dp) -> short medium bottom navigation
 * - otherwise -> PHYSICAL right-edge wide rail (like the iPhone Duo hardware
 *   column, it does not mirror under RTL)
 * - extra-large -> expanded wide rail
 *
 * Apple is deliberately different:
 * - a Duo-style reserved hardware column wins and remains PHYSICAL, not logical
 * - ordinary compact iPhone -> bottom
 * - regular-width iPad/tablet -> leading sidebar
 *
 * Fold posture comes from the Expo Modules 2 WindowManager bridge. Multiple
 * folds are accepted so a trifold is not collapsed to "hinge #1".
 */
export function resolveAdaptiveNavigationPlacement({
  platform,
  sizeClass,
  heightDp,
  widthDp,
  folds,
  hardwareEdge,
  isRTL,
}: ResolveAdaptiveNavigationPlacementInput): AdaptiveNavigationPlacement {
  const tabletop = folds.some((fold) => fold.posture === 'tabletop');

  if (platform === 'ios') {
    if (hardwareEdge && hardwareEdge.width > 0) {
      return {
        kind: 'apple-hardware-rail',
        position: hardwareEdge.edge,
        rail: true,
        expanded: false,
        hardwareWidth: hardwareEdge.width,
      };
    }

    if (sizeClass === 'compact') {
      return {
        kind: 'bottom-compact',
        position: 'bottom',
        rail: false,
        expanded: false,
        hardwareWidth: 0,
      };
    }

    return {
      kind: 'apple-sidebar',
      position: logicalStart(isRTL),
      rail: true,
      expanded: sizeClass === 'extraLarge',
      hardwareWidth: 0,
    };
  }

  if (platform === 'android') {
    /*
      Compact-width windows only drop to the bottom bar when they are actually
      phone-sized. One Duo panel is 540dp — compact class, but a foldable
      half-screen where the rail is still the right chrome; clamshell covers
      and portrait phones run ~360–430dp and keep the bottom bar.
    */
    if (sizeClass === 'compact' && widthDp < 480) {
      return {
        kind: 'bottom-compact',
        position: 'bottom',
        rail: false,
        expanded: false,
        hardwareWidth: 0,
      };
    }

    if (tabletop || heightDp < 480) {
      return {
        kind: 'bottom-medium',
        position: 'bottom',
        rail: false,
        expanded: false,
        hardwareWidth: 0,
      };
    }

    const expanded = sizeClass === 'extraLarge';
    return {
      kind: expanded ? 'rail-expanded' : 'rail-collapsed',
      // Physical right edge, matching the Apple hardware-column rule: the Duo
      // keeps navigation on the hardware edge rather than mirroring it under
      // RTL, so `isRTL` is deliberately not consulted here.
      position: 'right',
      rail: true,
      expanded,
      hardwareWidth: 0,
    };
  }

  return {
    kind: sizeClass === 'compact' ? 'bottom-compact' : 'rail-collapsed',
    position: sizeClass === 'compact' ? 'bottom' : logicalStart(isRTL),
    rail: sizeClass !== 'compact',
    expanded: false,
    hardwareWidth: 0,
  };
}

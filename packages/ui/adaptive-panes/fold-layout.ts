// Pure fold/window geometry. No react-native import: the calculations stay
// node-testable and both iOS reserved regions and Android FoldingFeature data
// enter through the same shape.
// SOT-KEYWORDS: adaptive panes fold hinge folding feature posture tabletop book snap split
import type {
  FoldOcclusionType,
  FoldOrientation,
  FoldState,
  ReservedRegion,
} from '../reserved-regions.types';

export type FoldPosture = 'flat' | 'book' | 'tabletop';

export interface FoldLayout {
  orientation: FoldOrientation;
  state: FoldState;
  posture: FoldPosture;
  occlusionType?: FoldOcclusionType;
  separating: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VerticalFoldPanePlan {
  splitAfter: 'primary' | 'supplementary';
  primaryWidth: number;
  supplementaryWidth: number;
  gapWidth: number;
}

export interface VerticalFoldPanePlanInput {
  fold: FoldLayout | null;
  rowWidth: number | null;
  primaryVisible: boolean;
  supplementaryVisible: boolean;
  detailVisible: boolean;
  primaryWidth: number;
  supplementaryWidth: number;
  detailMinWidth: number;
  paneMinWidth: number;
}

/**
 * Normalize the current physical division into content coordinates.
 *
 * UIKit's division region does not carry Android's explicit orientation/state,
 * so those two values are inferred conservatively. Android metadata always wins
 * when present.
 */
export function foldLayoutFromRegions(
  regions: readonly ReservedRegion[],
  leadingInset = 0,
): FoldLayout | null {
  const region = regions.find((candidate) => candidate.kind === 'division');
  if (!region) return null;

  const orientation: FoldOrientation =
    region.orientation ?? (region.height >= region.width ? 'vertical' : 'horizontal');
  const state: FoldState = region.state ?? 'flat';
  const posture: FoldPosture =
    state === 'halfOpened'
      ? orientation === 'horizontal'
        ? 'tabletop'
        : 'book'
      : 'flat';

  return {
    orientation,
    state,
    posture,
    occlusionType: region.occlusionType,
    // Android tells us directly. UIKit's active division is the equivalent
    // signal; an inactive zero-width Duo division must not rearrange panes.
    separating: (region.separating ?? region.active) || region.occlusionType === 'full',
    x: Math.max(0, region.x - leadingInset),
    y: region.y,
    width: Math.max(0, region.width),
    height: Math.max(0, region.height),
  };
}

/**
 * Snap a horizontal pane composition to a separating VERTICAL fold without
 * choosing product content for the caller.
 *
 * Preference:
 * 1. Keep primary + supplementary together on the leading physical region when
 *    both fit; detail gets the trailing region.
 * 2. Otherwise put primary alone on the leading region and shrink the
 *    supplementary pane inside the trailing region while defending detail's
 *    floor.
 *
 * If neither arrangement is usable, return null and preserve the existing
 * width-class layout instead of silently hiding a pane.
 */
export function resolveVerticalFoldPanePlan({
  fold,
  rowWidth,
  primaryVisible,
  supplementaryVisible,
  detailVisible,
  primaryWidth,
  supplementaryWidth,
  detailMinWidth,
  paneMinWidth,
}: VerticalFoldPanePlanInput): VerticalFoldPanePlan | null {
  if (
    !fold ||
    !fold.separating ||
    fold.orientation !== 'vertical' ||
    rowWidth === null ||
    !detailVisible
  ) {
    return null;
  }

  const gapWidth = Math.min(fold.width, Math.max(0, rowWidth - fold.x));
  const leadingWidth = Math.min(Math.max(0, fold.x), rowWidth);
  const trailingWidth = Math.max(0, rowWidth - leadingWidth - gapWidth);

  if (leadingWidth < paneMinWidth || trailingWidth < detailMinWidth) {
    return null;
  }

  if (supplementaryVisible) {
    // Best case: both authored leading panes stay on the leading physical
    // region, with the hinge becoming the supplementary/detail boundary.
    const primaryOnLeading = primaryVisible ? primaryWidth : 0;
    const supplementaryOnLeading = leadingWidth - primaryOnLeading;
    if (
      supplementaryOnLeading >= paneMinWidth &&
      (!primaryVisible || primaryOnLeading >= paneMinWidth)
    ) {
      return {
        splitAfter: 'supplementary',
        primaryWidth,
        supplementaryWidth: supplementaryOnLeading,
        gapWidth,
      };
    }

    // The leading region cannot hold both. Keep the first pane on the first
    // physical region and fit supplementary + detail on the second. We do not
    // hide either pane here; visibility remains the host's policy.
    if (
      primaryVisible &&
      trailingWidth >= paneMinWidth + detailMinWidth
    ) {
      return {
        splitAfter: 'primary',
        primaryWidth: leadingWidth,
        supplementaryWidth: Math.max(
          paneMinWidth,
          Math.min(supplementaryWidth, trailingWidth - detailMinWidth),
        ),
        gapWidth,
      };
    }

    return null;
  }

  if (primaryVisible) {
    return {
      splitAfter: 'primary',
      primaryWidth: leadingWidth,
      supplementaryWidth,
      gapWidth,
    };
  }

  return null;
}


export interface TrailingInspectorLayout {
  width: number;
  edge: 'left' | 'right';
  /** Translation that parks the inspector fully beyond its trailing edge. */
  closedX: number;
}

export interface TrailingInspectorLayoutInput {
  fold: FoldLayout | null;
  rowWidth: number | null;
  preferredWidth: number;
  isRTL: boolean;
}

/**
 * Match SplitView.Inspector's trailing-edge overlay semantics while respecting
 * a separating vertical fold.
 *
 * The inspector never becomes another tiled column. It overlays the detail
 * surface from the logical trailing edge, and on a foldable its maximum width
 * is the physical region on that trailing side so it cannot cover the hinge or
 * spill into the opposite display.
 */
export function resolveTrailingInspectorLayout({
  fold,
  rowWidth,
  preferredWidth,
  isRTL,
}: TrailingInspectorLayoutInput): TrailingInspectorLayout {
  const edge: 'left' | 'right' = isRTL ? 'left' : 'right';
  let availableWidth = rowWidth ?? preferredWidth;

  if (
    fold?.separating &&
    fold.orientation === 'vertical' &&
    rowWidth !== null
  ) {
    const foldStart = Math.min(Math.max(0, fold.x), rowWidth);
    const foldEnd = Math.min(
      rowWidth,
      Math.max(foldStart, fold.x + fold.width),
    );
    availableWidth = isRTL ? foldStart : rowWidth - foldEnd;
  }

  const width = Math.max(0, Math.min(preferredWidth, availableWidth));
  // Twenty dp clears the shadow/edge completely instead of leaving a sliver.
  const travel = width + 20;

  return {
    width,
    edge,
    closedX: isRTL ? -travel : travel,
  };
}

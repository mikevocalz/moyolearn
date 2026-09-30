'use client';
// Native fold geometry adapter for AdaptivePanes.
//
// ReservedRegions normalizes iOS reserved regions and Android FoldingFeature
// into one WINDOW-coordinate shape. AdaptivePanes measures its own row origin
// in that same coordinate space, and this hook converts every fold into row-
// local coordinates. Until the row origin is known, returning no folds is safer
// than snapping content to a window-relative x value.
// SOT-KEYWORDS: fold layout window origin hinge adaptive panes native
import { useReservedRegions } from '../reserved-regions';
import { foldLayoutFromRegions, foldLayoutsFromRegions } from './fold-layout';

export function useFoldLayouts(rowWindowX: number | null) {
  const regions = useReservedRegions();

  return rowWindowX === null
    ? []
    : foldLayoutsFromRegions(regions, rowWindowX);
}

export function useFoldLayout(rowWindowX: number | null) {
  const regions = useReservedRegions();

  return rowWindowX === null
    ? null
    : foldLayoutFromRegions(regions, rowWindowX);
}

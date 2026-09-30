'use client';
// Native fold geometry adapter for AdaptivePanes.
//
// ReservedRegions already normalizes iOS reserved regions and Android
// FoldingFeature into one shape. This hook only translates WINDOW coordinates
// to the pane row's SAFE-AREA content coordinates.
// SOT-KEYWORDS: fold layout safe area hinge adaptive panes native
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReservedRegions } from '../reserved-regions';
import { foldLayoutFromRegions } from './fold-layout';
import type { PaneEdges } from './pane-edges';

export function useFoldLayout(edges: PaneEdges) {
  const regions = useReservedRegions();
  const insets = useSafeAreaInsets();
  const leadingInset = edges.includes('left') ? insets.left : 0;

  return foldLayoutFromRegions(regions, leadingInset);
}

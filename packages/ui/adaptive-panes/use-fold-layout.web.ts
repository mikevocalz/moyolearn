'use client';
import type { PaneEdges } from './pane-edges';
import type { FoldLayout } from './fold-layout';

export function useFoldLayouts(_edges: PaneEdges): FoldLayout[] {
  return [];
}

export function useFoldLayout(_edges: PaneEdges): FoldLayout | null {
  return null;
}

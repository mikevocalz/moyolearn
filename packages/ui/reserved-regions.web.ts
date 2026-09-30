// Web has no native fold feature; the hook answers the empty list so callers
// branch on capabilities/data, not on platform.
// SOT-KEYWORDS: reserved regions folding feature web fork
import type { ReservedRegion } from './reserved-regions.types';

export type {
  FoldOcclusionType,
  FoldOrientation,
  FoldState,
  ReservedRegion,
} from './reserved-regions.types';

export function useReservedRegions(): readonly ReservedRegion[] {
  return NONE;
}

const NONE: readonly ReservedRegion[] = [];

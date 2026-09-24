// Web has no fold and no reserved regions; the hook answers the empty list so
// callers branch on data, not on platform.
// SOT-KEYWORDS: reserved regions web fork
import type { ReservedRegion } from './reserved-regions.types';

export type { ReservedRegion };

export function useReservedRegions(): readonly ReservedRegion[] {
  return NONE;
}

const NONE: readonly ReservedRegion[] = [];

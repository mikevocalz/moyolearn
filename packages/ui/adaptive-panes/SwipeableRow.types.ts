// Shared props for the SwipeableRow platform forks.
// SOT: ./SwipeableRow.native.tsx (gesture) · ./SwipeableRow.web.tsx (static)
// SOT-KEYWORDS: swipeable row props actions commit types
import type { ReactNode } from 'react';
import type { SwipeSide } from './swipe-actions.ts';

export interface SwipeableRowProps {
  children: ReactNode;
  /** Rendered behind the row, revealed as it slides. */
  actions: ReactNode;
  /** Runs on a full swipe, or when a revealed action is tapped. */
  onCommit: () => void;
  side?: SwipeSide;
  rowWidth: number;
}

import type { ReactNode } from 'react';
import type { XrPlacement, XrSurfaceInput, XrPanelState } from './XrPanel.types.ts';

/** Dedicated native QuickDraw panel contract. */
export interface XrQuickdrawPanelProps {
  title: string;
  width: number;
  aspect: { w: number; h: number };
  placement: XrPlacement;
  state: XrPanelState;
  /** Renderer output. Production wiring is expected to provide the ESIKU-backed surface. */
  surface: ReactNode;
  /** Frame-only drag; the writable surface never becomes the drag affordance. */
  draggable?: boolean;
  onPlacementChange?: (next: XrPlacement) => void;
  onSurfaceInput: (sample: XrSurfaceInput) => void;
}

'use client';

import { ViroNode } from '@reactvision/react-viro';
import { XrPanel } from './XrPanel.native.tsx';
import type { XrQuickdrawPanelProps } from './XrQuickdrawPanel.types.ts';

export function XrQuickdrawPanel({
  title,
  width,
  aspect,
  placement,
  state,
  surface,
  draggable = true,
  onPlacementChange,
  onSurfaceInput,
}: XrQuickdrawPanelProps) {
  return (
    <ViroNode>
      <XrPanel
        width={width}
        aspect={aspect}
        placement={placement}
        moveHandle={draggable ? 'frame' : 'none'}
        onPlacementChange={onPlacementChange}
        onSurfaceInput={onSurfaceInput}
        state={state}
        ornaments={{
          top: {
            extent: width,
            gap: 0.012,
            node: (
              <ViroNode>
                {/* Title chrome is intentionally outside the writable surface. */}
              </ViroNode>
            ),
          },
        }}
      >
        {surface}
      </XrPanel>
    </ViroNode>
  );
}

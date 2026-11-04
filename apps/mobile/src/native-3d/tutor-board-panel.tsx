import { useState } from 'react';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { TutorXrBoardPanelProps } from '@acme/app/features/tutor/tutor-xr-screen.types.ts';
import { PANEL_HEIGHT_M, spatialSpacing } from '@acme/ui/xr';
import { RiveBoardPanel } from './rive-board-panel';

/* Half the grip bar's height (rive-board-panel GRIP_H). */
const GRIP_HALF_H = 0.045;

export async function loadTutorBoardPanel() {
  // Metro requires a static asset reference.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../../assets/rive/moyo_board_chrome.riv'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Board controls could not be loaded');
  const bytes = await new File(asset.localUri).arrayBuffer();
  /*
    THE BOARD MOVES ALONE. `RiveBoardPanel` owns its carrier offset (the kit's
    `useCarrierDrag`), its chrome and its ray input plane re-anchor from it on
    the release render, and the screen hears the landed offset through
    `onMoved` for the one anchor it keeps outside the panel (the stylus).
  */
  function TutorBoardPanel(props: TutorXrBoardPanelProps) {
    const [grabbed, setGrabbed] = useState(false);
    return <RiveBoardPanel
      chromeBytes={bytes} slot={props.slot} carrier={null} grabbed={false}
      movable bound={props.bound} enabled={props.enabled} content={props.content}
      termination={props.termination} onSurfaceInput={props.onSurfaceInput}
      handlers={props.handlers} presentation={{ ...props.presentation, grabbed }}
      onCarrierRelease={(pose) => props.onMoved?.(pose.position)} onGrab={setGrabbed}
      gripWorld={{
        position: [
          props.slot.position[0],
          props.slot.position[1] - PANEL_HEIGHT_M / 2 - spatialSpacing.sm - GRIP_HALF_H,
          props.slot.position[2],
        ],
        yawDeg: props.slot.yaw,
      }}
      onChromeError={props.onError}
      onReady={props.onReady}
    />;
  }
  return TutorBoardPanel;
}

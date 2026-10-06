// The production board panel — `RiveBoardPanel` with the drag contract wired
// to the session store instead of stubbed out.
//
// THE CARRIER POSE AND THE GRAB LIVE IN `useXrSession`, not in this component:
// the scene renders inside the navigator's captured `initialScene`, which
// remounts on tracking blinks and lazy-load edges — a pose held in local
// state would snap the board back to its slot the first time the runtime
// blinked, and a grab flag held in the panel would die with the release
// event never delivered.
//
// SOT: ./rive-board-panel.tsx · packages/app/features/tutor/xr-session.store.ts
// SOT-KEYWORDS: tutor xr board panel carrier grip drag session store wiring

import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { PANEL_HEIGHT_M, spatialSpacing } from '@acme/ui/xr';
import type { TutorXrBoardPanelProps } from '@acme/app/features/tutor/tutor-xr-screen.types.ts';
import { useXrSession } from '@acme/app/features/tutor/xr-session.store.ts';
import { RiveBoardPanel } from './rive-board-panel';

/* Same grip bar geometry `rive-board-panel` draws. */
const GRIP_H = 0.09;

export async function loadTutorBoardPanel() {
  // Metro requires a static asset reference.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../../assets/rive/moyo_board_chrome.riv'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Board controls could not be loaded');
  const bytes = await new File(asset.localUri).arrayBuffer();
  function TutorBoardPanel(props: TutorXrBoardPanelProps) {
    const carrier = useXrSession((s) => s.boardCarrier);
    const grabbed = useXrSession((s) => s.boardGrabbed);
    /*
      The grip hangs one `sm` under the panel's bottom edge — the probe's
      placement (`xr-layout-probe` `chromeGripY`). The grip is a CHILD of the
      carrier, which starts at identity, so its carrier-local pose IS the
      world pose under the slot; after a drag both ride together.
    */
    const gripY = props.slot.position[1] - PANEL_HEIGHT_M / 2 - spatialSpacing.sm - GRIP_H / 2;
    return <RiveBoardPanel
      chromeBytes={bytes} slot={props.slot}
      carrier={carrier} grabbed={grabbed} movable
      bound={props.bound} enabled={props.enabled} content={props.content}
      termination={props.termination} onSurfaceInput={props.onSurfaceInput}
      handlers={props.handlers}
      presentation={{ ...props.presentation, grabbed }}
      onCarrierRelease={(pose) => useXrSession.getState().setBoardCarrier(pose)}
      onGrab={(v) => useXrSession.getState().setBoardGrabbed(v)}
      gripWorld={{
        position: [props.slot.position[0], gripY, props.slot.position[2]],
        yawDeg: props.slot.yaw,
      }}
      onChromeError={props.onError}
    />;
  }
  return TutorBoardPanel;
}

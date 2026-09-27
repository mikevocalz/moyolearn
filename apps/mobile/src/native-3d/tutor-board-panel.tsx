import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { TutorXrBoardPanelProps } from '@acme/app/features/tutor/tutor-xr-screen.types.ts';
import { RiveBoardPanel } from './rive-board-panel';

const noop = () => {};
export async function loadTutorBoardPanel() {
  // Metro requires a static asset reference.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const asset = Asset.fromModule(require('../../assets/rive/moyo_board_chrome.riv'));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error('Board controls could not be loaded');
  const bytes = await new File(asset.localUri).arrayBuffer();
  function TutorBoardPanel(props: TutorXrBoardPanelProps) {
    return <RiveBoardPanel
      chromeBytes={bytes} slot={props.slot} carrier={null} grabbed={false}
      movable={false} bound={props.bound} enabled={props.enabled} content={props.content}
      termination={props.termination} onSurfaceInput={props.onSurfaceInput}
      handlers={props.handlers} presentation={props.presentation}
      onCarrierRelease={noop} onGrab={noop}
      gripWorld={{ position: [0, 0, 0], yawDeg: 0 }} onChromeError={props.onError}
    />;
  }
  return TutorBoardPanel;
}

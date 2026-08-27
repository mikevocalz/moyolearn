// SOT-KEYWORDS: transfer tray stories rows tabs minimize retry two-phase
import type { Meta, StoryObj } from '@storybook/react-vite';
import { View } from '@acme/ui/tw';
import { TransferTray } from './TransferTray';
import { useTransferTray } from './transfer-tray.store';

const meta = { title: 'Media/TransferTray', component: TransferTray } satisfies Meta<
  typeof TransferTray
>;
export default meta;
type Story = StoryObj<typeof meta>;

/*
  Seeded at module scope against the real (module-level) tray store — the
  reducer makes re-announcing an id a no-op, so reloading the story is
  idempotent. Every doc 29 §4 phase is on screen at once: queued, uploading
  with real bytes, processing (bytes landed, Bunny encoding, no honest
  percentage), done, and failed with its per-file resume-retry.
*/
const { dispatch } = useTransferTray.getState();
dispatch({ type: 'queued', id: 'sb-queued', name: 'fractions-worksheet.pdf', mimeType: 'application/pdf', bytesTotal: 480 * 1024 });
dispatch({ type: 'queued', id: 'sb-uploading', name: 'science-fair-photo.png', mimeType: 'image/png', bytesTotal: 3 * 1024 * 1024 });
dispatch({ type: 'begin', id: 'sb-uploading' });
dispatch({ type: 'progress', id: 'sb-uploading', bytesSent: 1.2 * 1024 * 1024, bytesTotal: 3 * 1024 * 1024 });
dispatch({ type: 'queued', id: 'sb-processing', name: 'tutor-intro.mp4', mimeType: 'video/mp4', bytesTotal: 18 * 1024 * 1024 });
dispatch({ type: 'begin', id: 'sb-processing' });
dispatch({ type: 'progress', id: 'sb-processing', bytesSent: 18 * 1024 * 1024, bytesTotal: 18 * 1024 * 1024 });
dispatch({ type: 'processing', id: 'sb-processing' });
dispatch({ type: 'queued', id: 'sb-done', name: 'reading-log.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytesTotal: 92 * 1024 });
dispatch({ type: 'begin', id: 'sb-done' });
dispatch({ type: 'done', id: 'sb-done' });
dispatch({ type: 'queued', id: 'sb-failed', name: 'voice-note.m4a', mimeType: 'audio/m4a', bytesTotal: 900 * 1024 });
dispatch({ type: 'begin', id: 'sb-failed' });
dispatch({ type: 'progress', id: 'sb-failed', bytesSent: 540 * 1024, bytesTotal: 900 * 1024 });
dispatch({ type: 'failed', id: 'sb-failed', error: 'Network dropped.' });

/** Docked to the corner of its host, the way the app-root mount behaves. */
export const AllPhases: Story = {
  render: () => (
    <View className="relative bg-surface-sunken" style={{ height: 560 }}>
      <TransferTray />
    </View>
  ),
};

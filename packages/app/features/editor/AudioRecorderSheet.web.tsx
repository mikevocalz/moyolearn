'use client';
import { useAudioStore } from './audio.store.ts';

/**
 * Recording is native-only here.
 *
 * `react-native-audio-api`'s recorder needs a microphone session the browser
 * exposes through a different API entirely (`MediaRecorder`), so rather than
 * ship a dialog that cannot record, the web build resolves the request as
 * cancelled.
 *
 * The button itself is hidden by `record-media.web`, which supplies no
 * `recordAudio` handler — `isEnabled` then drops the capability. This comment
 * previously CLAIMED that gate while the host screen supplied the handler on
 * every platform, so the button rendered on web and tapping it did nothing
 * visible. This component is now only the backstop for a request that somehow
 * opens anyway.
 */
export function AudioRecorderSheet() {
  const open = useAudioStore((state) => state.open);
  const resolve = useAudioStore((state) => state.resolve);

  if (open) resolve(null);
  return null;
}

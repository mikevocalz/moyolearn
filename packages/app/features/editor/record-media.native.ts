'use client';
// Which recording capabilities this platform actually has.
//
// The capability registry hides a button whose handler is `undefined`
// (`isEnabled`), so supplying or withholding the handler IS the gate. That is
// the whole mechanism — there is no separate platform check in the registry,
// and adding one would put the decision in two places.
//
// Native has both: `react-native-audio-api` for the microphone, VisionCamera 5
// for the camera.
// SOT: packages/app/features/editor/capabilities.ts (isEnabled)
// SOT-KEYWORDS: record media platform gate native audio video capability enabled
import { useAudioStore } from './audio.store.ts';
import { useVideoStore } from './video.store.ts';

export const useRecordAudio = () => useAudioStore((state) => state.request);
export const useRecordVideo = () => useVideoStore((state) => state.request);

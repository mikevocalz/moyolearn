/**
 * The XR voice session — a store-shaped sibling of `useXrVoice`, because the
 * question chrome's `onVoice` handler lives at module scope where no hook can
 * run. Same contract: press to listen, press again to stop and transcribe,
 * Whisper (`transcribe`) on device, transcript lands in the flow store as a
 * `voice` draft the child can read before submitting.
 *
 * NOTHING IS A HOOK AND NOTHING USES `useState` — the zustand rule holds on
 * the spatial path too. The recorder itself stays module-private so store
 * snapshots stay plain data.
 *
 * SOT: packages/app/features/tutor/xr-voice.native.ts (hook form) ·
 *      packages/app/features/capture/transcribe.native.ts
 * SOT-KEYWORDS: xr voice session store audio recorder whisper transcribe permission microphone spatial
 */

import { PermissionsAndroid } from 'react-native';
import { AudioRecorder } from 'react-native-audio-api';
import { createStore } from 'zustand/vanilla';
import { transcribe } from '@acme/app/features/capture/transcribe.ts';
import { usePermissions } from '@acme/app/features/permissions/permissions.store.ts';
import { useXrQuestionFlow } from '@acme/app/features/tutor/xr-question.store.ts';

export type XrVoiceSessionPhase = 'idle' | 'starting' | 'listening' | 'transcribing' | 'blocked';

const MAX_SECONDS = 60;

export const xrVoiceSession = createStore<{
  phase: XrVoiceSessionPhase;
  toggle(): void;
  stop(): Promise<void>;
}>()((set, get) => {
  /* Recorder + timer are module-private — they are handles, not state a
     panel should ever render. */
  let recorder: AudioRecorder | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;

  const status = (text: string) => useXrQuestionFlow.setState({ status: text });
  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const stop = async () => {
    const instance = recorder;
    if (!instance || get().phase !== 'listening') return;
    recorder = null;
    clearTimer();
    const run = generation;
    const current = () => generation === run;
    set({ phase: 'transcribing' });
    status('Writing down what you said…');
    try {
      const result = await instance.stop();
      if (!current()) return;
      const path = result?.status === 'success' ? result.paths[0] : undefined;
      const text = path ? (await transcribe(path)).trim() : '';
      if (!current()) return;
      if (text) {
        set({ phase: 'idle' });
        /* The transcript IS the draft — the rail shows it through
           `answerText` and SUBMIT marks it like any typed answer. */
        useXrQuestionFlow.getState().setTextAnswer(text);
        useXrQuestionFlow.setState({ status: `Heard: “${text}”` });
      } else {
        set({ phase: 'blocked' });
        status('I did not catch that — press LISTEN and try again.');
      }
    } catch {
      if (current()) {
        set({ phase: 'blocked' });
        status('The microphone did not answer — press LISTEN to try again.');
      }
    }
  };

  const start = async () => {
    if (get().phase === 'starting' || get().phase === 'listening') return;
    const run = ++generation;
    const current = () => generation === run;
    set({ phase: 'starting' });
    let instance: AudioRecorder | null = null;
    try {
      /* Same rule as `permission-request.native.ts`: a manifest entry is not
         a grant. Ask once, record the OS's real answer in the persisted
         store, and never claim a grant we did not obtain. */
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      usePermissions.getState().setStatus(
        'microphone',
        result === PermissionsAndroid.RESULTS.GRANTED
          ? 'granted'
          : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
            ? 'blocked'
            : 'denied',
      );
      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        if (!current()) return;
        set({ phase: 'blocked' });
        status(
          result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
            ? 'The microphone is off in Settings — ask a grown-up to turn it on.'
            : 'I need the microphone to hear your answer.',
        );
        return;
      }
      instance = new AudioRecorder();
      instance.enableFileOutput();
      const started = await instance.start();
      if (!current()) {
        void instance.stop().catch(() => undefined);
        return;
      }
      if (started.status === 'error') {
        set({ phase: 'blocked' });
        status('The microphone did not answer — press LISTEN to try again.');
        return;
      }
      recorder = instance;
      set({ phase: 'listening' });
      status('Listening — press LISTEN again when you are done.');
      timer = setTimeout(() => void stop(), MAX_SECONDS * 1000);
    } catch {
      if (instance) void instance.stop().catch(() => undefined);
      if (current()) {
        set({ phase: 'blocked' });
        status('The microphone did not answer — press LISTEN to try again.');
      }
    }
  };

  return {
    phase: 'idle',
    toggle: () => {
      if (get().phase === 'listening') void stop();
      else void start();
    },
    stop,
  };
});

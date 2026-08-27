'use client';
// The voice recorder on web.
//
// This used to resolve every request as cancelled, on the grounds that
// `react-native-audio-api`'s recorder is native-only. That was true and the
// conclusion was wrong: the browser has had `MediaRecorder` the whole time, and
// "the native library doesn't build here" is not the same as "a child cannot
// speak to the tutor on a laptop". Half the learners on a school Chromebook
// were shown a microphone that did nothing.
//
// Mounted at the app ROOT like its native twin, and asked for a recording
// through `audio.store` — so callers never learn which platform they are on.
// SOT: packages/app/features/editor/audio.store.ts
// SOT-KEYWORDS: voice recorder web mediarecorder audio tutor composer microphone
import { useEffect, useRef } from 'react';
import { useAudioStore } from './audio.store.ts';

export function AudioRecorderSheet() {
  const open = useAudioStore((state) => state.open);
  const resolve = useAudioStore((state) => state.resolve);
  const started = useRef(false);

  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;

    let recorder: MediaRecorder | undefined;
    let stream: MediaStream | undefined;
    const chunks: Blob[] = [];
    const startedAt = Date.now();

    const stop = () => {
      recorder?.state === 'recording' && recorder.stop();
    };

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          stream?.getTracks().forEach((track) => track.stop());
          started.current = false;
          if (chunks.length === 0) {
            resolve(null);
            return;
          }
          const blob = new Blob(chunks, { type: recorder?.mimeType ?? 'audio/webm' });
          resolve({
            uri: URL.createObjectURL(blob),
            duration: (Date.now() - startedAt) / 1000,
            /*
              The browser gives no per-frame levels without an AnalyserNode, and
              the waveform is drawn from these. Empty rather than fabricated: a
              made-up waveform is a picture of a recording that did not happen,
              and `render-waveform` would happily draw it.
            */
            levels: [],
          });
        };
        recorder.start();
      } catch {
        // Permission denied, or no microphone. Settle rather than hang — an
        // unresolved promise leaves the composer stuck in recording state
        // forever with no way back.
        started.current = false;
        resolve(null);
      }
    })();

    return stop;
  }, [open, resolve]);

  // Headless: the composer already draws the recording UI, so a second surface
  // here would be two things claiming to be the recorder.
  return null;
}

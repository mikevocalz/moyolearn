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
  const setLive = useAudioStore((state) => state.setLive);
  const setStop = useAudioStore((state) => state.setStop);
  const started = useRef(false);

  useEffect(() => {
    if (!open || started.current) return;
    started.current = true;

    let recorder: MediaRecorder | undefined;
    let stream: MediaStream | undefined;
    let sampler: ReturnType<typeof globalThis.setInterval> | undefined;
    let closeAudio: (() => void) | undefined;
    const chunks: Blob[] = [];
    const startedAt = Date.now();

    const stop = () => {
      recorder?.state === 'recording' && recorder.stop();
    };

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);

        /*
          An AnalyserNode gives real levels. The first version returned an empty
          array with a note that a fabricated waveform would be a picture of a
          recording that did not happen — true, and the answer was to measure
          rather than to give up. RMS over the time-domain buffer is the honest
          loudness of what the microphone actually heard.
        */
        const audioCtx = new AudioContext();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        const buffer = new Uint8Array(analyser.fftSize);
        const captured: number[] = [];

        sampler = globalThis.setInterval(() => {
          analyser.getByteTimeDomainData(buffer);
          let sum = 0;
          for (const v of buffer) {
            const centred = (v - 128) / 128;
            sum += centred * centred;
          }
          // Gained up: speech RMS sits low, and a meter that never moves reads
          // as a broken microphone rather than a quiet room.
          captured.push(Math.min(1, Math.sqrt(sum / buffer.length) * 3));
          setLive({ elapsedSec: (Date.now() - startedAt) / 1000, levels: [...captured] });
        }, 100);

        closeAudio = () => {
          if (sampler !== undefined) globalThis.clearInterval(sampler);
          void audioCtx.close();
        };
        setStop(stop);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          closeAudio?.();
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
            levels: captured,
          });
        };
        recorder.start();
      } catch {
        // Permission denied, or no microphone. Settle rather than hang — an
        // unresolved promise leaves the composer stuck in recording state
        // forever with no way back.
        closeAudio?.();
        started.current = false;
        resolve(null);
      }
    })();

    return () => {
      closeAudio?.();
      stop();
    };
  }, [open, resolve, setLive, setStop]);

  // Headless: the composer already draws the recording UI, so a second surface
  // here would be two things claiming to be the recorder.
  return null;
}

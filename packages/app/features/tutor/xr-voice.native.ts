'use client';
// Talking to the tutor from inside the headset.
//
// WHY THE ASK BUTTON DID NOT LET A CHILD TALK. It never tried. Its whole path
// was `exportPng()` → `queueAsk` → the tutor screen stages the board as an
// image attachment. That is a picture of the board, sent silently; there was no
// microphone anywhere on the spatial route. The one recorder in the app
// (`VoiceRecorder`) is a 2D composer component that this scene does not mount,
// so the mic was never opened and never even asked for.
//
// AND IT COULD NOT HAVE WORKED IF IT HAD TRIED. `RECORD_AUDIO` sits in the
// manifest, which on Android 6+ makes the permission requestable and grants
// nothing. `AudioRecorder.start()` does not ask — it fails. So the grant is
// obtained here first, through the app's one requester, and a refusal becomes a
// state the button can say out loud rather than a silent no-op.
//
// THE BOARD STILL GOES WITH THE VOICE. A child in a headset asking "is this
// right?" means the thing they just drew, and a transcript without it is a
// question with no subject. Both are queued for the same turn.
//
// PRESS TO START, PRESS TO STOP. Not push-and-hold: holding a controller
// trigger for the length of a spoken question is the gesture that also drags
// the board, and the two would fight over the same input.
// SOT: packages/ui/audio/VoiceRecorder.native.tsx · packages/app/features/capture/transcribe.native.ts
// SOT-KEYWORDS: xr voice microphone record transcribe whisper ask button headset conversation permission

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from 'react-native-audio-api';
import { usePermissionRequester } from '../permissions/permission-request';
import { usePermissions } from '../permissions/permissions.store.ts';
import { transcribe } from '../capture/transcribe';
import type { XrVoice, XrVoicePhase } from './xr-voice.types.ts';

/**
 * How long a single question may run before it is stopped for the child.
 *
 * A press-to-start button has one failure mode — a child who walks away with
 * the mic open — and this is the bound on it. Long enough for a spoken maths
 * question with a pause in the middle, short enough that a forgotten recording
 * is a minute of room tone and not a session.
 */
const MAX_SECONDS = 60;

const IDLE: XrVoicePhase = { kind: 'idle' };

export interface XrVoiceOptions {
  /** Fires with what the child said, once it is transcribed. Never with ''. */
  onUtterance: (text: string) => void;
  /** False parks the button — the board is not ready to be asked about yet. */
  enabled: boolean;
}

export function useXrVoice({ onUtterance, enabled }: XrVoiceOptions): XrVoice {
  const [phase, setPhase] = useState<XrVoicePhase>(IDLE);
  const recorder = useRef<AudioRecorder | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { request } = usePermissionRequester();
  const micStatus = usePermissions((s) => s.statuses.microphone);

  /*
    Callbacks in refs so `stop` can be created once. A recorder held across a
    re-render is a mic that keeps running after its owner's identity changed,
    and the cleanup below would then be closing over a stale instance.
  */
  const utterance = useRef(onUtterance);
  utterance.current = onUtterance;

  const teardown = useCallback(() => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
  }, []);

  const stop = useCallback(async () => {
    teardown();
    const instance = recorder.current;
    recorder.current = null;
    if (instance === null) {
      setPhase(IDLE);
      return;
    }
    setPhase({ kind: 'transcribing' });
    const result = await instance.stop();
    const path = result?.status === 'success' ? result.paths[0] : undefined;
    if (path === undefined) {
      /*
        The mic was open and produced no file. Reported rather than swallowed:
        a child who spoke and got nothing back needs to know the app heard
        nothing, not watch a tutor ignore them.
      */
      setPhase({ kind: 'blocked', reason: 'silent' });
      return;
    }
    const text = await transcribe(path);
    setPhase(IDLE);
    /*
      `transcribe` returns '' for both a failed decode and genuine silence, by
      its own contract. Sending an empty turn would make the tutor answer a
      question nobody asked, so it stops here.
    */
    if (text.length > 0) utterance.current(text);
    else setPhase({ kind: 'blocked', reason: 'silent' });
  }, [teardown]);

  const start = useCallback(async () => {
    /*
      Ask the OS unless it has already granted. Cached-granted is trusted only
      to skip the DIALOG — `start()` below still gets a real answer from the
      recorder, so a permission revoked while the app was backgrounded surfaces
      as a device failure rather than a wrong assumption.
    */
    if (micStatus !== 'granted') {
      const state = await request('microphone');
      /*
        `undetermined` is not a refusal — it is what a platform that raises its
        own prompt at capture time answers, and on those the recorder is what
        actually asks. Only an explicit no stops here.
      */
      if (state === 'denied' || state === 'blocked') {
        setPhase({ kind: 'blocked', reason: 'permission' });
        return;
      }
    }

    const instance = new AudioRecorder();
    instance.enableFileOutput();
    const started = await instance.start();
    if (started.status === 'error') {
      setPhase({ kind: 'blocked', reason: 'device' });
      return;
    }
    /*
      NO ANALYSER GRAPH HERE, unlike the 2D recorder. That one draws live bars
      and needs an `AudioContext` feeding an `AnalyserNode` at 20 Hz; this one
      draws nothing a child can see from inside the scene, and a JS callback at
      that rate on the frame budget of a stereo renderer costs more than the
      meter is worth.
    */
    recorder.current = instance;
    setPhase({ kind: 'listening' });
    timeout.current = setTimeout(() => void stop(), MAX_SECONDS * 1000);
  }, [micStatus, request, stop]);

  const toggle = useCallback(() => {
    if (!enabled) return;
    if (phase.kind === 'transcribing') return;
    if (phase.kind === 'listening') {
      void stop();
      return;
    }
    /*
      A press while blocked retries rather than staying stuck. The blocked state
      is a message, not a latch: a guardian may have just granted the permission
      in settings, and the only way to find out is to ask again.
    */
    void start();
  }, [enabled, phase.kind, start, stop]);

  useEffect(() => {
    if (enabled || recorder.current === null) return;
    /*
      The board left while the mic was open — tracking dropped, or the child is
      on their way out of the scene. The take is DISCARDED rather than
      transcribed and sent: a question asked on the way out of a room is not one
      they chose to send.
    */
    teardown();
    const instance = recorder.current;
    recorder.current = null;
    void instance.stop();
    setPhase(IDLE);
  }, [enabled, teardown]);

  useEffect(
    () => () => {
      /* Unmount must not leave the microphone open. */
      teardown();
      void recorder.current?.stop();
      recorder.current = null;
    },
    [teardown],
  );

  return { phase, toggle };
}

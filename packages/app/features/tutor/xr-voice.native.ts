'use client';
// One recorder per XR presentation. Async permission and transcription work is
// invalidated on interruption or exit, so neither can revive a departed lesson.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AudioRecorder } from 'react-native-audio-api';
import { usePermissionRequester } from '../permissions/permission-request';
import { usePermissions } from '../permissions/permissions.store.ts';
import { transcribe } from '../capture/transcribe';
import type { XrVoice, XrVoicePhase } from './xr-voice.types.ts';

const MAX_SECONDS = 60;
export interface XrVoiceOptions {
  onUtterance: (text: string) => void;
  enabled: boolean;
}

export function useXrVoice({ onUtterance, enabled }: XrVoiceOptions): XrVoice {
  const [phase, setPhase] = useState<XrVoicePhase>({ kind: 'idle' });
  const [previousEnabled, setPreviousEnabled] = useState(enabled);
  if (previousEnabled !== enabled) {
    setPreviousEnabled(enabled);
    setPhase({ kind: 'idle' });
  }
  const phaseRef = useRef<XrVoicePhase>(phase);
  useLayoutEffect(() => { phaseRef.current = { kind: 'idle' }; }, [enabled]);
  const recorder = useRef<AudioRecorder | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const available = useRef(enabled);
  useLayoutEffect(() => { available.current = enabled; }, [enabled]);
  const utterance = useRef(onUtterance);
  useLayoutEffect(() => { utterance.current = onUtterance; }, [onUtterance]);
  const { request } = usePermissionRequester();
  const micStatus = usePermissions((s) => s.statuses.microphone);
  const update = useCallback((next: XrVoicePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const clearTimer = useCallback(() => {
    if (timeout.current !== null) clearTimeout(timeout.current);
    timeout.current = null;
  }, []);

  const stop = useCallback(async () => {
    const instance = recorder.current;
    if (!instance || phaseRef.current.kind !== 'listening') return;
    recorder.current = null;
    clearTimer();
    const run = generation.current;
    const current = () => generation.current === run && available.current;
    update({ kind: 'transcribing' });
    try {
      const result = await instance.stop();
      if (!current()) return;
      const path = result?.status === 'success' ? result.paths[0] : undefined;
      const text = path ? (await transcribe(path)).trim() : '';
      if (!current()) return;
      update(text ? { kind: 'idle' } : { kind: 'blocked', reason: 'silent' });
      if (text) utterance.current(text);
    } catch {
      if (current()) update({ kind: 'blocked', reason: 'device' });
    }
  }, [clearTimer, update]);

  const start = useCallback(async () => {
    // Set synchronously before the first await: two quick presses cannot
    // create two recorders while the OS permission dialog is opening.
    if (!available.current || !['idle', 'blocked'].includes(phaseRef.current.kind)) return;
    const run = ++generation.current;
    const current = () => generation.current === run && available.current;
    update({ kind: 'starting' });
    let instance: AudioRecorder | null = null;
    try {
      if (micStatus !== 'granted') {
        const permission = await request('microphone');
        if (!current()) return;
        if (permission === 'denied' || permission === 'blocked') {
          update({ kind: 'blocked', reason: 'permission' });
          return;
        }
      }
      instance = new AudioRecorder();
      instance.enableFileOutput();
      const result = await instance.start();
      if (!current()) {
        await instance.stop();
        return;
      }
      if (result.status === 'error') {
        update({ kind: 'blocked', reason: 'device' });
        return;
      }
      recorder.current = instance;
      update({ kind: 'listening' });
      timeout.current = setTimeout(() => void stop(), MAX_SECONDS * 1000);
    } catch {
      if (instance) void instance.stop().catch(() => undefined);
      if (current()) update({ kind: 'blocked', reason: 'device' });
    }
  }, [micStatus, request, stop, update]);

  const toggle = useCallback(() => {
    if (!available.current) return;
    if (phaseRef.current.kind === 'listening') void stop();
    else void start();
  }, [start, stop]);

  useEffect(() => {
    const lifetime = generation;
    return () => {
      lifetime.current++;
      clearTimer();
      const instance = recorder.current;
      recorder.current = null;
      if (instance) void instance.stop().catch(() => undefined);
    };
  }, [enabled, clearTimer]);

  return { phase, toggle };
}

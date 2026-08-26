'use client';
// Web has no VisionCamera. Recording in a browser is MediaRecorder territory and
// a different component, so this fork reports "unavailable" rather than
// pretending — a control that appears and then fails is worse than one that
// explains itself.
// SOT-KEYWORDS: video recorder web unavailable fallback
import type { RecorderPhase, StopReason } from './use-video-recorder.native.ts';

export type { RecorderPhase, StopReason };

export function useVideoRecorder() {
  return {
    phase: 'idle' as RecorderPhase,
    elapsed: 0,
    filePath: null as string | null,
    reason: null as StopReason | null,
    error: 'Recording a video needs the app.' as string | null,
    recorder: null,
    tick: null,
    videoOutput: null,
    start: async () => {},
    stop: async () => {},
    reset: () => {},
    ratio: 0,
    remaining: 0,
    /** Lets a caller hide the control entirely rather than render a dead one. */
    available: false as const,
  };
}

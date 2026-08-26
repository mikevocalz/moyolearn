// TS resolution anchor — bundlers load the .native/.web forks.
// Native: VisionCamera 5. Web: unavailable, and says so.
export { useVideoRecorder } from './use-video-recorder.web';
export type { RecorderPhase, StopReason } from './use-video-recorder.native.ts';

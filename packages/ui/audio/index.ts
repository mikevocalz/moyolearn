// Audio components — recorder, player, waveform.
// Grouped as a sub-barrel because they all pull react-native-audio-api; re-exported
// from packages/ui/index.ts, so consumers import from '@acme/ui' like everything else.
// SOT: packages/ui/index.ts (component index)
// SOT-KEYWORDS: audio voice recorder player waveform microphone playback

export { VoiceRecorder, type VoiceRecorderProps, type VoiceRecording } from './VoiceRecorder';
export { AudioPlayer, type AudioPlayerProps } from './AudioPlayer';
export { Waveform, type WaveformProps } from './Waveform.tsx';
export {
  BAR_COUNT,
  MIN_BAR,
  barHeight,
  barProgress,
  frameLevel,
  pushLevel,
  summarise,
} from './waveform.ts';

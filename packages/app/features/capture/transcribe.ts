// TS resolution anchor — bundlers load the .native/.web forks.
// Web: Whisper via transformers.js. Native: Whisper via ExecuTorch.
export { transcribe } from './transcribe.web';

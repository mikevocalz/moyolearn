// TS resolution anchor — bundlers load the .native/.web forks.
// Native supplies both recorders; web supplies neither, which is what hides the
// toolbar buttons.
export { useRecordAudio, useRecordVideo } from './record-media.web';

// TS resolution anchor — bundlers load the .native/.web forks.
// Native: expo-file-system upload task. Web: XMLHttpRequest, because `fetch`
// cannot report upload progress.
export { uploadTransport } from './transport.web';
export type { UploadInput, UploadTransport } from './transport.types.ts';

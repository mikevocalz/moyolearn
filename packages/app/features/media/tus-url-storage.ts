// TS resolution anchor — bundlers load the .native/.web forks.
// Native: MMKV-backed, because React Native has no Web Storage and tus-js-client
// therefore cannot resume across sessions on its own. Web: the library's own.
export { tusUrlStorage } from './tus-url-storage.web';
export type { TusUrlStorage } from './tus-url-storage.types.ts';

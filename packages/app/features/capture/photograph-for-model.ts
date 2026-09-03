// TS resolution anchor — bundlers load the .native/.web forks.
// Native: expo-image-manipulator. Web: a canvas, because Turbopack cannot
// bundle expo-image-manipulator at all.
export { photographForModel } from './photograph-for-model.web';

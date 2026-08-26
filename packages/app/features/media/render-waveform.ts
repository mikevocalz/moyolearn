// TS resolution anchor — bundlers load the .native/.web forks.
// Native: Skia offscreen. Web: a 2D canvas, which the browser already has.
export { renderWaveform } from './render-waveform.web';
export type { RenderWaveform, RenderedWaveform } from './render-waveform.types.ts';

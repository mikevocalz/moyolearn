// @acme/assets — typed exports for brand assets; no magic string paths in app code.
// SOT: this file — every font/image path resolves here.
// SOT-KEYWORDS: assets fonts images brand typed-paths require
declare const require: (path: string) => number;

// Fonts (all OFL): Archivo Black = display, Space Grotesk = workhorse sans,
// Chivo Mono = tabular data + the dictionary device.
// Native embedding happens via the expo-font config plugin (apps/mobile/app.config.ts);
// web loads them with next/font localFont (apps/web/app/fonts.ts).
export const fonts = {
  archivoBlack: require('./fonts/ArchivoBlack-Regular.ttf') as number,
  spaceGroteskVariable: require('./fonts/SpaceGrotesk-Variable.ttf') as number,
  chivoMonoVariable: require('./fonts/ChivoMono-Variable.ttf') as number,
  chivoMonoItalicVariable: require('./fonts/ChivoMono-Italic-Variable.ttf') as number,
} as const;

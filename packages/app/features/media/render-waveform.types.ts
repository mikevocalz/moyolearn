// One contract for both waveform renderers.
// SOT-KEYWORDS: waveform render png types platform fork voice note
export interface RenderedWaveform {
  /** Local URI of the PNG. Uploaded, then no longer needed. */
  uri: string;
  size: number;
}

export type RenderWaveform = (
  levels: readonly number[],
  width: number,
  height: number,
) => Promise<RenderedWaveform>;

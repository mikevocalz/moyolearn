// Web waveform render — a 2D canvas rather than Skia, because the browser
// already has one and pulling Skia's WASM in to draw 48 rectangles would cost
// megabytes for arithmetic the platform does for free.
//
// Matches `packages/ui/audio/Waveform`: square-ended flat bars, BAR_COUNT of
// them, padded from the left.
// SOT: packages/ui/audio/Waveform.tsx
// SOT-KEYWORDS: waveform render png canvas web voice note inline editor
import { BAR_COUNT, MIN_BAR, barHeight } from '@acme/ui';
import type { RenderWaveform, RenderedWaveform } from './render-waveform.types.ts';

// See the native fork: baked into the bitmap, so it cannot be a theme token.
const INK = '#0D0C0B';

export const renderWaveform: RenderWaveform = async (levels, width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The waveform could not be drawn.');

  const padded =
    levels.length >= BAR_COUNT
      ? levels.slice(levels.length - BAR_COUNT)
      : [...Array.from({ length: BAR_COUNT - levels.length }, () => 0), ...levels];

  const gap = Math.max(1, Math.round(width / (BAR_COUNT * 8)));
  const barWidth = Math.max(1, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT);

  ctx.fillStyle = INK;
  padded.forEach((level, i) => {
    const h = Math.max(MIN_BAR, barHeight(level)) * height;
    ctx.fillRect(i * (barWidth + gap), (height - h) / 2, barWidth, h);
  });

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The waveform could not be encoded.');

  return { uri: URL.createObjectURL(blob), size: blob.size } satisfies RenderedWaveform;
};

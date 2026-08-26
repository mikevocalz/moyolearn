// Renders the inline waveform PNG on device, from the levels captured while
// recording. Server-side rendering would mean shipping the audio to us first,
// which is the one thing the client-direct upload architecture exists to avoid.
//
// It matches `packages/ui/audio/Waveform` deliberately: square-ended, flat-filled
// bars, `BAR_COUNT` of them, padded from the LEFT. That component's header
// explains why — rounded gradient bars are what every other voice-note UI uses,
// and this product has hard edges and flat colour everywhere else. An inline
// image that does not match the live meter would read as a different control.
// SOT: packages/ui/audio/Waveform.tsx
// SOT-KEYWORDS: waveform render png skia native voice note inline editor
import { Group, Rect, drawAsImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { BAR_COUNT, MIN_BAR, barHeight } from '@acme/ui';
import type { RenderWaveform, RenderedWaveform } from './render-waveform.types.ts';

/*
  Ink on paper, as literal hex.

  Every other surface reads its colour from a token, and this one cannot: Skia
  paints into a bitmap, so there is no stylesheet, no CSS variable and no
  `dark:` variant to resolve. The image is baked once and then served from a CDN
  to both themes, which is also why it is the INK colour on transparent rather
  than a themed pair — a dark-mode waveform baked at record time would be wrong
  for half its lifetime.
*/
const INK = '#0D0C0B';

export const renderWaveform: RenderWaveform = async (levels, width, height) => {
  const padded =
    levels.length >= BAR_COUNT
      ? levels.slice(levels.length - BAR_COUNT)
      : [...Array.from({ length: BAR_COUNT - levels.length }, () => 0), ...levels];

  // One gap between each pair of bars, matching the live meter's `gap-0.5`.
  const gap = Math.max(1, Math.round(width / (BAR_COUNT * 8)));
  const barWidth = Math.max(1, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT);

  const image = await drawAsImage(
    <Group>
      {padded.map((level, i) => {
        const h = Math.max(MIN_BAR, barHeight(level)) * height;
        return (
          <Rect
            key={i}
            x={i * (barWidth + gap)}
            // Centred vertically, so the waveform reads as a signal around a
            // baseline rather than a bar chart growing off the floor.
            y={(height - h) / 2}
            width={barWidth}
            height={h}
            color={INK}
          />
        );
      })}
    </Group>,
    { width, height },
  );
  if (!image) throw new Error('The waveform could not be drawn.');

  const bytes = image.encodeToBytes();
  /*
    Cache, not documents: this PNG exists only long enough to be uploaded. Put
    it in documents and every voice note leaves a file behind that nothing ever
    deletes.
  */
  const file = new File(Paths.cache, `waveform-${Date.now()}.png`);
  file.create({ overwrite: true });
  file.write(bytes);

  return { uri: file.uri, size: bytes.length } satisfies RenderedWaveform;
};

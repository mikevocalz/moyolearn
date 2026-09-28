// Validate timing at the provider and cache boundaries.
// SOT: docs/voice-v4-upgrade.md
// SOT-KEYWORDS: voice alignment schema monotone timestamps
import { z } from 'zod';

/** Provider/CDN boundary: parallel arrays must describe a monotone timeline. */
export const alignmentSchema = z.object({
  characters: z.array(z.string()).min(1),
  character_start_times_seconds: z.array(z.number().finite().nonnegative()),
  character_end_times_seconds: z.array(z.number().finite().nonnegative()),
}).refine((value) => {
  const starts = value.character_start_times_seconds;
  const ends = value.character_end_times_seconds;
  return value.characters.length === starts.length && starts.length === ends.length &&
    starts.every((start, i) => start <= ends[i]! && (i === 0 || (start >= starts[i - 1]! && ends[i]! >= ends[i - 1]!)));
});

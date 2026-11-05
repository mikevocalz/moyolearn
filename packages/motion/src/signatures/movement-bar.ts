/**
 * Signature S1, the session-report movement bar (DIRECTION.md §Signatures).
 *
 * Two targets, never the same one twice, so the inspector gate has nothing to
 * flag: `gain` is the segment between the before and after fills, grown from
 * its left edge (scaleX 0 -> 1, the dial coming to rest); `position` is the
 * grade-position sentence, which settles only once the movement has been
 * shown. Movement and position stay two claims (doc 34, "Movement vs
 * Position"). Labels name the storyboard frames, so the determinism snapshot
 * holds exactly the three frames the storyboard draws.
 *
 * SOT: DIRECTION.md §Signatures S1 · docs/pack/34-session-summary-reports.md
 * SOT-KEYWORDS: signature movement bar session report mastery gain position
 */
import { presets, track } from '../presets.ts';
import { registerMotion } from '../registry.ts';

/** How far the position sentence rises into place, in points. */
const POSITION_RISE = 6;

export const movementBar = registerMotion({
  id: 'signature.movement-bar',
  initial: {
    gain: { scaleX: 0 },
    position: { opacity: 0, y: POSITION_RISE },
  },
  labels: {
    filled: presets.cinematic.durationMs,
    settled: presets.cinematic.durationMs + presets.entrance.durationMs,
  },
  tracks: [
    track('cinematic', { target: 'gain', to: { scaleX: 1 } }),
    track('entrance', { target: 'position', to: { opacity: 1, y: 0 }, after: ['cinematic'] }),
  ],
});

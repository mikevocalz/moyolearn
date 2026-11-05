/**
 * Signature S1, the session-report movement bar (DIRECTION.md §Signatures).
 *
 * The gain segment (before edge to after edge) grows like a needle: it runs
 * 3% past the after edge on the `transition` preset, then settles back on
 * `feedback`. The level line ("Developing → Proficient") appears as the needle
 * settles, so the words never give the result away before the bar shows it;
 * the grade-position sentence fades in only once the bar is at rest, keeping
 * movement and position two claims (doc 34). No rise on either line: a fade
 * paired with a lift is the generic entrance (web-designer-pro motion-craft §5),
 * and critic round S1 r1 marked it down for that.
 *
 * The settle is a second, nested target rather than a second track on `gain`:
 * Kinetrell's inspector counts two tracks that meet end to start on one
 * property as overlapping (its bounds are inclusive), so `gain` runs to the
 * overshoot and `settle`, the element inside it, scales by 1/OVERSHOOT. The
 * product is exactly 1 at rest. One track per target, so the gate has nothing
 * to flag. Labels name the storyboard frames the determinism snapshot freezes.
 *
 * SOT: DIRECTION.md §Signatures S1 · CRITIQUE.md (S1 rounds) ·
 *      docs/pack/34-session-summary-reports.md
 * SOT-KEYWORDS: signature movement bar session report mastery gain needle settle position
 */
import { presets, track } from '../presets.ts';
import { registerMotion } from '../registry.ts';

/** The needle's overshoot past the after edge, as a fraction of the gain segment. */
const OVERSHOOT = 1.03;

const atRest = presets.transition.durationMs + presets.feedback.durationMs;

export const movementBar = registerMotion({
  id: 'signature.movement-bar',
  initial: {
    gain: { scaleX: 0 },
    settle: { scaleX: 1 },
    level: { opacity: 0 },
    position: { opacity: 0 },
  },
  labels: {
    overshoot: presets.transition.durationMs,
    rest: atRest,
    settled: atRest + presets.entrance.durationMs,
  },
  tracks: [
    track('transition', { target: 'gain', to: { scaleX: OVERSHOOT } }),
    track('feedback', { target: 'settle', to: { scaleX: 1 / OVERSHOOT }, after: ['transition'] }),
    track('feedback', { target: 'level', to: { opacity: 1 }, after: ['transition'] }),
    track('entrance', { target: 'position', to: { opacity: 1 }, after: ['transition', 'feedback'] }),
  ],
});

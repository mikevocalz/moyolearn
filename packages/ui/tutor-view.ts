// TutorPresencePreference — the four presentation modes for the tutor.
//
// These are display values only. They do not affect the model, voice, captions,
// or learning policy. Separated from `TutorStage.tsx` so the toolbar can import
// the same type without a circular dependency.
// SOT: packages/ui/TutorStage.tsx · packages/ui/SessionToolbar.tsx · docs/design/tutor-session-responsive-spec.md
// SOT-KEYWORDS: tutor presence preference visible compact audio-only auto work pane

import { isCollapsed } from './adaptive-panes/constants.ts';
import type { WindowSizeClass } from './adaptive-panes/constants.ts';

export type TutorPresencePreference = 'auto' | 'visible' | 'compact' | 'audio-only';

/**
 * The same four modes with `auto` already answered.
 *
 * `auto` is a REQUEST ("decide for me"), not a presentation — it has no avatar
 * size, no mark, and no reveal state, so any component that draws Natalie and
 * accepts it has three branches that cannot be written honestly. Resolution
 * happens once, at the screen (grade band → screen size → reduced motion, doc
 * `tutor-session-responsive-spec.md` §1), and everything below the resolution
 * point takes this type instead.
 */
export type ResolvedTutorPresence = Exclude<TutorPresencePreference, 'auto'>;

/** True when the learner has Natalie's body on screen rather than her voice alone. */
export const isTutorRevealed = (presence: ResolvedTutorPresence): boolean =>
  presence === 'visible';

/**
 * Whether the session has a column to put the workbench in.
 *
 * Lives here rather than inside `TutorStage` because two components have to
 * agree on it and disagreeing is a defect the learner sees: the stage decides
 * whether to draw the middle pane, and the SCREEN decides whether the composer
 * offers the board as a sheet instead. Answered twice, a tablet would get both
 * or neither, and "neither" is the pane-only capability ADR-107's first
 * amendment forbids.
 *
 * `medium` (600–839dp) tiles two panes, not three, and the third is the one
 * this is about — so a pane-capable width is necessary and not sufficient.
 */
export const hasWorkPane = (windowClass: WindowSizeClass): boolean =>
  !isCollapsed(windowClass) && windowClass !== 'medium';

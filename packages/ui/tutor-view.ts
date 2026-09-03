// TutorPresencePreference — the four presentation modes for the tutor.
//
// These are display values only. They do not affect the model, voice, captions,
// or learning policy. Separated from `TutorStage.tsx` so the toolbar can import
// the same type without a circular dependency.
// SOT: packages/ui/TutorStage.tsx · packages/ui/SessionToolbar.tsx · docs/design/tutor-session-responsive-spec.md
// SOT-KEYWORDS: tutor presence preference visible compact audio-only auto

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

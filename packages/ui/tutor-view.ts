// TutorPresencePreference — the four presentation modes for the tutor.
//
// These are display values only. They do not affect the model, voice, captions,
// or learning policy. Separated from `TutorStage.tsx` so the toolbar can import
// the same type without a circular dependency.
// SOT: packages/ui/TutorStage.tsx · packages/ui/SessionToolbar.tsx · docs/design/tutor-session-responsive-spec.md
// SOT-KEYWORDS: tutor presence preference visible compact audio-only auto

export type TutorPresencePreference = 'auto' | 'visible' | 'compact' | 'audio-only';

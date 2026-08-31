// TutorView — the three presentation tiers for the tutor avatar.
//
// These are display values only. They do not affect the model, voice, captions,
// or learning policy. Separated from `TutorStage.tsx` so the toolbar can import
// the same type without a circular dependency.
// SOT: packages/ui/TutorStage.tsx · packages/ui/SessionToolbar.tsx
// SOT-KEYWORDS: tutor view presentation visible compact hidden

export type TutorView = 'visible' | 'compact' | 'hidden';

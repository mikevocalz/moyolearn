// CaptureTip — TS resolution anchor; bundlers load the .native/.web forks.
// A bare .tsx anchor beats .native.tsx in Metro resolution, so it must re-export.
//
// Doc 37 §4's camera-at-camera tip: the one-time card that teaches what a good
// Snap looks like, shown under the live frame the first time a learner opens it.
// The design lives in the native fork; web has no viewfinder to teach.
//
// Mobbin: https://mobbin.com/screens/eddbcaf5-e84e-49c2-9a17-ea528204eb81 (Mesh —
// the tip docked to the surface it names rather than floating over it) ·
// https://mobbin.com/screens/6255fa9c-c07f-4abf-8ca1-123f9eb1f9d1 (Opera — caret
// pointing up at the control being taught, title/body/one action) ·
// https://mobbin.com/screens/df87f8e0-d810-4593-bb39-8b0a01a3c493 (MD Vinyl —
// a one-line teach card sitting directly against the bar it explains) ·
// https://mobbin.com/screens/5f9444a2-a55d-4358-98ce-f3f9f2635768 (Tabby — one
// action and no competing close glyph)
// Structure only; the slab, the type ramp and the band targets are docs 02/08.
// SOT: docs/pack/37-onboarding-dual-pane.md §1.2 §4 · docs/pack/24-homework-capture-spec.md §2
// SOT-KEYWORDS: capture tip coach mark snap anchor fork resolution camera at camera
export { CaptureTip, type CaptureTipProps } from './capture-tip.web';

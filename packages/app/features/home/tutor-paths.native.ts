// Tutor shell route paths — native fork. Expo Router mounts the tutor tabs
// group-relative, so the draft queue answers at `/notes` (the
// `(tutor)/(tabs)/notes` tab) rather than web's `/report-queue` — see the
// web fork's header for why this is a fork pair and not a `Platform.OS`
// branch.
// SOT: apps/mobile/app/(tutor)/(tabs)/_layout.tsx · design/screens/tutor/tutor.today/contract.md
// SOT-KEYWORDS: tutor paths review drafts notes tab href fork native mobile

/** tutor.today `review_drafts` — the mobile tutor shell's Notes tab. */
export const reviewDraftsPath = () => '/notes';

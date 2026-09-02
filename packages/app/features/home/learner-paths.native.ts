// Learner shell route paths — native fork. Expo Router mounts the learner
// tabs group-relative, so PracticeScreen answers at `/stuff` (the
// `(learner)/(tabs)/stuff` tab) rather than web's `/practice` — see the web
// fork's header for why this is a fork pair and not a `Platform.OS` branch.
// SOT: apps/mobile/app/(learner)/(tabs)/_layout.tsx · docs/pack/36-role-navigation-flows.md §3.1
// SOT-KEYWORDS: learner paths stuff tab href fork native mobile

/** Where "My Stuff" lives — the mobile learner shell's `stuff` tab. */
export const stuffPath = () => '/stuff';

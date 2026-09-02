// Learner shell route paths — web fork. The K–2 "My Stuff" surface is
// PracticeScreen, which web serves at `(site)/practice` while the mobile
// shell mounts it as the `stuff` tab (`/stuff`) — the ONE thing allowed to
// differ per platform is the pushed href, so it lives in this fork pair
// instead of a runtime `Platform.OS` branch (repo fork law; the
// classes-paths precedent). Snap and the tutor stay unforked: `/capture`
// and `/tutor` resolve on both platforms.
// SOT: apps/web/components/site/nav.ts (HOT_NAV_LEARNER_BY_BAND.young) · docs/pack/36-role-navigation-flows.md §3.1
// SOT-KEYWORDS: learner paths stuff practice href fork web

/** Where "My Stuff" lives — web's `(site)/practice` page. */
export const stuffPath = () => '/practice';

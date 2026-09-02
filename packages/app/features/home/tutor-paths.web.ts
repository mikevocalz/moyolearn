// Tutor shell route paths — web fork. tutor.today's `review_drafts` exit
// lands on the draft queue, which web serves at `(site)/report-queue` while
// the mobile tutor shell mounts it as the Notes tab (`/notes`) — the ONE
// thing allowed to differ per platform is the pushed href, so it lives in
// this fork pair instead of a runtime `Platform.OS` branch (repo fork law;
// the classes-paths precedent). Prep stays unforked: `/session-prep`
// resolves on both platforms.
// SOT: apps/web/app/(site)/report-queue/page.tsx · design/screens/tutor/tutor.today/contract.md
// SOT-KEYWORDS: tutor paths review drafts notes report queue href fork web

/** tutor.today `review_drafts` — web's `(site)/report-queue` page. */
export const reviewDraftsPath = () => '/report-queue';

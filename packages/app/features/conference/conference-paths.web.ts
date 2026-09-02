// Conference hub route path — web fork. The teacher shell's web pages live
// under `/teachers/*` (nav.ts rail + `(teacher)/teachers` segment), so the
// Conference Hub answers at `/teachers/conference`, while the mobile shell
// mounts it as a group-relative stack route (`/conference`, ADR-102's demoted
// tab). The ONE thing allowed to differ per platform — the pushed href —
// lives in this fork pair instead of a runtime `Platform.OS` branch (repo
// fork law; the classes-paths precedent).
// SOT: apps/web/app/(teacher)/teachers/conference/page.tsx · docs/decisions/adr-102-teacher-shell-ia.md
// SOT-KEYWORDS: conference paths route web teachers hub href fork

/** `/teachers/conference` — teacher Home's `push_conference` exit on web. */
export const conferenceHubPath = () => '/teachers/conference';

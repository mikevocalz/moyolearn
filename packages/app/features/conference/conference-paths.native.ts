// Conference hub route path — native fork. Expo Router mounts the teacher
// shell's stack routes group-relative (`(teacher)/conference` resolves to
// `/conference`), unlike web's `/teachers/conference` page — see the web
// fork's header for why this is a fork pair and not a `Platform.OS` branch.
// SOT: apps/mobile/app/(teacher)/conference.tsx · docs/decisions/adr-102-teacher-shell-ia.md
// SOT-KEYWORDS: conference paths route native mobile hub href fork

/** The ADR-102 stack route — teacher Home's `push_conference` exit on mobile. */
export const conferenceHubPath = () => '/conference';

/**
 * Desktop shell sections.
 *
 * Controls the Spark window's own content layout only. Phone, Surface Duo,
 * tablet, headset and Expo Router contracts live in apps/mobile and are not
 * touched by this file.
 *
 * Strikes recorded 2026-11-04 (PR-D01), carried from draft #137:
 * - "AI Tutor", "Lesson Planner" and "Classrooms" are struck from the nav.
 *   Their precondition is a signed-in session and role guard (PR-D04) plus the
 *   learning-surface port (PR-D05). #137 rendered them as "integration gate"
 *   cards and a scratchpad whose notes vanished on quit; both were dead ends.
 *   Each returns when its PR lands, in the same change as its route.
 * SOT: docs/desktop/seams/SEAMS.md · Moyo Learn Desktop PR pack §PR-D01
 * The window's 900×600 minimum and 1280×800 default (PR pack design handoff)
 * live in desktop.config.json `window`; at 900pt the 240pt sidebar leaves
 * 660pt of content, so the sidebar does not collapse in D01.
 * SOT-KEYWORDS: desktop layout sections sidebar spark shell
 */
export const DESKTOP_SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    description: "Your desktop workspace",
  },
  {
    id: "resources",
    label: "Resources",
    description: "Choose a local file to reference",
  },
] as const satisfies ReadonlyArray<{ id: string; label: string; description: string }>;

export type DesktopSection = (typeof DESKTOP_SECTIONS)[number]["id"];
export type DesktopDensity = "comfortable" | "compact";

export function isSection(value: string): value is DesktopSection {
  return DESKTOP_SECTIONS.some((section) => section.id === value);
}

export function isDensity(value: string): value is DesktopDensity {
  return value === "comfortable" || value === "compact";
}

export function sectionById(id: DesktopSection): (typeof DESKTOP_SECTIONS)[number] {
  const match = DESKTOP_SECTIONS.find((section) => section.id === id);
  if (!match) throw new Error(`Unknown desktop section: ${id}`);
  return match;
}

/**
 * Desktop shell sections.
 *
 * Controls the Spark window's own content layout only. Phone, Surface Duo,
 * tablet, headset and Expo Router contracts live in apps/mobile and are not
 * touched by this file.
 *
 * Section decisions (PR-D01 strikes, revisited 2026-11-04 in PR-D05):
 * - "Classrooms" returns (PR-D05): GET /api/teacher/classes and
 *   /api/teacher/classes/:id/roster are a real read path with the desktop
 *   session cookie. Shown to Tutor, Organization and District workspaces.
 * - "AI Tutor" stays struck (DEFER): packages/app/features/tutor is the shared
 *   feature, but its entry reaches Nitro v1 (stream-fetch), react-native-executorch,
 *   react-native-audio-api and react-native-webgpu, none of which run on Spark's
 *   RN 0.83 runtime. It returns when the feature exposes a `desktop` entry;
 *   forking it here is not allowed (PR pack §PR-D05 "zero forked feature code").
 * - "Lesson Planner" stays struck (STRIKE): main has no lesson-planning
 *   feature or API (packages/app/features has none; apps/web/app/api has none).
 * SOT: docs/desktop/seams/SEAMS.md · docs/desktop/seams/D05.md · Moyo Learn Desktop PR pack §PR-D05
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
    id: "classrooms",
    label: "Classrooms",
    description: "Your classes and their rosters",
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

/**
 * This module controls Spark's resizable window content, not Moyo's phone,
 * Surface Duo, tablet, headset, or Expo Router navigation contracts.
 */
export type DesktopSection = "overview" | "tutor" | "planner" | "resources" | "classrooms";
export type DesktopDensity = "comfortable" | "compact";

export const DESKTOP_SECTIONS: ReadonlyArray<{
  id: DesktopSection;
  label: string;
  description: string;
}> = [
  { id: "overview", label: "Overview", description: "Your teaching and learning space" },
  { id: "tutor", label: "AI Tutor", description: "Guided learning sessions" },
  { id: "planner", label: "Lesson Planner", description: "Prepare activities and questions" },
  { id: "resources", label: "Resources", description: "Choose local reference material" },
  { id: "classrooms", label: "Classrooms", description: "Classroom and school workspaces" },
];

export function desktopShellMode(width: number): "stacked" | "side-by-side" {
  return Number.isFinite(width) && width >= 850 ? "side-by-side" : "stacked";
}

export function sectionTitle(section: DesktopSection): string {
  return DESKTOP_SECTIONS.find((item) => item.id === section)?.label ?? "Overview";
}

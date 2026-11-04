// Which builds ask for the shell rail as its own OS window.
// SOT: src/spatial/spatialWindows.ts · components/ShellTabBar.tsx
// SOT-KEYWORDS: spatial rail window quest pico build gate
import { spatialWindows } from './spatialWindows';

/**
 * Quest (Meta's layout SDK: a window attached outside the main window's left
 * edge) and pico (a second Activity panel the OS places). Everywhere else the
 * rail stays in the main window.
 */
export const spatialRailBuild: boolean = spatialWindows.linked;

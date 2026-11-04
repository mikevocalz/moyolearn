/**
 * Desktop shell UI state (Zustand). The only store in apps/desktop.
 *
 * Holds view state for the window: active section, layout density, the name
 * of a file the user picked, and the last native-control error. No credentials,
 * learner records or school data live here; those arrive with PR-D04 through
 * the shared auth client, not through this store.
 * PR-D02 extends this slice (role gate, command registry) instead of adding a
 * second store over the same window.
 * SOT: apps/desktop/src/store.ts
 * SOT-KEYWORDS: desktop zustand shell store section density resource error
 */
import { create } from "zustand";
import type { DesktopDensity, DesktopSection } from "./layout";

export type ShellError = { readonly source: string; readonly message: string };

interface ShellState {
  section: DesktopSection;
  density: DesktopDensity;
  /** Base name only. The absolute path is never stored, read or uploaded. */
  resourceName: string | null;
  error: ShellError | null;
  setSection: (section: DesktopSection) => void;
  setDensity: (density: DesktopDensity) => void;
  setResourceName: (name: string | null) => void;
  reportError: (source: string, cause: unknown) => void;
  dismissError: () => void;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export const useShellStore = create<ShellState>()((set) => ({
  section: "workspace",
  density: "comfortable",
  resourceName: null,
  error: null,
  setSection: (section) => set({ section }),
  setDensity: (density) => set({ density }),
  setResourceName: (resourceName) => set({ resourceName }),
  reportError: (source, cause) => set({ error: { source, message: messageOf(cause) } }),
  dismissError: () => set({ error: null }),
}));

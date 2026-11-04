import { create } from "zustand";
import type { DesktopSection } from "./layout";

// UI-only ephemeral store; no credentials, learner records or school data.
interface PreviewState {
  section: DesktopSection;
  note: string;
  selectedResource: string | null;
  error: string | null;
  setSection: (section: DesktopSection) => void;
  setNote: (note: string) => void;
  clearNote: () => void;
  setResource: (fileName: string | null) => void;
  setError: (error: string | null) => void;
}
export const usePreviewStore = create<PreviewState>()((set) => ({
  section: "overview",
  note: "",
  selectedResource: null,
  error: null,
  setSection: (section) => set({ section, error: null }),
  setNote: (note) => set({ note }),
  clearNote: () => set({ note: "" }),
  setResource: (selectedResource) => set({ selectedResource }),
  setError: (error) => set({ error }),
}));

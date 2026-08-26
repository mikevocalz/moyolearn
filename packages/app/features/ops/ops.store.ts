import { create } from 'zustand';
import type { SidebarMode } from '@acme/ui';

// Ops chrome state — zustand always (repo rule), never React useState.
//
// Sidebar collapse and the active section are DURABLE VIEW PREFERENCES: nobody
// would paste them into Slack, so they belong here and not in the URL. Sorting,
// filters and the active saved view go the other way — into search params —
// because people share and bookmark those.
// SOT: CLAUDE.md (UI · state) · docs/pack/28-crm-spec.md §3 (views)
// SOT-KEYWORDS: ops store sidebar collapse nav zustand view prefs dashboard
interface OpsChromeState {
  /**
   * `auto` is the responsive default — rail on a tablet, menu on a desktop.
   * The other two are the user having overridden it, which then holds at every
   * width. Not a boolean: a boolean cannot express "depends, until told".
   */
  sidebarMode: SidebarMode;
  /** Below md the sidebar is an overlay drawer; this is its open state. */
  menuOpen: boolean;
  section: string;
  setSidebarMode: (mode: 'rail' | 'menu') => void;
  toggleMenu: () => void;
  setSection: (section: string) => void;
}

export const useOpsChrome = create<OpsChromeState>((set) => ({
  sidebarMode: 'auto',
  menuOpen: false,
  section: 'today',
  setSidebarMode: (sidebarMode) => set({ sidebarMode }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  // Navigating on a phone must also dismiss the overlay, or the user taps a
  // section and stares at the menu that is still covering it.
  setSection: (section) => set({ section, menuOpen: false }),
}));

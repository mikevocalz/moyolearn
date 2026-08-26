import { create } from 'zustand';

// Ops chrome state — zustand always (repo rule), never React useState.
//
// Sidebar collapse and the active section are DURABLE VIEW PREFERENCES: nobody
// would paste them into Slack, so they belong here and not in the URL. Sorting,
// filters and the active saved view go the other way — into search params —
// because people share and bookmark those.
// SOT: CLAUDE.md (UI · state) · docs/pack/28-crm-spec.md §3 (views)
// SOT-KEYWORDS: ops store sidebar collapse nav zustand view prefs dashboard
interface OpsChromeState {
  /** Desktop only: the sidebar shrinks to a labelled rail. */
  collapsed: boolean;
  /** Below lg the sidebar is an overlay; this is its open state. */
  menuOpen: boolean;
  section: string;
  toggleCollapsed: () => void;
  toggleMenu: () => void;
  setSection: (section: string) => void;
}

export const useOpsChrome = create<OpsChromeState>((set) => ({
  collapsed: false,
  menuOpen: false,
  section: 'today',
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  // Navigating on a phone must also dismiss the overlay, or the user taps a
  // section and stares at the menu that is still covering it.
  setSection: (section) => set({ section, menuOpen: false }),
}));

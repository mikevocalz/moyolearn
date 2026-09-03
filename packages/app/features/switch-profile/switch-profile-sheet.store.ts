'use client';
// Visibility for the root-mounted FD-24 "Who's here?" sheet — global zustand
// for the same reason `account-sheet.store` is: every sheet mounts in the app's
// root `_layout` (the Gorhom nesting bug), while the trigger that opens this one
// lives in `ShellHeader`, several trees away.
//
// Separate from `useAccountSheet` on purpose. ADR-106 §Mechanics: the family-
// device profile switch is a DIFFERENT mechanism with a different threat model
// than the account sheet, and one shared `open` flag is the first step to the
// two being conflated. Separate from `useProfileSwitcherStore` too — that store
// holds the grown-ups GATE, which is content state and must survive the sheet
// being reopened.
// SOT: docs/38-front-door-and-flow.md §FD-24 ·
//      docs/decisions/adr-106-account-sheet-is-profile-you.md (2026-09-02 amendment)
// SOT-KEYWORDS: switch profile sheet store open close who's here fd-24 zustand

import { create } from 'zustand';

interface SwitchProfileSheetState {
  open: boolean;
  openSheet: () => void;
  closeSheet: () => void;
}

export const useSwitchProfileSheet = create<SwitchProfileSheetState>((set) => ({
  open: false,
  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),
}));

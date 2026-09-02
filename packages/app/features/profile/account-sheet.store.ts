'use client';
import { create } from 'zustand';

// Account-sheet visibility + sign-out pending flag — global zustand, because
// the sheet is root-mounted (Gorhom nesting bug — every sheet mounts in the
// app's root _layout) while its trigger lives in each shell's header. Same
// hoisted-store shape as the editor's AttachSheet (attach.store.ts) and the
// schedule's bookingOpen.
// SOT: docs/decisions/adr-106-account-sheet-is-profile-you.md ·
//      docs/design/overhaul-v2/J-component-plan.md §3
// SOT-KEYWORDS: account sheet avatar sheet store open close sign-out pending

interface AccountSheetState {
  open: boolean;
  /** Sign-out is in flight — the row goes inert instead of double-firing. */
  signingOut: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  setSigningOut: (signingOut: boolean) => void;
}

export const useAccountSheet = create<AccountSheetState>((set) => ({
  open: false,
  signingOut: false,
  openSheet: () => set({ open: true }),
  closeSheet: () => set({ open: false }),
  setSigningOut: (signingOut) => set({ signingOut }),
}));

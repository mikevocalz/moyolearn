'use client';
// FD-24 Grown-ups gate state — the visible half of the family-device unlock.
//
// Three resting positions — locked, verifying, failed — not a boolean pair: a
// failed PIN check drawn as "locked" invites a silent retry loop, and drawn as
// "unlocked" it is the exact kid-proofing hole FD-24 exists to close. `kind`
// makes each state its own copy and its own affordance. There is no `unlocked`
// resting state on purpose: success switches context immediately and the gate
// resets, so an unlocked-but-idle row can never be left on a child's screen.
//
// The verification itself (biometric or family PIN, doc 07) is the AuthPort
// seam the FD-24 route supplies to `ProfileSwitcher`; this store never sees a
// credential, only the outcome.
// SOT: docs/38-front-door-and-flow.md §FD-24 · docs/design/overhaul-v2/J-component-plan.md §2 row 8 · docs/decisions/adr-106-account-sheet-is-profile-you.md
// SOT-KEYWORDS: profile switcher store grown-ups gate locked verifying failed pin biometric family device fd-24 zustand

import { create } from 'zustand';

export type GrownUpsGate =
  | { kind: 'locked' }
  | { kind: 'verifying' }
  | { kind: 'failed' };

interface ProfileSwitcherState {
  gate: GrownUpsGate;
  beginVerify: () => void;
  verifyFailed: () => void;
  /** Back to locked — after a successful switch, or when the sheet closes. */
  resetGate: () => void;
}

export const useProfileSwitcherStore = create<ProfileSwitcherState>((set) => ({
  gate: { kind: 'locked' },
  beginVerify: () => set({ gate: { kind: 'verifying' } }),
  verifyFailed: () => set({ gate: { kind: 'failed' } }),
  resetGate: () => set({ gate: { kind: 'locked' } }),
}));

'use client';
// SwitchProfileSheet — the root-mounted host for FD-24's "Who's here?".
//
// Why it exists: the header's right slot has to hold a real control on EVERY
// band, and a K–2/3–5 learner may not have the account sheet (doc 36 §3.1 keeps
// their settings guardian-side). Handing the device to a sibling is the one
// account-shaped thing a child of that age legitimately does, so that is what
// the young learner's avatar opens. See the ADR-106 amendment recorded in
// `apps/mobile/components/ShellHeader.tsx`.
//
// It is the same `ProfileSwitcher` + `BottomSheet` pairing the learner You tab
// already mounts, with the same `grownUps: 'absent'` seam — a shell header owns
// no biometric or family-PIN surface, and a padlocked Grown-ups row with nothing
// behind it is a hole in the boundary FD-24 exists to hold. Sibling switching is
// complete and real; the guardian door stays where it can be authenticated.
//
// `Who's here?` is the chrome's title (doc 38 fixes the copy) — the content is
// the list, which is why no heading is passed down.
// Mobbin: mobbin.com/screens/65474c7d-3f9e-4cce-8dc4-57afeedeadb0 (Kit — "Who's there?" arrives as a sheet over the screen you were on, not as a destination) ·
// mobbin.com/screens/9d952a8b-7e1e-43a5-b034-041e84f78c49 (Duolingo ABC "Who's Learning?" — profile switching reachable from chrome on a child's surface) ·
// mobbin.com/screens/f44beff7-45cf-4a89-b1b3-0fbeb8a2a6e1 (HBO Max — who's-watching overlays the app and dismisses back to it). Structure only.
// SOT: docs/38-front-door-and-flow.md §FD-24 ·
//      docs/decisions/adr-106-account-sheet-is-profile-you.md (2026-09-02 amendment)
// SOT-KEYWORDS: switch profile sheet who's here fd-24 root mounted learner band header avatar

import { BottomSheet } from '@acme/ui';
import { useAppSession } from '../../providers/session';
import { ProfileSwitcher } from './profile-switcher';
import { useSwitchProfileSheet } from './switch-profile-sheet.store';

export function SwitchProfileSheet() {
  const open = useSwitchProfileSheet((s) => s.open);
  const closeSheet = useSwitchProfileSheet((s) => s.closeSheet);
  const { activeContext } = useAppSession();

  // Nothing to hand a device to before there is a session.
  if (activeContext.kind === 'anon') return null;

  return (
    <BottomSheet title="Who's here?" open={open} onClose={closeSheet}>
      <ProfileSwitcher grownUps={{ kind: 'absent' }} onSwitched={closeSheet} />
    </BottomSheet>
  );
}

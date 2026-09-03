'use client';
// ProfileSwitcher — FD-24 "Who's here?", the family-device profile switch.
//
// ADR-106's boundary is binding: this is a different mechanism with a different
// threat model than the AvatarSheet — never merged with it, never launched from
// it. Learner rows switch freely; the guardian shell sits behind the locked
// `Grown-ups` row (biometric or family PIN via the AuthPort seam the route
// supplies), so a child cannot reach guardian surfaces without it (the HBO
// kid-proof exit pattern, doc 38 §FD-24).
//
// Switching reuses ContextSwitcher's exact chain — `setLastShellRole` then
// `setContext` — because the shell, the dial, and the guard tree all read
// `activeContext`; a second switching path would fork what "who is using the
// device" means. Learner rows come from `family.store`, the same seam every
// per-child guardian surface reads.
//
// This is the content component + store the FD-24 route (`account/switch`) and
// the learner You tab mount inside `BottomSheet`. The chrome stays at the host,
// which is why the `Who's here?` title lives there and not here: hosts that
// render it bare wrap it in `SheetSurface`, the exported surface that carries
// the same header without the portal.
// Mobbin: mobbin.com/screens/65474c7d-3f9e-4cce-8dc4-57afeedeadb0 (Kit — "Who's there?": kid profiles switch freely while the padlocked adult "Boss" profile gates guardian surfaces) ·
// mobbin.com/screens/f44beff7-45cf-4a89-b1b3-0fbeb8a2a6e1 (HBO Max — who's-watching picker where the lock badge rides the adult profile and a PIN stands between child and grown-up shell) ·
// mobbin.com/screens/fbcb9fd4-1d7c-4aaf-9680-a1f7b671b47e (Disney+ — family profile grid: avatar + name per row, per-profile lock affordance, add-profile as the terminal item). Structure only.
// SOT: docs/38-front-door-and-flow.md §FD-24 · docs/decisions/adr-106-account-sheet-is-profile-you.md · docs/design/overhaul-v2/J-component-plan.md §2 row 8
// SOT-KEYWORDS: profile switcher fd-24 family device who's here grown-ups locked pin biometric switch profile continuity

import { Avatar, List, ListItem } from '@acme/ui';
import { Lock, LoaderCircle } from '@acme/ui/icons';
import { View } from '@acme/ui/tw';
import {
  membershipForRole,
  setLastShellRole,
  useAppSession,
  useSetContext,
} from '../../providers/session';
import { useFamilyStore, type ChildSummary } from '../family/family.store';
import { useProfileSwitcherStore } from './profile-switcher.store';

/**
 * The AuthPort seam, as a state rather than a maybe-callback.
 *
 * `absent` is not "no check" — it is "this host cannot perform one", and the
 * row is then omitted entirely. A Grown-ups row with nothing behind its padlock
 * is a hole in exactly the boundary FD-24 exists to hold (E §3: kid-proof), and
 * an always-failing one is a dead row a child taps forever. Hosts that own a
 * biometric/family-PIN check pass `present`; hosts that do not (the learner You
 * tab, which has no credential surface) pass `absent` and offer sibling
 * switching only.
 */
export type GrownUpsAuth =
  | { kind: 'present'; verify: () => Promise<boolean> }
  | { kind: 'absent' };

export interface ProfileSwitcherProps {
  /** Resolves true to unlock the guardian switch; the component never sees a credential. */
  grownUps: GrownUpsAuth;
  /** Fires after any successful switch so the mounting sheet can close. */
  onSwitched?: () => void;
}

/** FD-24 copy is fixed by doc 38: `Who's here?` · `Grown-ups`. */
const GATE_COPY = {
  locked: 'Family PIN or fingerprint',
  verifying: 'Checking…',
  failed: 'That didn’t match — try again',
} as const;

export function ProfileSwitcher({ grownUps, onSwitched }: ProfileSwitcherProps) {
  const learners = useFamilyStore((s) => s.children);
  const { memberships } = useAppSession();
  const setContext = useSetContext();
  const gate = useProfileSwitcherStore((s) => s.gate);
  const beginVerify = useProfileSwitcherStore((s) => s.beginVerify);
  const verifyFailed = useProfileSwitcherStore((s) => s.verifyFailed);
  const resetGate = useProfileSwitcherStore((s) => s.resetGate);

  const switchToLearner = (child: ChildSummary) => {
    setLastShellRole('learner');
    setContext({ kind: 'learner', learnerId: child.id, gradeBand: child.gradeBand });
    onSwitched?.();
  };

  const onGrownUpsPress = () => {
    // A press during verification is a double-tap, not a second attempt.
    if (gate.kind === 'verifying' || grownUps.kind === 'absent') return;
    beginVerify();
    void grownUps.verify().then((ok) => {
      if (!ok) {
        verifyFailed();
        return;
      }
      resetGate();
      setLastShellRole('guardian');
      setContext({
        kind: 'guardian',
        orgId: membershipForRole(memberships, 'guardian')?.orgId,
      });
      onSwitched?.();
    });
  };

  /*
    No heading here. FD-24's title is `Who's here?` and the CHROME owns it —
    `BottomSheet`/`SheetSurface` already renders it as the dialog's accessible
    name, so a heading inside the content printed the same sentence twice, once
    as the sheet header and once as an h2 under it. The content is the list.
  */
  return (
    <View className="gap-stack">
      <List>
        {learners.map((child) => (
          <ListItem
            key={child.id}
            leading={<Avatar name={child.name} size="md" />}
            onPress={() => switchToLearner(child)}
          >
            {child.name}
          </ListItem>
        ))}
        {grownUps.kind === 'present' ? (
          <ListItem
            leading={
              <View className="h-11 w-11 items-center justify-center rounded-md border-2 border-border bg-surface-sunken">
                <Lock size={18} className="text-text" />
              </View>
            }
            trailing={
              gate.kind === 'verifying' ? (
                <LoaderCircle size={16} className="text-text-muted" />
              ) : undefined
            }
            supportingText={GATE_COPY[gate.kind]}
            onPress={onGrownUpsPress}
          >
            Grown-ups
          </ListItem>
        ) : null}
      </List>
    </View>
  );
}

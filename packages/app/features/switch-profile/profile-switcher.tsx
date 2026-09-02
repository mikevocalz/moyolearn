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
// This is the content component + store the FD-24 route (`account/switch`)
// mounts inside `BottomSheet`; the chrome stays at the route so the content can
// also render inline (Storybook, web).
// SOT: docs/38-front-door-and-flow.md §FD-24 · docs/decisions/adr-106-account-sheet-is-profile-you.md · docs/design/overhaul-v2/J-component-plan.md §2 row 8
// SOT-KEYWORDS: profile switcher fd-24 family device who's here grown-ups locked pin biometric switch profile continuity

import { Avatar, Heading, List, ListItem } from '@acme/ui';
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

export interface ProfileSwitcherProps {
  /**
   * The AuthPort seam: the FD-24 route supplies the biometric/family-PIN check
   * (doc 07). Resolves true to unlock the guardian switch; the component never
   * sees a credential.
   */
  verifyGrownUp: () => Promise<boolean>;
  /** Fires after any successful switch so the mounting sheet can close. */
  onSwitched?: () => void;
}

/** FD-24 copy is fixed by doc 38: `Who's here?` · `Grown-ups`. */
const GATE_COPY = {
  locked: 'Family PIN or fingerprint',
  verifying: 'Checking…',
  failed: 'That didn’t match — try again',
} as const;

export function ProfileSwitcher({ verifyGrownUp, onSwitched }: ProfileSwitcherProps) {
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
    if (gate.kind === 'verifying') return;
    beginVerify();
    void verifyGrownUp().then((ok) => {
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

  return (
    <View className="gap-stack">
      <Heading level={2} size="title">
        Who&apos;s here?
      </Heading>
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
      </List>
    </View>
  );
}

'use client';
// AccountSheet — app-side content for the AvatarSheet chrome (ADR-106): the
// mobile form of Profile/You, root-mounted like every sheet, opened from
// ShellHeader's avatar. Deep-links only, never a duplicated list (the
// no-duplication law): rows push into /settings and the PW-05 plan routes.
// Per-role rows are G §2's table verbatim; the 6–8/9–12 learner sheet is the
// identity header alone, and K–2/3–5 render nothing at all — their settings
// stay guardian-side (doc 36 §3.1). Plan & billing NEVER renders for a
// learner, on any paid state (PW-03b law).
// FD-24's family-device ProfileSwitcher is a different mechanism with a
// different threat model — never launched from here (E-matrix §3).
// Mobbin: mobbin.com/screens/abdab1a1-c88c-40b9-8197-65c7cae286be (Fabric — switcher one visible gesture from the avatar, the Slack lesson made concrete) ·
// mobbin.com/screens/f473e6d8-03ee-494d-8297-89af8e99f209 (Remote Global HR — role-labelled membership rows with an active check, log out last) ·
// mobbin.com/screens/7ed0fd81-e883-4b70-bf04-c77b7a0a264f (Grok Bot — settings rows deep-link out of the sheet, sign-out in its own group). Structure only.
// SOT: docs/decisions/adr-106-account-sheet-is-profile-you.md ·
//      docs/design/overhaul-v2/J-component-plan.md §3 ·
//      docs/design/overhaul-v2/G-navigation-maps.md §2
// SOT-KEYWORDS: account sheet avatar sheet profile you content rows sign-out
//               context switcher plan billing role noun band gate

import { useRouter } from 'solito/navigation';
import {
  Avatar,
  AvatarSheet,
  RoleScope,
  type AvatarSheetRow,
  type AvatarSheetSection,
} from '@acme/ui';
import { Bell, CreditCard, LogOut, Settings } from '@acme/ui/icons';
import { Text, View } from '@acme/ui/tw';
import {
  authClient,
  ContextSwitcher,
  roleNoun,
  shellForRole,
  useAppSession,
  type RoleKind,
} from '../../providers/session';
import { AVATAR_URI, useProfile } from './profile.store';
import { useAccountSheet } from './account-sheet.store';

/**
 * PW-05's plan routes — `(guardian)/settings/plan` and `(org)/settings/plan` —
 * have not landed yet, so Plan & billing deep-links to the settings surface
 * that exists. Re-point these two constants when the PW-05 lane ships; nothing
 * else in the sheet changes.
 */
const GUARDIAN_PLAN_PATH = '/settings';
const ORG_PLAN_PATH = '/settings';

const iconClass = 'text-text-muted';

function sectionsFor(
  kind: RoleKind,
  go: (path: string) => void,
  signOut: () => void,
  signingOut: boolean,
): AvatarSheetSection[] {
  // G §2's learner column: identity header alone. Everything else is the You
  // tab's job — and a guardian-managed device has no learner sign-out.
  if (kind === 'learner') return [];

  const planPath =
    kind === 'guardian' ? GUARDIAN_PLAN_PATH : kind === 'owner' ? ORG_PLAN_PATH : null;

  const account: AvatarSheetRow[] = [
    {
      key: 'settings',
      label: 'Profile & settings',
      icon: <Settings size={20} className={iconClass} />,
      onPress: () => go('/settings'),
    },
    // Guardian and org OWNER only (PW-05, doc 38 §3) — staff, tutor and
    // teacher never see a billing row.
    ...(planPath !== null
      ? [
          {
            key: 'plan',
            label: 'Plan & billing',
            icon: <CreditCard size={20} className={iconClass} />,
            onPress: () => go(planPath),
          },
        ]
      : []),
    {
      key: 'notifications',
      label: 'Notification prefs',
      icon: <Bell size={20} className={iconClass} />,
      onPress: () => go('/settings'),
    },
  ];

  return [
    { key: 'account', rows: account },
    {
      key: 'session',
      rows: [
        {
          key: 'sign-out',
          label: signingOut ? 'Signing out…' : 'Sign out',
          icon: <LogOut size={20} className={iconClass} />,
          trailing: null,
          disabled: signingOut,
          onPress: signOut,
        },
      ],
    },
  ];
}

export function AccountSheet() {
  const open = useAccountSheet((s) => s.open);
  const closeSheet = useAccountSheet((s) => s.closeSheet);
  const signingOut = useAccountSheet((s) => s.signingOut);
  const setSigningOut = useAccountSheet((s) => s.setSigningOut);
  const { user, activeContext } = useAppSession();
  const name = useProfile((s) => s.name);
  const router = useRouter();

  if (!user || activeContext.kind === 'anon') return null;
  const kind = activeContext.kind;

  // Band law (ADR-106): the learner sheet exists for 6–8/9–12 only. Same band
  // read + fallback as the learner tabs layout — until the band-population fix
  // lands (A-repo-audit defect (a)) a missing band fails open to teen, exactly
  // as the tab bar does, so header, tabs and sheet can never disagree.
  const band = activeContext.gradeBand ?? 'teen';
  if (kind === 'learner' && (band === 'young' || band === 'child')) return null;

  // Close before pushing — the sheet overlays the whole screen, so navigating
  // beneath it would land the user on a route they cannot see (the
  // BookingSheet lesson).
  const go = (path: string) => {
    closeSheet();
    router.push(path);
  };

  const signOut = () => {
    setSigningOut(true);
    void (async () => {
      // Replace to the dispatcher, not a login deep-link: the front door owns
      // where an anon session lands (doc 38 FD-01/FD-02). `finally` so a failed
      // revocation still leaves the sheet instead of stranding the person on a
      // dead row — the settings-content sign-out pattern, verbatim.
      try {
        await authClient.signOut();
      } finally {
        setSigningOut(false);
        closeSheet();
        router.replace('/');
      }
    })();
  };

  // Hot for the family/learner doors, cool for ops/educator/institution —
  // doc 02 §5.3's temperature split, inherited by every row via the chrome's
  // Dial wrapper.
  const temperature = kind === 'learner' || kind === 'guardian' ? 'hot' : 'cool';

  // The sheet mounts at the ROOT, outside every shell's RoleScope — so the one
  // allowlisted accent moment (doc 36 §5: role accent as the Avatar ring ONLY)
  // scopes itself here, around the ring alone. Chrome stays neutral.
  const shell = shellForRole(kind) ?? 'learner';

  return (
    <AvatarSheet
      open={open}
      onClose={closeSheet}
      temperature={temperature}
      identity={
        <View className="flex-row items-center gap-stack">
          <RoleScope role={shell}>
            {/* The ring is a FILL behind the avatar, never a border colour —
                the role-accent gate's text/border ban applies everywhere. */}
            <View className="rounded-md bg-role-accent p-0.5">
              <Avatar name={name} imageUri={AVATAR_URI} size="lg" />
            </View>
          </RoleScope>
          <View className="flex-1 gap-1">
            <Text className="text-body-lg font-semibold text-text">{name}</Text>
            <Text className="text-caption text-text-muted">{roleNoun(kind)}</Text>
          </View>
        </View>
      }
      sections={sectionsFor(kind, go, signOut, signingOut)}
    >
      {/* One visible gesture from the avatar — the Slack lesson (ADR-106).
          The switcher keeps its own ≥2-memberships guard; a child never
          switches, so the learner sheet omits it entirely. */}
      {kind !== 'learner' ? <ContextSwitcher /> : null}
    </AvatarSheet>
  );
}

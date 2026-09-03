'use client';
// Profile / You — two screens behind one route, split by who is looking.
//
// `learner.you` is a child's screen and was being served an adult's: a Name and
// an Email field, a sign-in-and-receipts hint, and no answer to either of the
// contract's 5-second questions ("Is this my profile?", "How do I switch to my
// sibling?"). 121 characters of text and five controls on a full desktop
// viewport was the measurement; the cause was that the learner branch did not
// exist at all.
//
// The learner half now leads with identity at band scale and carries exactly one
// primary action — Switch profile, which mounts FD-24's ProfileSwitcher in a
// sheet from this screen, the entry the contract names. It has no email row (a
// child does not own the sign-in address), no billing row on any paid state
// (PW-03b law), no ContextSwitcher (a child never hat-switches, E §3), and
// settings only for 6–12 (K–2/3–5 keep everything guardian-side, doc 36 §3.1).
//
// K–2 has no You surface in its IA at all, so reaching this route as `young` is
// out-of-band — it renders the identity block and the switch, and nothing else.
// A refusal would be a dead end, which law 1 forbids; a settings list would
// break doc 36 §3.1. Showing a child who they are is safe in every band.
//
// Mobbin: mobbin.com/screens/9d952a8b-7e1e-43a5-b034-041e84f78c49 (Duolingo ABC
// "Who's Learning?" — child profile switching as a first-class, unlocked
// affordance) · mobbin.com/screens/ee81ba2b-4028-42e1-9227-94799c8d6e48
// (Disney+ — identity as one large avatar and a name, with switching the only
// action on the surface) · mobbin.com/screens/33a4fc6b-d667-417a-b155-f1f0a1f2e2a8
// (Hulu Switch Profile — the current profile marked, the others plainly listed
// beneath it) · mobbin.com/screens/85de8025-3cf2-4bfa-a85f-55c830ff15ea
// (Netflix — the kids profile sits in the same picker as the adults, no price
// or account row anywhere near it) · mobbin.com/screens/671037f7-9e74-4cc1-995e-23a095a54ebe
// (Tubi — a kids account whose management rows are addressed to the adult,
// never rendered to the child). Structure only. Type ramp, targets, dial and
// spacing are docs 02/08.
// SOT: design/screens/learner/learner.you/contract.md · docs/38-front-door-and-flow.md §FD-24 ·
//      docs/design/overhaul-v2/G-navigation-maps.md §2
// SOT-KEYWORDS: profile you learner identity switch profile fd-24 band settings gate account states

import { useRouter } from 'solito/navigation';
import { Section, View } from '@acme/ui/tw';
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  FadeIn,
  Heading,
  LoadingSkeleton,
  PressScale,
  ReadFailure,
  ScaleIn,
  Text,
  TextField,
  useInstanceStore,
  useStore,
} from '@acme/ui';
import { Settings as SettingsIcon, ChevronRight } from '@acme/ui/icons';
import { AVATAR_URI, useProfile } from './profile.store';
import { authClient, ContextSwitcher, useAppSession } from '../../providers/session';
import type { ActiveContextKind } from '../../providers/session';
import { ProfileSwitcher } from '../switch-profile/profile-switcher';
import { useFamilyStore } from '../family/family.store';
import { bandScaleFor, type AgeBand } from '../capture/age-band';
import { readFailureCopy } from '../../core/read-failure-copy.ts';
import { ApiError } from '../../core/api-fetch.ts';
import { useIsOnline } from '../../core/use-is-online.ts';

// The role line under the name — the learner.you contract's calm identity
// block names WHO this is and WHAT hat they wear, nothing quantified. Nouns
// match RoleShell's membership labels so profile and chrome never disagree.
const ROLE_NOUN: Record<ActiveContextKind, string> = {
  anon: 'Guest',
  learner: 'Learner',
  guardian: 'Parent',
  tutor: 'Tutor',
  teacher: 'Teacher',
  owner: 'Owner',
  staff: 'Staff',
  school_admin: 'School admin',
  district_admin: 'District admin',
};

/** The purpose line, per band — what this screen is FOR, in the child's register. */
const LEARNER_PURPOSE = {
  young: 'This is you. Tap to swap to someone else.',
  child: 'This is you. Switch if someone else needs a turn.',
  teen: 'Your profile, and how to hand the device to someone else.',
  adult: 'Your profile, and how to hand the device to someone else.',
} as const satisfies Record<AgeBand, string>;

export function ProfileContent() {
  const { activeContext, status } = useAppSession();
  const kind = activeContext.kind;

  if (status === 'loading') {
    return (
      <View className="gap-group">
        <View className="flex-row items-center gap-5">
          <LoadingSkeleton variant="avatar" className="h-20 w-20" />
          <LoadingSkeleton variant="line" className="max-w-48" />
        </View>
        <LoadingSkeleton variant="card" count={2} />
      </View>
    );
  }

  return kind === 'learner' ? <LearnerProfile /> : <AccountProfile />;
}

function LearnerProfile() {
  const p = useProfile();
  const { user, activeContext } = useAppSession();
  // Band law idiom (account-sheet-content): a missing band fails open to teen
  // until the band-population fix lands, so header, tabs and this gate agree.
  const ageBand: AgeBand = activeContext.gradeBand ?? 'teen';
  const scale = bandScaleFor(ageBand);
  const router = useRouter();
  const online = useIsOnline();
  // Sheet visibility is per-instance, not global: two mounted profile screens
  // (a pane host, a Storybook grid) must not share one open flag.
  const sheet = useInstanceStore<{ open: boolean }>(() => ({ open: false }));
  const open = useStore(sheet, (s) => s.open);

  // learner.you contract: settings are 6–12 only. K–2/3–5 keep everything
  // guardian-side, and the shared /settings route enforces the same wall.
  const showSettings = ageBand === 'teen' || ageBand === 'adult';
  // Everyone provisioned on this device except the child reading the screen.
  const othersHere = useFamilyStore((st) => st.children)
    .filter((child) => child.name !== (user?.name ?? p.name))
    .map((child) => child.name);
  // The contract's `no_data` path: a learner profile always exists post-FD-16,
  // so the floor is name + avatar rather than an empty state.
  const name = user?.name ?? p.name;

  return (
    <View className={scale.gap}>
      {/* Identity — avatar, name, role line, nothing else. No stat row: follower
          and streak counts on a child's surface are the engagement-pressure
          mechanic the children's rules ban, and no Moyo role has followers. */}
      <FadeIn>
        <Section className="gap-stack">
          <View className="flex-row flex-wrap items-center gap-5">
            <ScaleIn delay={60}>
              <Avatar name={name} imageUri={AVATAR_URI} size="xl" />
            </ScaleIn>
            <View className="min-w-40 flex-1 gap-1">
              <Heading level={1} size={scale.title}>
                {name}
              </Heading>
              <Text tone="muted" className={scale.lead}>
                {LEARNER_PURPOSE[ageBand]}
              </Text>
            </View>
          </View>
        </Section>
      </FadeIn>

      {/* The one primary action the contract allows, at the band's target size.
          FD-24 mounts from HERE — the sheet is the surface, this screen is the
          entry (contract `entry_points`: "FD-24 sheet mounts from this screen"). */}
      <FadeIn delay={80}>
        <Button
          variant="primary"
          title="Switch profile"
          className={scale.target}
          onPress={() => sheet.setState({ open: true })}
        />
      </FadeIn>

      {/* Who else is on this device, named. The contract's second 5-second
          question is "how do I switch to my sibling / hand the tablet back?",
          and a button alone answers it only after a tap — the names answer it
          on sight. Read from `family.store`, the same seam every per-child
          surface reads, so this can never disagree with the sheet it opens. */}
      <FadeIn delay={120}>
        <Section className="gap-element">
          <Text variant="label" tone="muted">
            Also on this device
          </Text>
          <Text tone="muted" className={scale.lead}>
            {othersHere.length > 0
              ? `${othersHere.join(' and ')} ${othersHere.length === 1 ? 'uses' : 'use'} this app here too.`
              : 'Nobody else is set up here yet.'}
          </Text>
          {/* Offline is a label, never a block: the contract keeps switching
              working for profiles already provisioned on this device. */}
          {!online ? (
            <Text variant="caption" tone="muted">
              You are offline — switching still works for everyone set up here.
            </Text>
          ) : null}
        </Section>
      </FadeIn>

      {/* K–2 and 3–5 keep every setting guardian-side (doc 36 §3.1). Saying so
          is the difference between a child understanding where their settings
          live and a child hunting for a control that is not there. */}
      {!showSettings ? (
        <FadeIn delay={160}>
          <Text tone="muted" className={scale.lead}>
            A grown-up looks after your settings.
          </Text>
        </FadeIn>
      ) : null}

      {showSettings ? (
        <FadeIn delay={140}>
          <PressScale
            aria-label="Open settings"
            onPress={() => router.push('/settings')}
            className={`w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised shadow-card ${scale.target} ${scale.inset}`}
            outerClassName="w-full"
          >
            <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <SettingsIcon size={20} className="text-text" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text variant="heading">Settings</Text>
              <Text variant="caption" tone="muted">
                Notifications, appearance, session.
              </Text>
            </View>
            <ChevronRight size={18} className="text-text-muted" />
          </PressScale>
        </FadeIn>
      ) : null}

      <BottomSheet title="Who's here?" open={open} onClose={() => sheet.setState({ open: false })}>
        {/*
          `absent`, deliberately: this screen owns no biometric or family-PIN
          surface, and a padlocked Grown-ups row with nothing behind it is a hole
          in the boundary FD-24 exists to hold. Sibling switching is complete and
          real; the guardian door stays where it can actually be authenticated.
        */}
        <ProfileSwitcher grownUps={{ kind: 'absent' }} onSwitched={() => sheet.setState({ open: false })} />
      </BottomSheet>
    </View>
  );
}

/**
 * Every adult role: the account surface this route always was. Kept whole —
 * name and email edit honestly here, and settings/appearance/session live one
 * push away on `/settings` rather than being duplicated into this screen.
 */
function AccountProfile() {
  const p = useProfile();
  const router = useRouter();
  const { user, activeContext, status } = useAppSession();
  const kind = activeContext.kind;

  if (status === 'anon' || user === null) {
    // An expired session is not an empty profile. `readFailureCopy` decides the
    // sentence from the cause, so this reads "You've been signed out" with the
    // one exit that actually works rather than a retry loop.
    const failure = readFailureCopy(
      new ApiError(401),
      'your profile',
      'Nothing about your account has changed.',
    );
    return (
      <ReadFailure
        title={failure.title}
        description={failure.description}
        /* A real re-read, not a page reload: Better Auth's client holds the
           session in a store `useSession` subscribes to, so re-fetching it is
           what re-runs the provider. */
        onRetry={() => {
          void authClient.getSession();
        }}
        action={<Button variant="primary" title="Sign in" onPress={() => router.push('/')} />}
      />
    );
  }

  return (
    <View className="gap-group md:gap-10 lg:gap-12">
      <FadeIn>
        <Section className="gap-4">
          <View className="flex-row flex-wrap items-center gap-5">
            <ScaleIn delay={60}>
              <Avatar name={p.name} imageUri={AVATAR_URI} size="xl" />
            </ScaleIn>
            <View className="min-w-40 flex-1 gap-1">
              <Heading level={1} size="display-sm">
                {p.name}
              </Heading>
              <Text tone="muted">{ROLE_NOUN[kind]}</Text>
            </View>
          </View>
        </Section>
      </FadeIn>

      <FadeIn delay={80}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Account</Text>
            <Text variant="caption" tone="muted">
              How you appear across the app.
            </Text>
          </View>
          <TextField label="Name" value={p.name} onChangeText={p.setName} />
          <TextField
            label="Email"
            value={p.email}
            onChangeText={p.setEmail}
            hint="Used for sign-in and receipts."
          />
        </Card>
      </FadeIn>

      <FadeIn delay={140}>
        <PressScale
          aria-label="Open settings"
          onPress={() => router.push('/settings')}
          className="min-h-target-adult w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-inset shadow-card"
          outerClassName="w-full"
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <SettingsIcon size={20} className="text-text" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="heading">Settings</Text>
            <Text variant="caption" tone="muted">
              Notifications, appearance, session.
            </Text>
          </View>
          <ChevronRight size={18} className="text-text-muted" />
        </PressScale>
      </FadeIn>

      {/* The role switcher lives HERE, in Profile/You (doc 36 §4.3): shells
          never blend, so changing hats is a full shell swap. It renders nothing
          for the single-hat majority, and never for a learner — which is why it
          sits in this branch and not the shared one. */}
      <FadeIn delay={180}>
        <ContextSwitcher />
      </FadeIn>
    </View>
  );
}

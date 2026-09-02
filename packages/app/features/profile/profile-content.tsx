'use client';
// Shared profile sections — identity, account, preferences, session.
// One screen owns the whole "you" surface; settings live here, not on a
// separate route (design decision: fewer places, clearer map).
import { useRouter } from 'solito/navigation';
import { Section, View } from '@acme/ui/tw';
import {
  Avatar,
  Card,
  Heading,
  PressScale,
  Text,
  TextField,
  FadeIn,
  ScaleIn,
} from '@acme/ui';
import { Settings as SettingsIcon, ChevronRight } from '@acme/ui/icons';
import { AVATAR_URI, useProfile } from './profile.store';
import { ContextSwitcher, useAppSession } from '../../providers/session';
import type { ActiveContextKind } from '../../providers/session';

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

export function ProfileContent() {
  const p = useProfile();
  const router = useRouter();
  const { activeContext } = useAppSession();
  const kind = activeContext.kind;
  // Band law idiom (account-sheet-content): a missing band fails open to teen
  // until the band-population fix lands, so header, tabs and this gate agree.
  const band = activeContext.gradeBand ?? 'teen';
  // learner.you contract: the settings entry is 6–12 only (teen|adult bands);
  // K–2/3–5 keep everything guardian-side. Every other role keeps the row.
  const showSettings = kind !== 'learner' || band === 'teen' || band === 'adult';

  return (
    <View className="gap-group md:gap-10 lg:gap-12">
      {/* Identity — the learner.you contract's calm block: avatar, name, role
          line, nothing else. The template's tags and Projects/Followers/
          Following stat row are gone deliberately: follower counts on a
          child's surface are the engagement-pressure mechanic the children's
          rules ban, and no Moyo role has "followers". The "Edit profile"
          button is removed rather than wired: FD-24 (switch profile) and the
          FD-26 avatar sheet are unbuilt, and name/email already edit honestly
          in the Account card below — a dead onPress={() => {}} is worse than
          no button. */}
      <FadeIn>
        <Section className="gap-4">
          <View className="flex-row flex-wrap items-center gap-5">
            <ScaleIn delay={60}>
              <Avatar name={p.name} imageUri={AVATAR_URI} size="xl" />
            </ScaleIn>
            <View className="min-w-40 flex-1 gap-1">
              <Heading level={1} size="display-sm">{p.name}</Heading>
              <Text tone="muted">{ROLE_NOUN[kind]}</Text>
            </View>
          </View>
        </Section>
      </FadeIn>

      {/* Account */}
      <FadeIn delay={80}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">Account</Text>
            <Text variant="caption" tone="muted">How you appear across the app.</Text>
          </View>
          <TextField label="Name" value={p.name} onChangeText={p.setName} />
          <TextField label="Email" value={p.email} onChangeText={p.setEmail} hint="Used for sign-in and receipts." />
        </Card>
      </FadeIn>

      {/* Settings entry — preferences, appearance, and session live there.
          Band-gated for learners (learner.you: settings are 6–12 only; the
          shared /settings route enforces the same wall). */}
      {showSettings ? (
      <FadeIn delay={140}>
        <PressScale
          aria-label="Open settings"
          onPress={() => router.push('/settings')}
          className="w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-4 shadow-card"
          outerClassName="w-full"
        >
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <SettingsIcon size={20} className="text-text" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text variant="heading">Settings</Text>
            <Text variant="caption" tone="muted">Notifications, appearance, session.</Text>
          </View>
          <ChevronRight size={18} className="text-text-muted" />
        </PressScale>
      </FadeIn>
      ) : null}

      {/* The role switcher lives HERE, in Profile/You (doc 36 §4.3): shells
          never blend, so changing hats is a full shell swap — the switcher
          rewrites the active context and the guard trees do the rest. Renders
          nothing for the single-hat majority — and NEVER for a learner:
          learner.you's contract says a child never hat-switches (E §3);
          multiple learners on one device is FD-24's job, not memberships. */}
      {kind !== 'learner' ? (
        <FadeIn delay={180}>
          <ContextSwitcher />
        </FadeIn>
      ) : null}
    </View>
  );
}

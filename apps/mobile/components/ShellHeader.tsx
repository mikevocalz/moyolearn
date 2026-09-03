// The app bar for every shell route. Uses the Cool chrome dialect: one hairline
// border, no decorative accent strip, type tokens for the title, and a tabular
// center layout that keeps the title readable whether the avatar is shown.
//
// Titles come from the path, not navigation options, for the reason the old
// header documented: a tab layout's options carry the group's name, never the
// focused tab's. Each shell passes its own title map.
//
// The avatar opens the root-mounted AccountSheet (ADR-106: Profile/You as
// chrome, never a route push) — the former `profileHref` branch was dead code
// with zero call sites (C-orphans), which is how the account surface stayed
// absent.
//
// Mobbin: Quizlet titled bar (mobbin.com/screens/d8bb66b8-7bae-4cc3-8241-7aab8e04be5a) ·
// Headway home header (mobbin.com/screens/b7fa7b42-bea8-4d9d-b89f-1042779ffb17)
// SOT: docs/pack/36-role-navigation-flows.md §3 §5 ·
//      docs/decisions/adr-106-account-sheet-is-profile-you.md
// SOT-KEYWORDS: shell header app bar title role accent avatar cool chrome account sheet

import { usePathname } from 'expo-router';
import { SafeArea, Avatar, MoyoLearnLogo } from '@acme/ui';
import { Header } from '@acme/ui/primitives';
import { Pressable, Text, View } from '@acme/ui/tw';
import { AVATAR_URI, useAccountSheet, useAppSession, useProfile } from '@acme/app';

/**
 * The wordmark sets the bar's height rather than sitting inside it: at 40pt tall
 * (~111pt wide at the mark's 2.77:1) plus the row's 8pt padding, the app bar
 * lands on the standard 56pt. Padding is deliberately tight for that reason —
 * loosen it and the mark stops reading as the header's full height.
 */
const LOGO_HEIGHT = 40;

export interface ShellHeaderProps {
  titles: Record<string, string>;
  fallback: string;
}

export function ShellHeader({ titles, fallback }: ShellHeaderProps) {
  const pathname = usePathname() ?? '/';
  const profileName = useProfile((state) => state.name);
  const { activeContext } = useAppSession();
  const openSheet = useAccountSheet((state) => state.openSheet);

  // ADR-106 band law: every shell gets the avatar EXCEPT K–2/3–5 learners,
  // whose settings stay guardian-side (doc 36 §3.1). Same band read + teen
  // fallback as the learner tabs layout, so header and tab bar can never
  // disagree about the band.
  const band = activeContext.gradeBand ?? 'teen';
  const showAvatar =
    activeContext.kind !== 'anon' &&
    !(activeContext.kind === 'learner' && (band === 'young' || band === 'child'));

  return (
    <SafeArea edges={['top']} className="bg-surface-header">
      <Header className="flex-row items-center gap-stack border-b-2 border-on-surface-header bg-surface-header px-4 py-2">
        {/*
          The brand sits at the left edge, the same `MoyoLearnLogo` the web site
          header uses — one logo component across both platforms, so the mark can
          never drift between them. It replaces a blank spacer that existed only
          to keep the title optically centred.
        */}
        {/* 20pt of air on the mark's left and right: at the bar's full height it
            otherwise sits flush to the edge and hard against the title. */}
        <View className="pl-1 pr-2">
          {/* ALWAYS the full-colour mark. The logo's inks are fixed brand
              property — no scheme, surface, or contrast problem is solved by
              recolouring it. If the mark does not read on a bar, the BAR is
              wrong; change the chrome behind it, never the logo. */}
          <MoyoLearnLogo height={LOGO_HEIGHT} accessibilityLabel="Moyo Learn" />
        </View>
        {/*
          `text-on-surface-header`, not `text-on-header`: the token is named for
          the fill it rides, so the class exists, the scheme flips with the bar,
          and check-contrast measures the pair. The old spelling had no
          `--color-on-header` behind it, fell through to the tw wrapper's
          `text-body-default` (= `--color-text`), and painted the title in the
          BODY colour — white on a lavender bar on any night-mode phone.
        */}
        {/* Left-aligned beside the mark, not centred: the logo now anchors the
            bar's left edge, and a centred title between it and the avatar reads
            as a third, competing element. */}
        <Text className="flex-1 text-title text-on-surface-header" numberOfLines={1}>
          {titles[pathname] ?? fallback}
        </Text>
        {showAvatar ? (
          <Pressable
            aria-label="Your profile"
            className="min-h-target-adult min-w-11 items-center justify-center active:opacity-80"
            onPress={openSheet}
          >
            <Avatar name={profileName} imageUri={AVATAR_URI} size="sm" />
          </Pressable>
        ) : (
          <View className="min-w-11" />
        )}
      </Header>
    </SafeArea>
  );
}

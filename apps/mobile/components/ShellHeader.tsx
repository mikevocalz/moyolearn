// The app bar for every routed screen — shells AND the root-level routes they
// push into (/settings, /editor-settings, the dev hatch). One component, one
// dialect: `bg-surface-header` with `text-on-surface-header`, one hairline
// border, no decorative accent strip, type tokens for the title. Because the
// fill and its ink are re-pointed together by `RoleScope`, every bar in a
// session is the same door's colour — which is the whole point of routing every
// screen's chrome through this file instead of letting a screen draw its own.
//
// Titles come from the path, not navigation options, for the reason the old
// header documented: a tab layout's options carry the group's name, never the
// focused tab's. Each shell passes its own title map.
//
// LEFT SLOT — brand at a tab root, BACK on a pushed route. A pushed screen
// whose left edge shows the wordmark reads as another tab root, and the only
// way out was the hardware gesture; the chevron is the one place the platform
// (and every comparator) looks for "return". Both variants are 40–44pt inside a
// `min-h-14` row, so the bar is EXACTLY the same height either way — a bar that
// grew or shrank on push would undo the cohesion this file exists to hold.
//
// RIGHT SLOT — the avatar, on every band. It opens the root-mounted
// `AccountSheet` (ADR-106: Profile/You as chrome, never a route push) for every
// role that has one, and FD-24's "Who's here?" switcher for K–2/3–5 learners.
//
// ADR-106 AMENDMENT (2026-09-02): ADR-106's band law read "every shell gets the
// avatar EXCEPT K–2/3–5 learners", and this file implemented it by rendering a
// blank spacer for those two bands. That reading conflated two different things
// — WHO may see the account sheet, and WHETHER the header has a right-hand
// control. The ADR's actual constraint is doc 36 §3.1's "no settings —
// guardian-side only", which is a rule about the sheet's CONTENTS, not about
// the anchor. So: the avatar now renders for every authed band, and the BAND
// PICKS WHAT IT OPENS.
//   · 6–8 / 9–12 learners and every adult role → `AccountSheet` (unchanged).
//   · K–2 / 3–5 learners → the FD-24 `SwitchProfileSheet` ("Who's here?").
// This keeps every ADR-106 guarantee: no setting, plan, billing or sign-out row
// is reachable by a young learner, because the switcher contains none of them —
// it is the family-device hand-off, which ADR-106 §Mechanics itself names as a
// separate mechanism with a separate threat model, and which the learner You
// screen already offers `young` unconditionally. What changes is that a child's
// bar is no longer the only bar in the product with a dead corner, and "this is
// me / how do I hand the tablet to my sister" is answerable from every screen
// rather than only from a You tab that K–2 does not have.
//
// Mobbin: Quizlet titled bar (mobbin.com/screens/d8bb66b8-7bae-4cc3-8241-7aab8e04be5a) ·
// Headway home header (mobbin.com/screens/b7fa7b42-bea8-4d9d-b89f-1042779ffb17) ·
// Duolingo ABC "Who's Learning?" (mobbin.com/screens/9d952a8b-7e1e-43a5-b034-041e84f78c49 —
// child profile switching as a first-class, unlocked affordance)
// SOT: docs/pack/36-role-navigation-flows.md §3.1 §3 §5 ·
//      docs/decisions/adr-106-account-sheet-is-profile-you.md ·
//      docs/38-front-door-and-flow.md §FD-24
// SOT-KEYWORDS: shell header app bar title role accent avatar cool chrome account sheet
//               back button switch profile band young child

import { usePathname } from 'expo-router';
import { SafeArea, Avatar, MoyoLearnLogo } from '@acme/ui';
import { ChevronLeft } from '@acme/ui/icons';
import { Header } from '@acme/ui/primitives';
import { Pressable, Text, View } from '@acme/ui/tw';
import {
  AVATAR_URI,
  useAccountSheet,
  useAppSession,
  useProfile,
  useSwitchProfileSheet,
} from '@acme/app';

/**
 * The wordmark sets the bar's height rather than sitting inside it: at 40pt tall
 * (~111pt wide at the mark's 2.77:1) inside the row's 56pt minimum, the app bar
 * lands on the standard height with 8pt of air above and below. `min-h-14` is
 * what holds that height when the left slot is the 44pt back target instead —
 * change it and the bar starts jumping between a tab root and its detail.
 */
const LOGO_HEIGHT = 40;

export interface ShellHeaderProps {
  titles: Record<string, string>;
  fallback: string;
  /**
   * Native-stack's `back` descriptor, reduced to a boolean by the caller. When
   * true the wordmark yields to a back chevron: the left edge of a pushed
   * screen belongs to "return", not to the brand.
   */
  canGoBack?: boolean;
  onBack?: () => void;
}

export function ShellHeader({ titles, fallback, canGoBack = false, onBack }: ShellHeaderProps) {
  const pathname = usePathname() ?? '/';
  const profileName = useProfile((state) => state.name);
  const { activeContext } = useAppSession();
  const openAccountSheet = useAccountSheet((state) => state.openSheet);
  const openSwitchSheet = useSwitchProfileSheet((state) => state.openSheet);

  // Same band read + teen fallback as the learner tabs layout and the account
  // sheet, so header, tab bar and sheet can never disagree about the band.
  const band = activeContext.gradeBand ?? 'teen';
  const isYoungLearner =
    activeContext.kind === 'learner' && (band === 'young' || band === 'child');
  // Anon has no identity to anchor and no device to hand over — the one state
  // that still renders a spacer.
  const showAvatar = activeContext.kind !== 'anon';
  const onAvatarPress = isYoungLearner ? openSwitchSheet : openAccountSheet;
  const avatarLabel = isYoungLearner ? "You — who's here?" : 'Your profile';

  return (
    <SafeArea edges={['top']} className="bg-surface-header">
      <Header className="min-h-14 flex-row items-center gap-stack border-b-2 border-on-surface-header bg-surface-header px-4 py-1">
        {canGoBack ? (
          <Pressable
            aria-label="Back"
            role="button"
            className="min-h-target-adult min-w-11 items-center justify-center rounded-md active:opacity-70"
            onPress={onBack}
          >
            {/* The chevron takes the bar's ink, not a muted tone: it is the
                screen's primary exit, and the same `on-surface-header` pair the
                title uses is the only ink verified against this fill. */}
            <ChevronLeft size={24} className="text-on-surface-header" />
          </Pressable>
        ) : (
          /*
            The brand sits at the left edge, the same `MoyoLearnLogo` the web
            site header uses — one logo component across both platforms, so the
            mark can never drift between them.
          */
          /* Air on the mark's left, and 30pt between it and the title: at the
             bar's full height the wordmark otherwise sits flush to the edge and
             hard against the title beside it. */
          <View className="pl-1 pr-brand-clear">
            {/* ALWAYS the full-colour mark. The logo's inks are fixed brand
                property — no scheme, surface, or contrast problem is solved by
                recolouring it. If the mark does not read on a bar, the BAR is
                wrong; change the chrome behind it, never the logo. */}
            <MoyoLearnLogo height={LOGO_HEIGHT} accessibilityLabel="Moyo Learn" />
          </View>
        )}
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
        <Text className="flex-1 text-title-lg font-bold text-on-surface-header" numberOfLines={1}>
          {titles[pathname] ?? fallback}
        </Text>
        {showAvatar ? (
          <Pressable
            aria-label={avatarLabel}
            role="button"
            className="min-h-target-adult min-w-11 items-center justify-center active:opacity-80"
            onPress={onAvatarPress}
          >
            {/* `md` (44), not `sm` (32): the bar is 56 tall with a 40pt wordmark
                opposite, and a 32 avatar read as an afterthought beside it. 44
                also means the mark IS the target rather than a small mark
                floating inside a larger invisible one. */}
            <Avatar name={profileName} imageUri={AVATAR_URI} size="md" />
          </Pressable>
        ) : (
          <View className="min-w-11" />
        )}
      </Header>
    </SafeArea>
  );
}

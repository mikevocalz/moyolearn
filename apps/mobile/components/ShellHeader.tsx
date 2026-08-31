// The app bar for every shell route. Adapted from the retired drawer-era
// AppHeader: same primary field + ink border chrome, minus the drawer's
// MenuButton (shells navigate by tabs, doc 36 §3 — there is no drawer to open).
//
// Titles come from the path, not navigation options, for the reason the old
// header documented: a tab layout's options carry the group's name, never the
// focused tab's. Each shell passes its own title map.
//
// The 1px strip under the border consumes `bg-role-accent` BY NAME — doc 36
// §5's allowlist slot "shell header underline". Inert until PR-141 mints the
// token; the ink border carries the edge meanwhile.
//
// Mobbin: Quizlet titled bar (mobbin.com/screens/d8bb66b8-7bae-4cc3-8241-7aab8e04be5a) ·
// Headway home header (mobbin.com/screens/b7fa7b42-bea8-4d9d-b89f-1042779ffb17)
// SOT: docs/pack/36-role-navigation-flows.md §3 §5
// SOT-KEYWORDS: shell header app bar title role accent underline avatar

import { usePathname, useRouter, type Href } from 'expo-router';
import { SafeArea, Avatar } from '@acme/ui';
import { Header } from '@acme/ui/primitives';
import { Pressable, Text, View } from '@acme/ui/tw';
import { AVATAR_URI, useProfile } from '@acme/app';

export interface ShellHeaderProps {
  titles: Record<string, string>;
  fallback: string;
  /** Where the avatar leads — each shell's You/Profile surface. Omit to hide it. */
  profileHref?: Href;
}

export function ShellHeader({ titles, fallback, profileHref }: ShellHeaderProps) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const profileName = useProfile((state) => state.name);

  return (
    <SafeArea edges={['top']} className="bg-surface-header">
      <Header className="flex-row items-center gap-stack border-b-2 border-border bg-surface-header px-4 py-3">
        <Text className="flex-1 text-lg font-semibold text-on-header md:text-xl">
          {titles[pathname] ?? fallback}
        </Text>
        {profileHref ? (
          <Pressable
            aria-label="Your profile"
            className="min-h-target-adult min-w-11 items-center justify-center"
            onPress={() => router.push(profileHref)}
          >
            <Avatar name={profileName} imageUri={AVATAR_URI} size="sm" />
          </Pressable>
        ) : null}
      </Header>
      <View className="h-1 bg-surface-accent" />
    </SafeArea>
  );
}

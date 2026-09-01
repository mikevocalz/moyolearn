// The app bar for every shell route. Uses the Cool chrome dialect: one hairline
// border, no decorative accent strip, type tokens for the title, and a tabular
// center layout that keeps the title readable whether the avatar is shown.
//
// Titles come from the path, not navigation options, for the reason the old
// header documented: a tab layout's options carry the group's name, never the
// focused tab's. Each shell passes its own title map.
//
// Mobbin: Quizlet titled bar (mobbin.com/screens/d8bb66b8-7bae-4cc3-8241-7aab8e04be5a) ·
// Headway home header (mobbin.com/screens/b7fa7b42-bea8-4d9d-b89f-1042779ffb17)
// SOT: docs/pack/36-role-navigation-flows.md §3 §5
// SOT-KEYWORDS: shell header app bar title role accent avatar cool chrome

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
      <Header className="dial-cool flex-row items-center gap-stack border-b border-border bg-surface-header px-4 py-3">
        <View className="min-w-11" />
        <Text className="flex-1 text-center text-title text-on-header">
          {titles[pathname] ?? fallback}
        </Text>
        {profileHref ? (
          <Pressable
            aria-label="Your profile"
            className="min-h-target-adult min-w-11 items-center justify-center active:opacity-80"
            onPress={() => router.push(profileHref)}
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

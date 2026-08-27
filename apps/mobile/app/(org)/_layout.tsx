import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The org-staff companion shell (doc 36 §3.4 — web-first; mobile carries the
 * day's operations). The §3.4 Safety tab is deliberately absent until a mobile
 * incident-queue surface exists: a tab that points at nothing would fake the
 * IA (route-audit-36.md records the gap).
 */
export default function OrgShell() {
  const { activeContext } = useAppSession();
  const isOwner = activeContext.kind === 'owner';

  return (
    <RoleScope role="org" className="flex-1">
    <Stack
      screenOptions={{
        header: () => <ShellHeader titles={{}} fallback="Moyo Ops" />,
      }}
    >
      <Stack.Protected guard={isOwner}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
    </RoleScope>
  );
}

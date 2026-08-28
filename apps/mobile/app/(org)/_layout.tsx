import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The org-staff companion shell (doc 36 §3.4 — web-first; mobile carries the
 * day's operations). All four §3.4 tabs are real: the Safety tab was held back
 * until an incident-queue surface existed rather than pointed at Inbox, and
 * `SafetyQueueScreen` is that surface (route-audit-36.md recorded the gap).
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

import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The guardian shell (doc 36 §3.2). Everything sits inside the guard — S27's
 * erasure controls act on one child's record, so an unguarded route here is a
 * deep link into another family's model (doc 07 §4). Role-mismatched links fall
 * to +not-found and die silently (§4.4).
 */
const TITLES: Record<string, string> = {
  '/memory': 'Memory & Data',
  '/ai-activity': 'AI Activity',
  '/calendar': 'Calendar',
};

export default function GuardianShell() {
  const { activeContext } = useAppSession();
  const isGuardian = activeContext.kind === 'guardian';

  return (
    <RoleScope role="guardian" className="flex-1">
    <Stack
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Moyo" />,
      }}
    >
      <Stack.Protected guard={isGuardian}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="memory" />
        <Stack.Screen name="ai-activity" />
        {/* A stack route, not a tab — ADR-101 keeps calendar one push away
            from Home/Family so Reports and Alerts hold the tab slots. */}
        <Stack.Screen name="calendar" />
        <Stack.Screen name="reports/[sessionId]" options={{ title: 'Report' }} />
      </Stack.Protected>
    </Stack>
    </RoleScope>
  );
}

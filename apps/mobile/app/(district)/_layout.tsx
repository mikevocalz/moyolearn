import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The district route group — parked, not a shell. Doc 36 §3.5 makes district
 * web-only ("IA now, build later") and ADR-104
 * (docs/decisions/adr-104-district-mobile-retirement.md) retires the mobile
 * tab bar: zero tab routes ship, and the group survives only so an authed
 * district admin lands on a guarded Overview screen instead of being stranded.
 * The real district IA lives exclusively in the web rail; any future district
 * mobile surface is a new ADR with Phase-3 evidence behind it.
 */
const TITLES: Record<string, string> = {
  '/district-home': 'Overview',
};

export default function DistrictShell() {
  const { activeContext } = useAppSession();
  const isDistrictAdmin = activeContext.kind === 'district_admin';

  return (
    <RoleScope role="district" className="flex-1">
      <Stack
        screenOptions={{
          header: () => <ShellHeader titles={TITLES} fallback="Moyo" />,
        }}
      >
        <Stack.Protected guard={isDistrictAdmin}>
          <Stack.Screen name="district-home" options={{ title: 'Overview' }} />
        </Stack.Protected>
      </Stack>
    </RoleScope>
  );
}

import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The district-admin shell (doc 36 §3.4). A district administrator sees all
 * schools and programs; the tree is guarded so only the `district_admin` role
 * can land.
 */
export default function DistrictShell() {
  const { activeContext } = useAppSession();
  const isDistrictAdmin = activeContext.kind === 'district_admin';

  return (
    <RoleScope role="district" className="flex-1">
      <Stack
        screenOptions={{
          header: () => <ShellHeader titles={{}} fallback="Moyo" />,
        }}
      >
        <Stack.Protected guard={isDistrictAdmin}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </RoleScope>
  );
}

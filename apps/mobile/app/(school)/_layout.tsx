import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The school-admin shell (doc 36 §3.4). A school administrator sees campus and
 * program data; the tree is guarded so only the `school_admin` role can land.
 */
export default function SchoolShell() {
  const { activeContext } = useAppSession();
  const isSchoolAdmin = activeContext.kind === 'school_admin';

  return (
    <RoleScope role="school" className="flex-1">
      <Stack
        screenOptions={{
          header: () => <ShellHeader titles={{}} fallback="Moyo" />,
        }}
      >
        <Stack.Protected guard={isSchoolAdmin}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </RoleScope>
  );
}

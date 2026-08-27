import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The tutor/educator shell (doc 36 §3.3). `teacher` shares it — the educator IA
 * is one shell; the school-teacher share-link viewer is a tokened page with no
 * shell at all. Session-prep reads derived observations about a learner, so the
 * whole tree is guarded.
 */
export default function TutorShell() {
  const { activeContext } = useAppSession();
  const isEducator = activeContext.kind === 'tutor' || activeContext.kind === 'teacher';

  return (
    <RoleScope role="tutor" className="flex-1">
    <Stack
      screenOptions={{
        header: () => <ShellHeader titles={{}} fallback="Moyo" />,
      }}
    >
      <Stack.Protected guard={isEducator}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
    </RoleScope>
  );
}

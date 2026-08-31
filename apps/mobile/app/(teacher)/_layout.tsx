import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The teacher shell (doc 36 §3.3). It is now a separate tree from the tutor
 * shell because the classroom-teacher IA needs its own tabs and guards. The
 * whole tree is wrapped in `RoleScope` so the accent underlay is the teacher
 * door hue.
 */
export default function TeacherShell() {
  const { activeContext } = useAppSession();
  const isTeacher = activeContext.kind === 'teacher';

  return (
    <RoleScope role="teacher" className="flex-1">
      <Stack
        screenOptions={{
          header: () => <ShellHeader titles={{}} fallback="Moyo" />,
        }}
      >
        <Stack.Protected guard={isTeacher}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </RoleScope>
  );
}

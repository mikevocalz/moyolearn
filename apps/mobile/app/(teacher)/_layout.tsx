import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The teacher shell. Doc 36 §3.3 gives teachers only a tokened read-only share
 * page; this shell's authority is doc 37 §2's PR-145 amendment plus ADR-102
 * (docs/decisions/adr-102-teacher-shell-ia.md). It is a separate tree from the
 * tutor shell because the classroom-teacher IA needs its own tabs and guards,
 * and the whole tree is wrapped in `RoleScope` so the accent underlay is the
 * teacher door hue.
 */
const TITLES: Record<string, string> = {
  '/conference': 'Conferences',
};

export default function TeacherShell() {
  const { activeContext } = useAppSession();
  const isTeacher = activeContext.kind === 'teacher';

  return (
    <RoleScope role="teacher" className="flex-1">
      <Stack
        screenOptions={{
          header: ({ navigation, back }) => (
            <ShellHeader
              titles={TITLES}
              fallback="Moyo"
              /* `back` is defined only on a pushed route, so the wordmark
                 yields to the chevron exactly where the platform expects an
                 exit — never on a tab root. */
              canGoBack={back !== undefined}
              onBack={navigation.goBack}
            />
          ),
        }}
      >
        <Stack.Protected guard={isTeacher}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* A stack route, not a tab — ADR-102 demotes Conferences out of the
              tab set (it does not outrank FD-23's class/assignment loop);
              reachable from Home, keeps its screen. */}
          <Stack.Screen name="conference" options={{ title: 'Conferences' }} />
          {/* teacher.classes details — the Classes tab's collapsed-width drill
              routes; on expanded widths the pane host renders them in place. */}
          <Stack.Screen name="classes/[classId]" options={{ title: 'Class' }} />
          <Stack.Screen name="students/[studentId]" options={{ title: 'Student' }} />
          {/* teacher.assign — the Assign tab's stack routes: create form (the
              classes drill idiom; drafts persist in assign.store, so backing
              out keeps them) and one assignment's status + lifecycle. */}
          <Stack.Screen name="assign/new" options={{ title: 'New assignment' }} />
          <Stack.Screen name="assign/[assignmentId]" options={{ title: 'Assignment' }} />
        </Stack.Protected>
      </Stack>
    </RoleScope>
  );
}

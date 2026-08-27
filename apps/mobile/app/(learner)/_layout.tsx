import { Stack } from 'expo-router';
import { useAppSession } from '@acme/app';
import { RoleScope } from '@acme/ui';
import { ShellHeader } from '../../components/ShellHeader';

/**
 * The learner shell — its own navigator tree (doc 36 §2). Every screen sits
 * inside the guard: under `Stack.Protected` semantics a guarded route is not
 * merely hidden — it is unreachable by deep link and purged from history when
 * the role flips, which is what makes §4.4's silent drop work: a guardian
 * incident link opened on this shell matches nothing, falls to +not-found, and
 * dies without a permission toast at a child.
 */
const TITLES: Record<string, string> = {
  '/tutor': 'Natalie',
  '/plan': 'My Plan',
};

export default function LearnerShell() {
  const { activeContext } = useAppSession();
  const isLearner = activeContext.kind === 'learner';

  return (
    <RoleScope role="learner" className="flex-1">
    <Stack
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Moyo" />,
      }}
    >
      <Stack.Protected guard={isLearner}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* The live session draws its own SessionToolbar — a lesson is a
            bounded place, not a chromed page (doc 07). */}
        <Stack.Screen name="tutor" options={{ headerShown: false }} />
        <Stack.Screen name="plan" />
      </Stack.Protected>
    </Stack>
    </RoleScope>
  );
}

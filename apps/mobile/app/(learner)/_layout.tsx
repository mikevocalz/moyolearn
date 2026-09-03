import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { preloadNatalie, useAppSession } from '@acme/app';
import { Dial, RoleScope } from '@acme/ui';
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

  /*
    SHE IS PARSED BEFORE SHE IS ASKED FOR (ADR-114). The tutor screen is one
    tap from every learner tab, and the body's fetch + parse + texture decode
    is the JS-thread cost that used to sit between that tap and her first
    frame. Started here, once, the moment a learner enters the shell; a no-op
    with the 3D flag off.
  */
  useEffect(() => {
    if (isLearner) preloadNatalie();
  }, [isLearner]);

  /*
    THE HOT DIAL, which this shell had never switched on.

    `<Dial>` defaults to Cool by design (doc 02 Addendum A.3 — a surface opts
    INTO warmth), and doc 02 §5.3 assigns Hot to learner and family surfaces and
    Cool to ops. Nothing in the learner tree ever opted in, so every child screen
    rendered at OPS density: body 15px instead of 17, label 13 instead of 15,
    caption 12 instead of 13, plus the tighter insets and radii. The band system
    exists precisely so a young learner gets larger type, and it was inert here —
    the same shape as the `text-on-header` bug, a mechanism that reads correctly
    and reaches nothing.

    It wraps the whole shell rather than the content, so the tab bar and rail
    labels scale with it too; the chrome tokens cascade the same way `RoleScope`
    already does.
  */
  return (
    <RoleScope role="learner" className="flex-1">
    <Dial temperature="hot" className="flex-1">
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
      <Stack.Protected guard={isLearner}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* The live session draws its own SessionToolbar — a lesson is a
            bounded place, not a chromed page (doc 07). */}
        <Stack.Screen name="tutor" options={{ headerShown: false }} />
        <Stack.Screen name="plan" />
      </Stack.Protected>
    </Stack>
    </Dial>
    </RoleScope>
  );
}

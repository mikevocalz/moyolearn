import { Drawer } from 'expo-router/drawer';
import { useColorScheme } from 'react-native';
import { palette } from '@acme/theme';
import { useAppSession } from '@acme/app';
import { DrawerContent } from '../../components/DrawerContent';
import { AppHeader } from '../../components/AppHeader';
import { horizontalGesturesEnabled } from '@/src/navigation/split-view/pane-search';
import { usePaneSearchStore } from '@/src/navigation/split-view/pane-search.store';

export default function DrawerLayout() {
  const isDark = useColorScheme() === 'dark';
  /**
   * The drawer's edge swipe and a focused search field want the same gesture: a
   * horizontal drag near the leading edge is also how you move the caret or
   * select text. The field wins while it holds focus — it is the surface the
   * user is actively working in. Generalised from the reference's
   * `use-drawer-enabled`, which disabled the drawer on search focus.
   */
  const searches = usePaneSearchStore((state) => state.panes);
  const swipeEnabled = horizontalGesturesEnabled(Object.values(searches));

  /**
   * The guard tree ships in Wave 2 against the mock session (doc 09 §2 rule 4).
   * Under `Stack.Protected` semantics an unguarded route is not merely hidden —
   * it is unreachable by deep link and purged from history when the persona
   * flips, so the Wave-3 auth swap changes zero navigation code.
   */
  const { activeContext } = useAppSession();
  const isLearner = activeContext.kind === 'learner';
  const isStaff =
    activeContext.kind === 'tutor' ||
    activeContext.kind === 'teacher' ||
    activeContext.kind === 'owner';

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        // Every drawer route gets the app bar. The split route opts out below:
        // it fills the screen and draws its own header inside its safe area.
        header: () => <AppHeader />,
        drawerType: 'front',
        drawerStyle: {
          width: 270,
          backgroundColor: isDark ? palette.ink[900] : palette.ink[50],
        },
        overlayColor: 'rgba(0,0,0,0.6)',
        swipeEnabled,
        swipeEdgeWidth: 40,
      }}
    >
      <Drawer.Screen name="split" options={{ headerShown: false }} />

      {/* Learner-only: capture and the tutor stage are child surfaces. */}
      <Drawer.Protected guard={isLearner}>
        <Drawer.Screen name="capture/index" />
        <Drawer.Screen name="tutor" />
        <Drawer.Screen name="plan" />
      </Drawer.Protected>

      {/* Staff-only: prep reads derived observations about a learner. */}
      <Drawer.Protected guard={isStaff}>
        <Drawer.Screen name="session-prep" />
      </Drawer.Protected>
    </Drawer>
  );
}

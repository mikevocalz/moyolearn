/**
 * apps/mobile/components/ShellDrawerLayout.tsx
 *
 * The navigator-level overflow drawer that wraps a shell's (tabs) group —
 * `expo-router` `Drawer`, mounted at `(role)/(drawer)/_layout`, sliding in
 * from the LEFT over the scene. It lists the shell's OFF-RAIL destinations:
 * the group-level Stack routes (memory, ai-activity, calendar, conference…),
 * not the rail's primary items, and only exists where such routes exist —
 * which is why the learner shell has none: its hidden tabs are a band SAFETY
 * gate (doc 36 §3.1), not overflow, and a drawer listing them would be a
 * steering path the gate exists to remove.
 *
 * `swipeEnabled: false` — a left-edge pan is Android's own back gesture; the
 * drawer must not fight it, so the rail's footer menu button is the only
 * opener. `drawerType: 'front'` slides the panel over the scene, the same
 * behaviour the web shell's mobile drawer has.
 *
 * SOT-KEYWORDS: drawer overflow rail menu navigation extras stack-routes
 */
import { Drawer } from 'expo-router/drawer';
import { navChrome, palette } from '@acme/theme';
import { ShellDrawerContent, type ShellTabItem } from './ShellTabBar';

/* The expanded-rail width — the drawer's content column matches the rail it
   is the overflow of, so it reads as the rail opened, not a new surface. */
const DRAWER_WIDTH = parseInt(navChrome.railExpanded, 10);

export function ShellDrawerLayout({ items }: { items: ShellTabItem[] }) {
  return (
    <Drawer
      screenOptions={{
        headerShown: false,
        drawerPosition: 'left',
        drawerType: 'front',
        swipeEnabled: false,
        overlayColor: `${palette.ink[950]}80`,
        drawerStyle: { width: DRAWER_WIDTH },
      }}
      drawerContent={(props) => <ShellDrawerContent {...props} items={items} />}
    >
      <Drawer.Screen name="(tabs)" />
    </Drawer>
  );
}

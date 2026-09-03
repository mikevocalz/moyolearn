import { Tabs } from 'expo-router';
import { Camera, Compass, Home, Star, TrendingUp, User } from '@acme/ui/icons';
import { useAppSession } from '@acme/app';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, useShellTabBarPosition, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * The band-adaptive learner tab bar — doc 36 §3.1's exact table. The band comes
 * from the session's learner context (grade band is already a Safety Plane
 * input), never from a setting a child could flip:
 *
 *   K–2   ('young')  3 destinations, hub-and-spoke: Today · Snap · My Stuff
 *   3–5   ('child')  4 tabs: Today · Subjects · Snap · Me
 *   6–8   ('teen')   5 tabs: Home · Subjects · Snap · Progress · You
 *   9–12  ('adult')  5 tabs, same IA as 6–8
 *
 * The camera holds the raised center slot on EVERY band — the product's
 * signature action (Speechify pattern, doc 36 §1). Labels are always visible
 * (§4.1) and item height scales from the band's target token, so a K–2 tap
 * target clears NN/g's 2cm where a teen gets 48.
 */
type Band = 'young' | 'child' | 'teen' | 'adult';

const ITEMS = {
  today: (label: string): ShellTabItem => ({ name: 'today', label, Icon: Home }),
  subjects: (): ShellTabItem => ({ name: 'subjects', label: 'Subjects', Icon: Compass }),
  capture: (): ShellTabItem => ({ name: 'capture', label: 'Snap', Icon: Camera, raised: true }),
  progress: (): ShellTabItem => ({ name: 'progress', label: 'Progress', Icon: TrendingUp }),
  stuff: (): ShellTabItem => ({ name: 'stuff', label: 'My Stuff', Icon: Star }),
  you: (label: string): ShellTabItem => ({ name: 'you', label, Icon: User }),
} as const;

const BAND_ITEMS: Record<Band, ShellTabItem[]> = {
  young: [ITEMS.today('Today'), ITEMS.capture(), ITEMS.stuff()],
  child: [ITEMS.today('Today'), ITEMS.subjects(), ITEMS.capture(), ITEMS.you('Me')],
  teen: [ITEMS.today('Home'), ITEMS.subjects(), ITEMS.capture(), ITEMS.progress(), ITEMS.you('You')],
  adult: [ITEMS.today('Home'), ITEMS.subjects(), ITEMS.capture(), ITEMS.progress(), ITEMS.you('You')],
};

const BAND_TARGET: Record<Band, string> = {
  young: 'min-h-target-young',
  child: 'min-h-target-child',
  teen: 'min-h-target-teen',
  adult: 'min-h-target-teen',
};

/**
 * The raised Snap slab's FLOOR per band, as a min-h/min-w pair. Only K–2
 * actually moves the slab (72 > its 64 base) — which is the band the NN/g 2cm
 * finding is about. The rest are declared anyway so the slab can never be
 * shipped without a band floor, and so raising a band token later takes effect
 * here instead of silently not applying.
 */
const BAND_RAISED_TARGET: Record<Band, string> = {
  young: 'min-h-target-young min-w-target-young',
  child: 'min-h-target-child min-w-target-child',
  teen: 'min-h-target-teen min-w-target-teen',
  adult: 'min-h-target-teen min-w-target-teen',
};

const TITLES: Record<string, string> = {
  '/today': 'Today',
  '/subjects': 'Subjects',
  '/capture': 'Snap',
  '/progress': 'Progress',
  '/stuff': 'My Stuff',
  '/you': 'You',
};

export default function LearnerTabs() {
  const { activeContext } = useAppSession();
  const band: Band = activeContext.gradeBand ?? 'teen';
  const tabBarPosition = useShellTabBarPosition();
  const items = BAND_ITEMS[band];
  const visible = new Set(items.map((item) => item.name));

  return (
    <Tabs
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Today" />,
        // Doc 02 §2.1: bottom nav under 600dp, rail from 600 up. The navigator
        // turns its own container to `flexDirection: 'row'` for `right`, so the
        // rail is a real flex sibling of the scene — no overlay, no scene inset.
        tabBarPosition,
      }}
      tabBar={(props) => (
        <ShellTabBar
          {...props}
          items={items}
          targetClass={BAND_TARGET[band]}
          raisedTargetClass={BAND_RAISED_TARGET[band]}
        />
      )}
    >
      {/* Off-band destinations lose their deep link too (`href: null`), so a
          K–2 device cannot be steered into Subjects or Progress by a URL. */}
      <Tabs.Screen name="today" options={{ title: 'Today' }} />
      <Tabs.Screen name="subjects" options={{ title: 'Subjects', href: visible.has('subjects') ? undefined : null }} />
      <Tabs.Screen name="capture" options={{ title: 'Snap', headerShown: false }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress', href: visible.has('progress') ? undefined : null }} />
      <Tabs.Screen name="stuff" options={{ title: 'My Stuff', href: visible.has('stuff') ? undefined : null }} />
      <Tabs.Screen name="you" options={{ title: 'You', href: visible.has('you') ? undefined : null }} />
    </Tabs>
  );
}

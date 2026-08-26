import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardShell, type NavGroup, type SidebarMode } from './DashboardShell';
import { BrandLockup } from './BrandLockup';
import { useInstanceStore, useStore } from './use-instance-store';
import { Button } from './Button';
import { StatCard } from './StatCard';
import { Text, View } from './primitives';

const Glyph = ({ char }: { char: string }) => (
  <Text aria-hidden className="text-label text-text-muted">
    {char}
  </Text>
);

const GROUPS: NavGroup[] = [
  {
    items: [
      { id: 'today', label: 'Today', icon: <Glyph char="◎" />, onPress: () => {}, active: true },
      { id: 'calendar', label: 'Calendar', icon: <Glyph char="▦" />, onPress: () => {} },
    ],
  },
  {
    title: 'Pipeline',
    items: [
      { id: 'leads', label: 'Leads', icon: <Glyph char="◇" />, onPress: () => {}, badge: 12 },
      { id: 'families', label: 'Families', icon: <Glyph char="◈" />, onPress: () => {} },
      { id: 'enrolments', label: 'Enrolments', icon: <Glyph char="▤" />, onPress: () => {} },
    ],
  },
  {
    title: 'Money',
    items: [
      { id: 'invoices', label: 'Invoices', icon: <Glyph char="▧" />, onPress: () => {}, badge: 3 },
      { id: 'payroll', label: 'Payroll', icon: <Glyph char="▨" />, onPress: () => {} },
    ],
  },
];


/** Sidebar mode and menu state are durable view prefs, so they live in a store —
 *  never React state (repo rule). A real screen swaps this for the app store. */
function Demo({ startMode = 'auto' as SidebarMode }: { startMode?: SidebarMode }) {
  const store = useInstanceStore(() => ({ mode: startMode, menuOpen: false }));
  const { mode, menuOpen } = useStore(store, (s) => s);

  return (
    <DashboardShell
      groups={GROUPS}
      brand={<BrandLockup orgName="Riverside Unified" />}
      brandMark={<BrandLockup variant="partner" />}
      mode={mode}
      onSetMode={(next) => store.setState((s) => ({ ...s, mode: next }))}
      menuOpen={menuOpen}
      onToggleMenu={() => store.setState((s) => ({ ...s, menuOpen: !s.menuOpen }))}
      topBarStart={<Text className="text-label text-text-muted">Riverside Tutoring</Text>}
      topBarEnd={<Button title="Add lead" size="sm" />}
    >
      <View className="gap-group p-inset">
        <Text className="text-title-lg font-semibold text-text">Today</Text>
        {/* `items-stretch` + `flex-1`: without it the card carrying a trend chip
            grows taller than its neighbours and the strip reads as a mistake. */}
        <View className="flex-row flex-wrap items-stretch gap-stack">
          <StatCard className="min-w-48 flex-1" size="lg" value="14" label="Sessions today" />
          <StatCard
            className="min-w-48 flex-1"
            size="lg"
            value="3"
            label="Trials to confirm"
            trend="+2 vs last week"
            trendDirection="up"
          />
          <StatCard className="min-w-48 flex-1" size="lg" value="$4,210" label="Invoiced this month" />
        </View>
      </View>
    </DashboardShell>
  );
}

const meta: Meta = { title: 'UI/DashboardShell' };
export default meta;
type Story = StoryObj;

/** The shipped default: rail on a tablet, menu on a desktop. Resize to see it. */
export const Auto: Story = { render: () => <Demo /> };

/** The user having chosen the menu — it then holds at tablet width too. */
export const Menu: Story = { render: () => <Demo startMode="menu" /> };

/** The user having chosen the rail. It keeps a label under each icon: a bare
 *  icon rail costs a hover-and-wait on every navigation. */
export const Rail: Story = { render: () => <Demo startMode="rail" /> };

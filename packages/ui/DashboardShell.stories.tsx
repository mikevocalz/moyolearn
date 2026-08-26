import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardShell, type NavGroup } from './DashboardShell';
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

const Brand = () => (
  <View className="flex-row items-center gap-element">
    <View className="h-8 w-8 items-center justify-center rounded-control border-2 border-border-strong bg-primary">
      <Text className="font-display text-label text-on-primary">M</Text>
    </View>
    <Text className="font-display text-title text-text">Moyo</Text>
  </View>
);

const BrandMark = () => (
  <View className="h-8 w-8 items-center justify-center rounded-control border-2 border-border-strong bg-primary">
    <Text className="font-display text-label text-on-primary">M</Text>
  </View>
);

/** Collapse and menu state are durable view prefs, so they live in a store —
 *  never React state (repo rule). A real screen swaps this for the app store. */
function Demo({ startCollapsed = false }: { startCollapsed?: boolean }) {
  const store = useInstanceStore(() => ({ collapsed: startCollapsed, menuOpen: false }));
  const { collapsed, menuOpen } = useStore(store, (s) => s);

  return (
    <DashboardShell
      groups={GROUPS}
      brand={<Brand />}
      brandMark={<BrandMark />}
      collapsed={collapsed}
      onToggleCollapsed={() => store.setState((s) => ({ ...s, collapsed: !s.collapsed }))}
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

export const Expanded: Story = { render: () => <Demo /> };

/** Collapsed keeps a label under each icon — a bare rail costs a hover-and-wait
 *  on every navigation. */
export const Collapsed: Story = { render: () => <Demo startCollapsed /> };

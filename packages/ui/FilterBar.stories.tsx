import type { Meta, StoryObj } from '@storybook/react-vite';
import { create } from 'zustand';
import { FilterBar } from './FilterBar';
import { SearchBar } from './SearchBar';
import { SegmentedControl } from './SegmentedControl';
import { Select } from './Select';
import { Menu } from './Menu';
import { Badge } from './Badge';
import { Text } from './Text';
import { View } from './primitives';

const meta = {
  title: 'UI/FilterBar',
  component: FilterBar,
  args: { children: null },
} satisfies Meta<typeof FilterBar>;
export default meta;
type Story = StoryObj<typeof meta>;

type Severity = 'all' | 'high' | 'medium' | 'low';
const SEVERITIES = [
  { value: 'all', label: 'All' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const;

// Story state — zustand always (repo rule). In product the owner is the
// screen's store (mobile) or URL search params (web); FilterBar only renders
// values and emits changes.
const useFilterStory = create<{
  query: string;
  severity: Severity;
  lifecycle: string;
  setQuery: (query: string) => void;
  setSeverity: (severity: Severity) => void;
  setLifecycle: (lifecycle: string) => void;
  clear: () => void;
}>((set) => ({
  query: '',
  severity: 'all',
  lifecycle: 'open',
  setQuery: (query) => set({ query }),
  setSeverity: (severity) => set({ severity }),
  setLifecycle: (lifecycle) => set({ lifecycle }),
  clear: () => set({ query: '', severity: 'all', lifecycle: '' }),
}));

export const Empty: Story = {
  render: () => (
    <FilterBar>
      <SegmentedControl options={SEVERITIES} value="all" onChange={() => {}} />
    </FilterBar>
  ),
};

export const Active: Story = {
  render: function Render() {
    const st = useFilterStory();
    const activeCount =
      (st.query ? 1 : 0) + (st.severity !== 'all' ? 1 : 0) + (st.lifecycle ? 1 : 0);
    return (
      <View className="gap-stack">
        <FilterBar
          search={
            <SearchBar
              value={st.query}
              onChangeText={st.setQuery}
              placeholder="Search incidents…"
            />
          }
          activeCount={activeCount}
          onClearAll={st.clear}
        >
          <SegmentedControl options={SEVERITIES} value={st.severity} onChange={st.setSeverity} />
        </FilterBar>
        <Text tone="muted" variant="caption" className="px-4">
          The bar owns no state — this story&rsquo;s zustand store does.
        </Text>
      </View>
    );
  },
};

// One of each control kind the contracts name: SearchBar slot, SegmentedControl,
// Select, and a Menu-anchored chip.
export const EachControlKind: Story = {
  render: function Render() {
    const st = useFilterStory();
    return (
      <FilterBar
        search={<SearchBar value={st.query} onChangeText={st.setQuery} placeholder="Search…" />}
        activeCount={2}
        onClearAll={st.clear}
      >
        <SegmentedControl options={SEVERITIES} value={st.severity} onChange={st.setSeverity} />
        <Select
          label="Lifecycle"
          containerClassName="min-w-40"
          value={st.lifecycle}
          onValueChange={st.setLifecycle}
        >
          <option value="">Any</option>
          <option value="open">Open</option>
          <option value="reviewing">Reviewing</option>
          <option value="closed">Closed</option>
        </Select>
        <Menu
          title="Sort"
          actions={[
            { id: 'newest', title: 'Newest first' },
            { id: 'oldest', title: 'Oldest first' },
            { id: 'severity', title: 'By severity' },
          ]}
          onAction={() => {}}
        >
          <Badge tone="neutral" label="Sort ⌄" />
        </Menu>
      </FilterBar>
    );
  },
};

const MANY_SEGMENTS = (
  <>
    <SegmentedControl options={SEVERITIES} value="high" onChange={() => {}} />
    <SegmentedControl
      options={[
        { value: 'open', label: 'Open' },
        { value: 'reviewing', label: 'Reviewing' },
        { value: 'escalated', label: 'Escalated' },
        { value: 'closed', label: 'Closed' },
      ]}
      value="open"
      onChange={() => {}}
    />
    <SegmentedControl
      options={[
        { value: 'math', label: 'Math' },
        { value: 'reading', label: 'Reading' },
        { value: 'science', label: 'Science' },
        { value: 'writing', label: 'Writing' },
      ]}
      value="math"
      onChange={() => {}}
    />
  </>
);

// More controls than the row can hold: default behavior is a horizontal scroll
// region — the bar keeps one height.
export const Overflowing: Story = {
  render: () => (
    <View className="max-w-content-form">
      <FilterBar activeCount={3} onClearAll={() => {}}>{MANY_SEGMENTS}</FilterBar>
    </View>
  ),
};

// The alternative overflow: chips reflow onto new lines and the bar grows.
export const Wrapping: Story = {
  render: () => (
    <View className="max-w-content-form">
      <FilterBar overflow="wrap" activeCount={3} onClearAll={() => {}}>{MANY_SEGMENTS}</FilterBar>
    </View>
  ),
};

export const Compact: Story = {
  render: () => (
    <FilterBar density="compact" activeCount={1} onClearAll={() => {}}>
      <SegmentedControl options={SEVERITIES} value="high" onChange={() => {}} />
    </FilterBar>
  ),
};

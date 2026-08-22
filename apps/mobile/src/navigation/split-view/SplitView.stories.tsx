// The two-pane composition, with a detail pane that closes.
// SOT-KEYWORDS: splitview split view pane detail close dismiss collapsible stories
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Pressable, Text, View } from '@acme/ui/tw';
import { CollapsiblePane } from './CollapsiblePane';
import { DetailNavbar } from './DetailNavbar';
import { PANE_WIDTH_DP } from './pane-widths';
import { useWindowSizeClass } from './use-window-size-class';

/*
  The `SplitView` host itself is NOT storyable: on iOS it re-exports
  expo-router/unstable-split-view (a native component) and the Android
  implementation renders an expo-router <Slot>, so both need a router context
  Storybook has no way to provide.

  What is storyable is the composition those hosts arrange — CollapsiblePane
  for the leading column and DetailNavbar for the detail column's close
  affordance — which is where the behaviour worth reviewing actually lives.
*/
const meta = { title: 'Interaction/SplitView' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

// The shipped pane width, not a story guess.
const PRIMARY_WIDTH = PANE_WIDTH_DP.primary;

const ROWS = [
  { id: '1', title: 'Amina O.', subtitle: 'Fractions · 09:00', body: 'Confident on eighths. Asked to try tenths next.' },
  { id: '2', title: 'Daniel K.', subtitle: 'Long division · 10:00', body: 'Close on the estimate step; remainders still slip.' },
  { id: '3', title: 'Priya R.', subtitle: 'Place value · 11:15', body: 'Finished the set early. Ready to move on.' },
];

function ListRow({
  row,
  selected,
  onPress,
}: {
  row: (typeof ROWS)[number];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-target-adult gap-element border-b border-border/30 p-inset ${
        selected ? 'bg-highlighter/20' : ''
      }`}
    >
      <Text className="text-label text-text">{row.title}</Text>
      <Text className="text-caption text-text-muted">{row.subtitle}</Text>
    </Pressable>
  );
}

/**
 * Selecting a row fills the detail column; closing it collapses the detail and
 * gives the width back to the list. The leading pane animates its WIDTH rather
 * than translating, so neighbours reflow continuously instead of leaving a
 * blank strip — the reason CollapsiblePane exists.
 */
export const ListAndClosableDetail: Story = {
  render: function SplitDemo() {
    // Story-local demo state; the app uses the split-view store.
    const [selectedId, setSelectedId] = useState<string | null>('2');
    const selected = ROWS.find((r) => r.id === selectedId) ?? null;

    return (
      <View className="w-full flex-1 gap-stack bg-surface p-inset">
        <Text className="text-caption text-text-muted">
          Pick a row to open the detail pane; Close details gives the width back.
        </Text>
        <View className="min-h-80 w-full flex-1 flex-row overflow-hidden border-2 border-border">
          <CollapsiblePane width={PRIMARY_WIDTH} open>
            <View className="h-full bg-surface-raised">
              {ROWS.map((row) => (
                <ListRow
                  key={row.id}
                  row={row}
                  selected={row.id === selectedId}
                  onPress={() => setSelectedId(row.id)}
                />
              ))}
            </View>
          </CollapsiblePane>

          <View className="flex-1 border-l-2 border-border bg-surface">
            {selected ? (
              <View className="flex-1">
                <DetailNavbar title={selected.title} onDismiss={() => setSelectedId(null)} />
                <View className="gap-stack p-inset">
                  <Text className="text-title text-text">{selected.subtitle}</Text>
                  <Text className="text-body text-text">{selected.body}</Text>
                </View>
              </View>
            ) : (
              <View className="flex-1 items-center justify-center p-inset">
                <Text className="text-caption text-text-muted">No row selected</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  },
};

/**
 * The three-pane adaptive shape — the Android work, which the iOS host gets
 * from UIKit for free.
 *
 * Primary and supplementary are `SplitViewColumn`s; the detail pane is the
 * router's, and the inspector is a fourth region that slides in over it. The
 * widths here are the real `PANE_WIDTH_DP` values (rem 14, matching the app's
 * metro polyfill), not story numbers, so the proportions are the shipped ones.
 *
 * Which panes are allowed to be on screen is a function of the window size
 * class, so the control below drives the same `windowSizeClassForWidth` the
 * layout uses rather than a story-local toggle.
 */
const SESSIONS: Record<string, { id: string; time: string; learner: string; topic: string; note: string }[]> = {
  r1: [
    { id: 's1', time: '09:00', learner: 'Amina O.', topic: 'Fractions', note: 'Confident on eighths; asked to try tenths.' },
    { id: 's2', time: '10:00', learner: 'Daniel K.', topic: 'Long division', note: 'Close on the estimate step; remainders slip.' },
  ],
  r2: [
    { id: 's3', time: '11:15', learner: 'Priya R.', topic: 'Place value', note: 'Finished the set early. Ready to move on.' },
  ],
  r3: [
    { id: 's4', time: '13:30', learner: 'Tomás L.', topic: 'Word problems', note: 'Needs the question read aloud once.' },
  ],
};

const RESOURCES = [
  { id: 'r1', name: 'Room B', detail: '2 sessions' },
  { id: 'r2', name: 'Room C', detail: '1 session' },
  { id: 'r3', name: 'Online', detail: '1 session' },
];

/**
 * The three-pane adaptive shape — the Android work the iOS host gets from UIKit.
 *
 * The real flow, not a set of toggles: pick a resource in PRIMARY, which fills
 * SUPPLEMENTARY with that resource's sessions; pick a session, which fills
 * DETAIL; press a row inside detail and a closeable INSPECTOR slides in on the
 * right. Selection is what moves between panes, which is the whole point of the
 * shape — each column narrows the one after it.
 *
 * Widths are the shipped `PANE_WIDTH_DP` values, and which columns may be on
 * screen comes from the real `useWindowSizeClass`, so this answers to the
 * viewport toolbar rather than to a control in the story.
 */
export const ThreePaneAdaptive: Story = {
  render: function ThreePane() {
    const sizeClass = useWindowSizeClass();
    const [resourceId, setResourceId] = useState('r1');
    const [sessionId, setSessionId] = useState<string | null>('s2');
    const [inspecting, setInspecting] = useState<string | null>(null);

    const sessions = SESSIONS[resourceId] ?? [];
    const session = sessions.find((x) => x.id === sessionId) ?? null;

    const showSupplementary = sizeClass === 'extraLarge';
    const showPrimary = sizeClass === 'extraLarge' || sizeClass === 'expanded';

    const pickResource = (id: string) => {
      setResourceId(id);
      // The next column's selection cannot survive its parent changing.
      setSessionId(SESSIONS[id]?.[0]?.id ?? null);
      setInspecting(null);
    };

    return (
      <View className="w-full flex-1 gap-stack bg-surface p-inset">
        <Text className="font-mono text-caption text-text-muted">
          {sizeClass} · primary {PANE_WIDTH_DP.primary} · supplementary{' '}
          {PANE_WIDTH_DP.supplementary} · inspector {PANE_WIDTH_DP.inspector}
        </Text>
        <Text className="text-caption text-text-muted">
          Resize the window to change the columns. Press a row in the detail pane to open the
          inspector.
        </Text>

        <View className="min-h-80 w-full flex-1 flex-row overflow-hidden border-2 border-border">
          <CollapsiblePane width={PANE_WIDTH_DP.primary} open={showPrimary}>
            <View className="h-full border-r-2 border-border bg-surface-raised">
              <View className="border-b border-border/30 p-inset">
                <Text className="text-label text-text">Resources</Text>
              </View>
              {RESOURCES.map((r) => (
                <Pressable
                  key={r.id}
                  onPress={() => pickResource(r.id)}
                  className={`min-h-target-adult gap-element border-b border-border/30 p-inset ${
                    r.id === resourceId ? 'bg-highlighter/20' : ''
                  }`}
                >
                  <Text className="text-label text-text">{r.name}</Text>
                  <Text className="text-caption text-text-muted">{r.detail}</Text>
                </Pressable>
              ))}
            </View>
          </CollapsiblePane>

          <CollapsiblePane width={PANE_WIDTH_DP.supplementary} open={showSupplementary}>
            <View className="h-full border-r-2 border-border bg-surface-raised">
              <View className="border-b border-border/30 p-inset">
                <Text className="text-label text-text">Sessions</Text>
              </View>
              {sessions.map((x) => (
                <Pressable
                  key={x.id}
                  onPress={() => {
                    setSessionId(x.id);
                    setInspecting(null);
                  }}
                  className={`min-h-target-adult gap-element border-b border-border/30 p-inset ${
                    x.id === sessionId ? 'bg-highlighter/20' : ''
                  }`}
                >
                  <Text className="font-mono text-data text-text">{x.time}</Text>
                  <Text className="text-caption text-text-muted">{x.learner}</Text>
                </Pressable>
              ))}
            </View>
          </CollapsiblePane>

          {/* Third pane — the router's on device. Its rows drive the inspector. */}
          <View className="min-w-0 flex-1 bg-surface">
            {session ? (
              <View className="flex-1">
                <DetailNavbar title={session.learner} onDismiss={() => setSessionId(null)} />
                <View className="gap-stack p-inset">
                  <Text className="text-title text-text">
                    {session.topic} · {session.time}
                  </Text>
                  {['Session note', 'Mastery', 'Attendance'].map((row) => (
                    <Pressable
                      key={row}
                      onPress={() => setInspecting(row)}
                      className={`min-h-target-adult justify-center rounded-card border-2 border-border p-inset ${
                        inspecting === row ? 'bg-highlighter/20' : 'bg-surface-raised'
                      }`}
                    >
                      <Text className="text-label text-text">{row}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View className="flex-1 items-center justify-center p-inset">
                <Text className="text-caption text-text-muted">No session selected</Text>
              </View>
            )}
          </View>

          {/* Inspector: opened by a press in the third pane, closed from its own bar. */}
          <CollapsiblePane width={PANE_WIDTH_DP.inspector} open={inspecting !== null}>
            <View className="h-full border-l-2 border-border bg-surface-raised">
              <DetailNavbar title={inspecting ?? ''} onDismiss={() => setInspecting(null)} />
              <View className="gap-stack p-inset">
                <Text className="text-body text-text">
                  {inspecting} for {session?.learner ?? '—'}.
                </Text>
                <Text className="text-caption text-text-muted">
                  Slides over the detail pane rather than displacing it, and closes from its
                  own bar.
                </Text>
              </View>
            </View>
          </CollapsiblePane>
        </View>
      </View>
    );
  },
};

/**
 * The leading pane collapsed — what a compact width does when the detail is the
 * only thing on screen. Closing is still the affordance, never a back arrow:
 * the list never went anywhere, so "back" would be a lie.
 */
export const LeadingPaneCollapsed: Story = {
  render: function Collapsed() {
    const [paneOpen, setPaneOpen] = useState(false);
    return (
      <View className="w-full flex-1 gap-stack bg-surface p-inset">
        <Pressable
          onPress={() => setPaneOpen((v) => !v)}
          className="min-h-target-adult self-start justify-center rounded-md border-2 border-border-strong bg-primary px-5 shadow-card"
        >
          <Text className="text-label text-on-primary">{paneOpen ? 'Collapse list' : 'Expand list'}</Text>
        </Pressable>
        <View className="min-h-64 w-full flex-1 flex-row overflow-hidden border-2 border-border">
          <CollapsiblePane width={PRIMARY_WIDTH} open={paneOpen}>
            <View className="h-full bg-surface-raised">
              {ROWS.map((row) => (
                <ListRow key={row.id} row={row} selected={false} onPress={() => {}} />
              ))}
            </View>
          </CollapsiblePane>
          <View className="flex-1 border-l-2 border-border bg-surface">
            <DetailNavbar title="Daniel K." onDismiss={() => {}} />
            <View className="p-inset">
              <Text className="text-body text-text">
                Detail keeps its scroll position and selection when the pane collapses — the
                subtree is never swapped per size class.
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  },
};

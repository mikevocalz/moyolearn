import type { Meta, StoryObj } from '@storybook/react-vite';
import { create } from 'zustand';
import { Banner } from './Banner';
import { Button } from './Button';
import { Dial } from './Dial';
import { Text } from './Text';
import { View } from './primitives';

const meta = {
  title: 'UI/Banner',
  component: Banner,
  args: { tone: 'info', title: 'Progress last synced 2 hours ago.' },
} satisfies Meta<typeof Banner>;
export default meta;
type Story = StoryObj<typeof meta>;

const TONES = (
  <>
    <Banner tone="info" title="Progress last synced 2 hours ago." description="Numbers refresh the next time this device is online." />
    <Banner tone="warning" title="Your trial ends in 3 days." description="Pick a plan to keep every learner's history." />
    <Banner tone="incident" title="A safety incident needs review." description="One conversation was held for review 20 minutes ago." />
    <Banner tone="offline" title="You're offline." description="Saved work is safe — it syncs when you're back." />
  </>
);

// J §3: per tone × dial. Cool is the ops default; Hot re-points the chrome
// tokens via the Dial scope — same component, no dial prop.
export const TonesCool: Story = {
  render: () => <Dial temperature="cool"><View className="gap-stack p-4">{TONES}</View></Dial>,
};

export const TonesHot: Story = {
  render: () => <Dial temperature="hot"><View className="gap-stack p-4">{TONES}</View></Dial>,
};

export const WithAction: Story = {
  render: () => (
    <View className="gap-stack p-4">
      <Banner
        tone="warning"
        title="Payment past due."
        description="Non-blocking — nothing is locked. Update billing when you're ready."
        action={{ label: 'Update billing', onPress: () => {} }}
      />
      <Banner
        tone="offline"
        title="Couldn't refresh."
        action={{ label: 'Retry', onPress: () => {} }}
      />
    </View>
  ),
};

// Story state — zustand always (repo rule). Dismissal is CONTROLLED: the owner
// unmounts the banner; it never hides itself.
const useDismissStory = create<{ dismissed: boolean; set: (d: boolean) => void }>((set) => ({
  dismissed: false,
  set: (dismissed) => set({ dismissed }),
}));

export const Dismissible: Story = {
  render: function Render() {
    const { dismissed, set } = useDismissStory();
    return (
      <View className="gap-stack p-4">
        {dismissed ? (
          <Button title="Bring it back" variant="outline" size="sm" onPress={() => set(false)} />
        ) : (
          <Banner
            tone="info"
            title="A new weekly report is ready."
            onDismiss={() => set(true)}
          />
        )}
      </View>
    );
  },
};

// Doc 31 §5.2 contrast check: severity stays ON THE TILE. The page frame around
// an incident banner keeps the ink border and paper surface — never a red frame.
export const IncidentContained: Story = {
  render: () => (
    <View className="gap-stack rounded-card border-2 border-border bg-surface p-4">
      <Text variant="heading">Today</Text>
      <Banner
        tone="incident"
        title="A safety incident needs review."
        description="The card carries danger only on its status tile — the surrounding frame never turns red."
        action={{ label: 'Review', onPress: () => {} }}
      />
      <Text tone="muted" variant="caption">
        Surrounding content keeps its own hierarchy.
      </Text>
    </View>
  ),
};

// Under OS Reduce Motion the FadeIn mount renders its final frame statically —
// toggle it in system settings; the banner appears without the rise-and-fade.
export const ReducedMotion: Story = {
  render: () => (
    <View className="gap-stack p-4">
      <Banner tone="info" title="Mounts statically when Reduce Motion is on." />
      <Text tone="muted" variant="caption">
        The entrance preset reads the OS setting itself; there is no prop to set.
      </Text>
    </View>
  ),
};

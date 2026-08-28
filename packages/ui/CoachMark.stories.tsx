import type { Meta, StoryObj } from '@storybook/react-vite';
import { CoachMark } from './CoachMark';
import { useCoachMarkStore } from './coach-mark.store';
import { Button } from './Button';
import { View } from './primitives';
import { Text } from './Text';
import { Camera, FileText } from './icons';

/**
 * A dismissed tip stays dismissed — that is the whole feature — so a review
 * surface needs a way back or it shows an empty frame after the first click.
 * `forget` is the store's own action, not a story-only hatch.
 */
function Bench({ children }: { children: React.ReactNode }) {
  const forget = useCoachMarkStore((state) => state.forget);
  return (
    <View className="gap-group p-inset">
      {children}
      <Button
        title="Show these again"
        variant="ghost"
        size="sm"
        onPress={() => {
          forget('capture-snap');
          forget('tutor-notes');
        }}
      />
    </View>
  );
}

const meta = {
  title: 'UI/CoachMark',
  component: CoachMark,
} satisfies Meta<typeof CoachMark>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Doc 37 §4's first named target: the Snap, taught at the capture surface. */
export const CameraAtCamera: Story = {
  args: {
    id: 'capture-snap',
    title: 'Snap one problem',
    body: 'Line the page up inside the box and tap Snap. One problem per shot gives the clearest read.',
    icon: <Camera size={18} className="text-text" />,
    placement: 'below',
    dismissLabel: 'Got it',
    size: 'lg',
  },
  render: (args) => (
    <Bench>
      <CoachMark {...args} />
    </Bench>
  ),
};

/**
 * Doc 37 §4's second named target — the tutor's 30-second "how session notes
 * work" card at the FIRST Notes visit, replacing the front-loaded `preview`
 * step in tutor onboarding (doc 37 §2). The copy lives here until the Notes
 * queue mounts it.
 */
export const NotesAtNotes: Story = {
  args: {
    id: 'tutor-notes',
    title: 'How session notes work',
    body:
      'Write the note while the session is fresh. It becomes the family’s report once you approve it, so say what happened and what comes next — nothing a parent would have to decode.',
    icon: <FileText size={18} className="text-text" />,
    placement: 'below',
    align: 'start',
    dismissLabel: 'Got it',
  },
  render: (args) => (
    <Bench>
      <CoachMark {...args} />
    </Bench>
  ),
};

/** Two tips mounted at once: the second stays un-taught rather than stacking. */
export const NeverStacked: Story = {
  args: { id: 'capture-snap', title: 'First', body: 'This one claims the screen.' },
  render: (args) => (
    <Bench>
      <Text tone="muted">Only one of the two below renders.</Text>
      <CoachMark {...args} />
      <CoachMark id="tutor-notes" title="Second" body="This one waits for another visit." />
    </Bench>
  ),
};
